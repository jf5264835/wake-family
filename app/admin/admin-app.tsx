"use client";
/* eslint-disable react-hooks/set-state-in-effect, react-hooks/exhaustive-deps, @next/next/no-html-link-for-pages, @next/next/no-img-element */

import { ChangeEvent, useEffect, useMemo, useState } from "react";
import type { AdminAuthSettings, AdminPermissions, AdminTab, BrandingSettings, FamilyFormSettings, FormDefinition, FormField, PcoCatalogItem, RegistrationInput } from "../../lib/types";
import { defaultBranding, defaultFamilyFormSettings } from "../../lib/defaults";

type Tab = AdminTab | "users" | "audit";
type Transaction = {
  id: string;
  formId: string;
  status: string;
  rawPayload: string;
  normalizedPayload: string;
  matchPayload: string | null;
  pcoHouseholdId: string | null;
  pcoPrimaryPersonId: string | null;
  lastError: string | null;
  attemptCount: number;
  createdAt: string;
  updatedAt: string;
};
type TransactionLog = { id: number; level: string; event: string; message: string; details: string | null; createdAt: string };
type FormRow = { id: string; slug: string; name: string; description: string; status: string; definition: string; createdBy: string; editPolicy: string; sharedUserIds: string; sharedGroupIds: string; canEdit: boolean; updatedAt: string };
type FormDraft = Omit<FormRow, "definition" | "sharedUserIds" | "sharedGroupIds"> & { definition: FormDefinition; sharedUserIds: string[]; sharedGroupIds: string[] };
type AdminUserSummary = { id: string; name: string; email: string | null; username: string | null };
type AdminGroupSummary = { id: string; name: string };
type AdminUserRow = AdminUserSummary & { authSource: string; enabled: boolean };
type AdminGroupRow = AdminGroupSummary & { samlGroupKey: string; isAdmin: boolean; permissions: string };
type AdminUserDraft = AdminUserRow & { groupIds: string[] };
type AdminGroupDraft = Omit<AdminGroupRow, "permissions"> & { permissions: AdminPermissions };
type Membership = { userId: string; groupId: string };
type AuditEvent = { id: number; actorEmail: string; actorName: string; action: string; targetType: string; targetId: string | null; summary: string; details: string | null; createdAt: string };

const statusLabels: Record<string, string> = {
  synced: "Synced",
  failed: "Failed",
  review_required: "Review",
  assistance_required: "Assistance",
  pending_configuration: "Waiting for PCO",
  awaiting_duplicate_confirmation: "Awaiting answer",
  syncing: "Syncing",
  saved: "Saved",
  edited: "Edited",
  saved_form_response: "Form response",
};

export function AdminApp({ user, signOutPath }: { user: { id: string; name: string; email: string; isAdmin: boolean; permissions: AdminPermissions; groupIds: string[] }; signOutPath: string }) {
  const firstTab = (["transactions", "forms", "registration", "branding", "system"] as AdminTab[]).find((candidate) => user.isAdmin || user.permissions[candidate].read) ?? "system";
  const [tab, setTab] = useState<Tab>(firstTab);
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [forms, setForms] = useState<FormRow[]>([]);
  const [branding, setBranding] = useState<BrandingSettings>(defaultBranding);
  const [familySettings, setFamilySettings] = useState<FamilyFormSettings>(defaultFamilyFormSettings);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [selected, setSelected] = useState<{ registration: Transaction; logs: TransactionLog[] } | null>(null);
  const [statusFilter, setStatusFilter] = useState("all");
  const [search, setSearch] = useState("");
  const [notice, setNotice] = useState("");
  const [loading, setLoading] = useState(true);

  async function loadTransactions() {
    const params = new URLSearchParams();
    if (statusFilter !== "all") params.set("status", statusFilter);
    if (search.trim()) params.set("search", search.trim());
    const response = await fetch(`/api/admin/transactions?${params}`);
    if (response.ok) setTransactions((await response.json()).transactions);
  }

  async function loadForms() {
    const response = await fetch("/api/admin/forms");
    if (response.ok) setForms((await response.json()).forms);
  }

  async function loadBranding() {
    const response = await fetch("/api/admin/branding");
    if (response.ok) {
      const saved = (await response.json()).branding;
      setBranding({ ...defaultBranding, ...saved });
    }
  }

  async function loadFamilySettings() {
    const response = await fetch("/api/admin/form-settings");
    if (response.ok) {
      const saved = (await response.json()).settings;
      setFamilySettings({ ...defaultFamilyFormSettings, ...saved, labels: { ...defaultFamilyFormSettings.labels, ...(saved.labels ?? {}) }, mappings: { ...defaultFamilyFormSettings.mappings, ...(saved.mappings ?? {}) } });
    }
  }

  useEffect(() => {
    Promise.all([loadTransactions(), loadForms(), loadBranding(), loadFamilySettings()]).finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    if (tab === "transactions") loadTransactions();
  }, [statusFilter]);

  async function openTransaction(id: string) {
    setSelectedId(id);
    const response = await fetch(`/api/admin/transactions/${id}`);
    if (response.ok) setSelected(await response.json());
  }

  async function refreshSelected() {
    await loadTransactions();
    if (selectedId) await openTransaction(selectedId);
  }

  const counts = useMemo(() => ({
    total: transactions.length,
    attention: transactions.filter((row) => ["failed", "review_required", "assistance_required"].includes(row.status)).length,
    synced: transactions.filter((row) => row.status === "synced").length,
  }), [transactions]);

  return (
    <main className="admin-shell">
      <aside className="admin-sidebar">
        <a className="admin-brand" href="/">Wake Church <span>Family tools</span></a>
        <nav>
          {user.isAdmin || user.permissions.transactions.read ? <AdminNav active={tab === "transactions"} onClick={() => setTab("transactions")} icon="↳">Transactions</AdminNav> : null}
          {user.isAdmin || user.permissions.forms.read ? <AdminNav active={tab === "forms"} onClick={() => setTab("forms")} icon="□">Forms</AdminNav> : null}
          {user.isAdmin || user.permissions.registration.read ? <AdminNav active={tab === "registration"} onClick={() => setTab("registration")} icon="≣">Registration form</AdminNav> : null}
          {user.isAdmin || user.permissions.branding.read ? <AdminNav active={tab === "branding"} onClick={() => setTab("branding")} icon="◐">Branding</AdminNav> : null}
          {user.isAdmin || user.permissions.system.read ? <AdminNav active={tab === "system"} onClick={() => setTab("system")} icon="⚙">System</AdminNav> : null}
          {user.isAdmin ? <><AdminNav active={tab === "users"} onClick={() => setTab("users")} icon="◎">Users & groups</AdminNav><AdminNav active={tab === "audit"} onClick={() => setTab("audit")} icon="≡">Audit log</AdminNav></> : null}
        </nav>
        <div className="admin-user"><span>{user.name}</span><small>{user.email}</small><a href={signOutPath}>Sign out</a></div>
      </aside>

      <section className="admin-main">
        <header className="admin-mobile-header"><button onClick={() => setTab(tab)}>Wake Family Tools</button><span>{user.name}</span></header>
        {notice ? <div className="admin-notice" role="status">{notice}<button onClick={() => setNotice("")}>×</button></div> : null}
        {loading ? <div className="admin-loading">Loading family tools…</div> : null}
        {!loading && tab === "transactions" ? (
          <TransactionsPanel transactions={transactions} counts={counts} statusFilter={statusFilter} setStatusFilter={setStatusFilter} search={search} setSearch={setSearch} onSearch={loadTransactions} onOpen={openTransaction} />
        ) : null}
        {!loading && tab === "forms" ? <FormsPanel forms={forms} refresh={loadForms} setNotice={setNotice} canWrite={user.isAdmin || user.permissions.forms.write} /> : null}
        {!loading && tab === "registration" ? <FamilyFormSettingsPanel settings={familySettings} setSettings={setFamilySettings} setNotice={setNotice} canWrite={user.isAdmin || user.permissions.registration.write} /> : null}
        {!loading && tab === "branding" ? <BrandingPanel branding={branding} setBranding={setBranding} setNotice={setNotice} canWrite={user.isAdmin || user.permissions.branding.write} /> : null}
        {!loading && tab === "system" ? <SystemPanel /> : null}
        {!loading && tab === "users" && user.isAdmin ? <AccessPanel setNotice={setNotice} /> : null}
        {!loading && tab === "audit" && user.isAdmin ? <AuditPanel /> : null}
      </section>

      {selectedId ? <TransactionDrawer data={selected} onClose={() => { setSelectedId(null); setSelected(null); }} onRefresh={refreshSelected} setNotice={setNotice} canWrite={user.isAdmin || user.permissions.transactions.write} /> : null}
    </main>
  );
}

function AdminNav({ active, onClick, icon, children }: { active: boolean; onClick: () => void; icon: string; children: React.ReactNode }) {
  return <button className={active ? "active" : ""} onClick={onClick}><i>{icon}</i><span>{children}</span></button>;
}

function TransactionsPanel({ transactions, counts, statusFilter, setStatusFilter, search, setSearch, onSearch, onOpen }: {
  transactions: Transaction[]; counts: { total: number; attention: number; synced: number }; statusFilter: string; setStatusFilter: (value: string) => void; search: string; setSearch: (value: string) => void; onSearch: () => void; onOpen: (id: string) => void;
}) {
  return (
    <div className="admin-page">
      <div className="admin-title"><div><p className="eyebrow">Sunday operations</p><h1>Transactions</h1><p>Every submission is saved here before Planning Center is contacted.</p></div><a className="admin-primary" href="/" target="_blank">Open registration ↗</a></div>
      <div className="metric-row"><Metric label="Loaded" value={counts.total} /><Metric label="Needs attention" value={counts.attention} tone="warn" /><Metric label="Synced" value={counts.synced} tone="good" /></div>
      <div className="table-toolbar">
        <form onSubmit={(event) => { event.preventDefault(); onSearch(); }}><input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search name, email, or transaction ID" /><button>Search</button></form>
        <select value={statusFilter} onChange={(event) => setStatusFilter(event.target.value)}><option value="all">All statuses</option><option value="failed">Failed</option><option value="review_required">Review required</option><option value="assistance_required">Assistance required</option><option value="pending_configuration">Waiting for PCO</option><option value="synced">Synced</option></select>
      </div>
      <div className="transaction-table-wrap">
        <table className="transaction-table"><thead><tr><th>Family / response</th><th>Status</th><th>Submitted</th><th>Attempts</th><th /></tr></thead><tbody>
          {transactions.map((row) => {
            const summary = transactionSummary(row);
            return <tr key={row.id} onClick={() => onOpen(row.id)}><td><strong>{summary.title}</strong><small>{summary.subtitle}</small></td><td><StatusPill status={row.status} /></td><td>{formatDate(row.createdAt)}</td><td>{row.attemptCount}</td><td>→</td></tr>;
          })}
          {!transactions.length ? <tr><td colSpan={5} className="empty-cell">No transactions match these filters.</td></tr> : null}
        </tbody></table>
      </div>
    </div>
  );
}

function Metric({ label, value, tone = "" }: { label: string; value: number; tone?: string }) { return <article className={`metric ${tone}`}><span>{label}</span><strong>{value}</strong></article>; }
function StatusPill({ status }: { status: string }) { return <span className={`status-pill status-${status}`}>{statusLabels[status] ?? status.replaceAll("_", " ")}</span>; }

function transactionSummary(row: Transaction) {
  try {
    const data = JSON.parse(row.normalizedPayload);
    if (data.people?.length) return { title: data.householdName || `${data.people[0].lastName} Household`, subtitle: `Primary contact: ${data.people[0].firstName} ${data.people[0].lastName} · Members: ${data.people.length} · Email: ${data.people[0].email || "none"}` };
    const values = data.values ?? data;
    const text = Object.values(values).filter((value) => typeof value === "string").slice(0, 2).join(" · ");
    return { title: "Form response", subtitle: text || row.formId };
  } catch { return { title: "Saved transaction", subtitle: row.id }; }
}

function TransactionDrawer({ data, onClose, onRefresh, setNotice, canWrite }: { data: { registration: Transaction; logs: TransactionLog[] } | null; onClose: () => void; onRefresh: () => Promise<void>; setNotice: (value: string) => void; canWrite: boolean }) {
  const [payload, setPayload] = useState<RegistrationInput | null>(null);
  const [busy, setBusy] = useState(false);
  const [overrideArmed, setOverrideArmed] = useState(false);
  useEffect(() => {
    if (!data) return;
    try {
      const parsed = JSON.parse(data.registration.normalizedPayload);
      setPayload(parsed.people ? { ...parsed, householdName: parsed.householdName || `${parsed.people[0]?.lastName || "Family"} Household` } : null);
      setOverrideArmed(false);
    } catch { setPayload(null); }
  }, [data]);

  async function save() {
    if (!data || !payload) return;
    setBusy(true);
    const response = await fetch(`/api/admin/transactions/${data.registration.id}`, { method: "PUT", headers: { "content-type": "application/json" }, body: JSON.stringify(payload) });
    const result = await response.json();
    setBusy(false);
    if (!response.ok) return setNotice(result.error || "Changes could not be saved.");
    setNotice("Transaction changes saved.");
    await onRefresh();
  }

  async function retry(override = false) {
    if (!data) return;
    setBusy(true);
    const response = await fetch(`/api/admin/transactions/${data.registration.id}/retry`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ override }) });
    const result = await response.json();
    setBusy(false);
    setNotice(response.ok ? `Retry finished with status: ${statusLabels[result.status] ?? result.status}.` : result.error || "Retry failed.");
    await onRefresh();
  }

  return (
    <div className="drawer-backdrop" onMouseDown={(event) => event.target === event.currentTarget && onClose()}>
      <aside className="transaction-drawer">
        <header><div><p className="eyebrow">Transaction detail</p><h2>{data ? transactionSummary(data.registration).title : "Loading…"}</h2></div><button aria-label="Close" onClick={onClose}>×</button></header>
        {!data ? <p>Loading transaction…</p> : (
          <>
            <div className="drawer-meta"><StatusPill status={data.registration.status} /><span>{formatDate(data.registration.createdAt)}</span><code>{data.registration.id}</code></div>
            {data.registration.lastError ? <section className="error-card"><strong>Latest error</strong><pre>{prettyJson(data.registration.lastError)}</pre></section> : null}
            {payload ? (
              <section className="drawer-section"><h3>Saved household</h3>
                <div className="admin-household-grid"><AdminField label="Household name"><input value={payload.householdName ?? ""} onChange={(event) => setPayload({ ...payload, householdName: event.target.value })} /></AdminField></div>
                {payload.people.map((person, index) => <fieldset className="admin-person-card" key={person.id ?? index}><legend>{person.role === "parent" ? `Parent ${payload.people.filter((candidate, candidateIndex) => candidate.role === "parent" && candidateIndex <= index).length}` : `${person.role.charAt(0).toUpperCase()}${person.role.slice(1)} ${index + 1}`}</legend><div className="admin-person-grid"><AdminField label="First name"><input value={person.firstName} onChange={(event) => updateDrawerPerson(setPayload, index, "firstName", event.target.value)} /></AdminField><AdminField label="Last name"><input value={person.lastName} onChange={(event) => updateDrawerPerson(setPayload, index, "lastName", event.target.value)} /></AdminField><AdminField label="Date of birth"><input type="date" value={person.birthdate} onChange={(event) => updateDrawerPerson(setPayload, index, "birthdate", event.target.value)} /></AdminField>{person.role === "parent" ? <><AdminField label={payload.people.filter((candidate) => candidate.role === "parent")[0] === person ? "Email" : "Email (optional)"}><input type="email" value={person.email ?? ""} onChange={(event) => updateDrawerPerson(setPayload, index, "email", event.target.value)} /></AdminField><AdminField label={payload.people.filter((candidate) => candidate.role === "parent")[0] === person ? "Mobile phone" : "Mobile phone (optional)"}><input value={person.phone ?? ""} onChange={(event) => updateDrawerPerson(setPayload, index, "phone", event.target.value)} /></AdminField></> : person.role === "child" ? <><AdminField label="Allergies"><select value={person.hasAllergies ? "yes" : "no"} onChange={(event) => updateDrawerPerson(setPayload, index, "hasAllergies", event.target.value === "yes")}><option value="no">No</option><option value="yes">Yes</option></select></AdminField><AdminField label="Allergy details"><textarea value={person.allergyDetails ?? ""} onChange={(event) => updateDrawerPerson(setPayload, index, "allergyDetails", event.target.value)} /></AdminField><AdminField label="Special needs"><select value={person.hasSpecialNeeds ? "yes" : "no"} onChange={(event) => updateDrawerPerson(setPayload, index, "hasSpecialNeeds", event.target.value === "yes")}><option value="no">No</option><option value="yes">Yes</option></select></AdminField><AdminField label="Special-needs details"><textarea value={person.specialNeedsDetails ?? ""} onChange={(event) => updateDrawerPerson(setPayload, index, "specialNeedsDetails", event.target.value)} /></AdminField></> : null}</div></fieldset>)}
                <fieldset className="admin-person-card"><legend>Household address</legend><div className="admin-address-grid"><AdminField label="Street address"><input value={payload.address.line1} onChange={(event) => setPayload({ ...payload, address: { ...payload.address, line1: event.target.value } })} /></AdminField><AdminField label="Apartment, suite, etc."><input value={payload.address.line2 ?? ""} onChange={(event) => setPayload({ ...payload, address: { ...payload.address, line2: event.target.value } })} /></AdminField><AdminField label="City"><input value={payload.address.city} onChange={(event) => setPayload({ ...payload, address: { ...payload.address, city: event.target.value } })} /></AdminField><AdminField label="State"><input value={payload.address.state} onChange={(event) => setPayload({ ...payload, address: { ...payload.address, state: event.target.value } })} /></AdminField><AdminField label="ZIP code"><input value={payload.address.postalCode} onChange={(event) => setPayload({ ...payload, address: { ...payload.address, postalCode: event.target.value } })} /></AdminField></div></fieldset>
                {data.registration.status === "synced" || data.registration.pcoHouseholdId || data.registration.pcoPrimaryPersonId ? <p className="sync-lock-note">Saving here changes only the local transaction. It does not update the existing Planning Center family.</p> : null}
                <button className="admin-secondary" disabled={busy || !canWrite} onClick={save}>{canWrite ? "Save changes" : "Read only"}</button>
              </section>
            ) : <section className="drawer-section"><h3>Saved response</h3><pre>{prettyJson(data.registration.normalizedPayload)}</pre></section>}
            <section className="drawer-section"><div className="section-title-row"><h3>Debug log</h3>{canWrite ? (data.registration.status === "synced" || data.registration.pcoHouseholdId || data.registration.pcoPrimaryPersonId ? <div className="override-submit"><label><input type="checkbox" checked={overrideArmed} onChange={(event) => setOverrideArmed(event.target.checked)} />I understand this creates another Planning Center family</label><button className="admin-danger compact" disabled={busy || !overrideArmed} onClick={() => retry(true)}>{busy ? "Working…" : "Override and submit again"}</button></div> : <button className="admin-primary compact" disabled={busy} onClick={() => retry(false)}>{busy ? "Working…" : "Resubmit to PCO"}</button>) : <span className="status-pill">Read only</span>}</div><div className="log-list">{data.logs.map((log) => <article key={log.id} className={`log-${log.level}`}><i /><div><strong>{log.message}</strong><span>{log.event} · {formatDate(log.createdAt)}</span>{log.details ? <pre>{prettyJson(log.details)}</pre> : null}</div></article>)}</div></section>
          </>
        )}
      </aside>
    </div>
  );
}

function AdminField({ label, children }: { label: string; children: React.ReactNode }) { return <label className="admin-field"><span>{label}</span>{children}</label>; }

function updateDrawerPerson(setPayload: React.Dispatch<React.SetStateAction<RegistrationInput | null>>, index: number, field: string, value: string | boolean) {
  setPayload((current) => current ? { ...current, people: current.people.map((person, personIndex) => personIndex === index ? { ...person, [field]: value } : person) } : current);
}

function FormsPanel({ forms, refresh, setNotice, canWrite }: { forms: FormRow[]; refresh: () => Promise<void>; setNotice: (value: string) => void; canWrite: boolean }) {
  const [selectedId, setSelectedId] = useState(forms[0]?.id ?? "");
  const selected = forms.find((form) => form.id === selectedId) ?? null;
  const [draft, setDraft] = useState<FormDraft | null>(selected ? formToDraft(selected) : null);
  const [pcoItems, setPcoItems] = useState<PcoCatalogItem[]>([]);
  const [catalogState, setCatalogState] = useState("Not loaded");
  const [directory, setDirectory] = useState<{ users: AdminUserSummary[]; groups: AdminGroupSummary[] }>({ users: [], groups: [] });
  useEffect(() => { if (selected) setDraft(formToDraft(selected)); }, [selectedId, forms]);
  useEffect(() => { fetch("/api/admin/directory").then((response) => response.ok ? response.json() : null).then((data) => data && setDirectory(data)).catch(() => undefined); }, []);

  async function loadPcoCatalog() {
    setCatalogState("Loading…");
    const response = await fetch("/api/admin/pco/catalog");
    const result = await response.json();
    if (!response.ok) { setPcoItems([]); setCatalogState(result.error || "Unavailable"); return; }
    setPcoItems(result.items ?? []);
    setCatalogState(`${result.items?.length ?? 0} Planning Center fields and lists loaded`);
  }

  async function createForm() {
    const name = window.prompt("Form name", "Connection card");
    if (!name) return;
    const response = await fetch("/api/admin/forms", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ name }) });
    const result = await response.json();
    if (!response.ok) return setNotice(result.error);
    await refresh();
    setSelectedId(result.form.id);
  }

  async function saveForm() {
    if (!draft) return;
    const response = await fetch(`/api/admin/forms/${draft.id}`, { method: "PUT", headers: { "content-type": "application/json" }, body: JSON.stringify(draft) });
    const result = await response.json();
    if (!response.ok) return setNotice(result.error || "Form could not be saved.");
    setNotice("Form saved.");
    await refresh();
  }

  function updateField(index: number, changes: Partial<FormField>) { if (draft) setDraft({ ...draft, definition: { ...draft.definition, fields: draft.definition.fields.map((field, fieldIndex) => fieldIndex === index ? { ...field, ...changes } : field) } }); }
  function updateValidation(index: number, changes: NonNullable<FormField["validation"]>) { if (!draft) return; const field = draft.definition.fields[index]; updateField(index, { validation: { ...(field.validation ?? {}), ...changes } }); }
  function moveField(index: number, direction: -1 | 1) { if (!draft) return; const fields = [...draft.definition.fields]; const target = index + direction; if (target < 0 || target >= fields.length) return; [fields[index], fields[target]] = [fields[target], fields[index]]; setDraft({ ...draft, definition: { ...draft.definition, fields } }); }
  function removeField(index: number) { if (draft) setDraft({ ...draft, definition: { ...draft.definition, fields: draft.definition.fields.filter((_, fieldIndex) => fieldIndex !== index) } }); }
  function addField() { if (!draft) return; const field: FormField = { id: `field_${clientId().slice(0, 8)}`, label: "New field", type: "text", required: false, pcoMapping: "" }; setDraft({ ...draft, definition: { ...draft.definition, fields: [...draft.definition.fields, field] } }); }
  const owner = draft ? directory.users.find((candidate) => candidate.id === draft.createdBy || candidate.email === draft.createdBy) : null;

  return (
    <div className="admin-page forms-page">
      <div className="admin-title"><div><p className="eyebrow">Flexible data collection</p><h1>Form builder</h1><p>Build forms with ordered fields, validation, and Planning Center mappings.</p></div><button className="admin-primary" onClick={createForm} disabled={!canWrite}>+ New form</button></div>
      <div className="form-builder-layout">
        <aside className="forms-list"><strong>Your forms</strong>{forms.map((form) => <button className={form.id === selectedId ? "active" : ""} key={form.id} onClick={() => setSelectedId(form.id)}><span>{form.name}</span><small>{form.status} · /f/{form.slug}</small></button>)}{!forms.length ? <p>No custom forms yet.</p> : null}</aside>
        {draft ? <section className={`builder-canvas ${draft.canEdit ? "" : "readonly"}`}>
          <div className="builder-settings"><label><span>Form name</span><input value={draft.name} onChange={(event) => setDraft({ ...draft, name: event.target.value })} /></label><label><span>Public URL</span><div className="slug-input"><i>/f/</i><input value={draft.slug} onChange={(event) => setDraft({ ...draft, slug: event.target.value })} /></div></label><label className="wide"><span>Description</span><textarea value={draft.description} onChange={(event) => setDraft({ ...draft, description: event.target.value })} /></label></div>
          {!draft.canEdit ? <div className="form-lock-note">This form is read-only for you. Its owner or an administrator can change the sharing settings.</div> : null}
          <div className="form-sharing"><div><strong>Editing access</strong><small>Owner: {owner?.name || draft.createdBy || "Legacy form"}</small></div><label><span>Who can edit</span><select value={draft.editPolicy} onChange={(event) => setDraft({ ...draft, editPolicy: event.target.value })} disabled={!draft.canEdit}><option value="owner">Only the form owner</option><option value="shared">Owner and selected users or groups</option><option value="all">Anyone with Forms write access</option></select></label>{draft.editPolicy === "shared" ? <div className="sharing-picks"><strong>Share editing with</strong>{directory.users.filter((candidate) => candidate.id !== draft.createdBy && candidate.email !== draft.createdBy).map((candidate) => <label key={candidate.id}><input type="checkbox" checked={draft.sharedUserIds.includes(candidate.id)} onChange={() => setDraft({ ...draft, sharedUserIds: toggleId(draft.sharedUserIds, candidate.id) })} disabled={!draft.canEdit} />{candidate.name} <small>{candidate.email || candidate.username || "Local account"}</small></label>)}{directory.groups.map((group) => <label key={group.id}><input type="checkbox" checked={draft.sharedGroupIds.includes(group.id)} onChange={() => setDraft({ ...draft, sharedGroupIds: toggleId(draft.sharedGroupIds, group.id) })} disabled={!draft.canEdit} />Group: {group.name}</label>)}</div> : null}</div>
          <div className="builder-heading"><div><h2>Fields</h2><p>{catalogState}</p></div><div><button className="admin-secondary" onClick={loadPcoCatalog}>Refresh PCO fields</button><button className="admin-secondary" onClick={addField}>+ Add field</button></div></div>
          <div className="builder-fields">{draft.definition.fields.map((field, index) => <article key={field.id}>
            <div className="field-order"><button onClick={() => moveField(index, -1)} aria-label="Move up">↑</button><button onClick={() => moveField(index, 1)} aria-label="Move down">↓</button></div>
            <label><span>Label</span><input value={field.label} onChange={(event) => updateField(index, { label: event.target.value })} /></label>
            <label><span>Type</span><select value={field.type} onChange={(event) => updateField(index, { type: event.target.value as FormField["type"] })}><option value="text">Text</option><option value="email">Email</option><option value="phone">Phone</option><option value="date">Date</option><option value="select">Select</option><option value="checkbox">Checkbox</option><option value="textarea">Long text</option></select></label>
            <label><span>PCO destination</span><select value={field.pcoMapping ?? ""} onChange={(event) => updateField(index, { pcoMapping: event.target.value })}><option value="">Not mapped</option><optgroup label="Standard fields"><option value="person.first_name">Person · first name</option><option value="person.last_name">Person · last name</option><option value="person.birthdate">Person · birthdate</option><option value="email.address">Email · address</option><option value="phone_number.number">Phone · number</option><option value="address.street">Address · street</option><option value="address.city">Address · city</option><option value="address.state">Address · state</option><option value="address.zip">Address · ZIP</option></optgroup>{pcoItems.length ? <optgroup label="Planning Center custom fields and lists">{pcoItems.map((item) => <option key={`${item.kind}-${item.id}`} value={item.mapping}>{item.kind === "field" ? "Custom field" : "List"} · {item.label}</option>)}</optgroup> : null}</select></label>
            <label className="required-toggle"><input type="checkbox" checked={field.required} onChange={(event) => updateField(index, { required: event.target.checked })} /><span>Required</span></label>
            <button className="delete-field" onClick={() => removeField(index)} aria-label={`Delete ${field.label}`}>×</button>
            <details className="field-validation"><summary>Validation, placeholder, and select values</summary><div>
              <label><span>Placeholder</span><input value={field.placeholder ?? ""} onChange={(event) => updateField(index, { placeholder: event.target.value })} /></label>
              <label><span>Minimum length</span><input type="number" min="0" value={field.validation?.minLength ?? ""} onChange={(event) => updateValidation(index, { minLength: optionalNumber(event.target.value) })} /></label>
              <label><span>Maximum length</span><input type="number" min="0" value={field.validation?.maxLength ?? ""} onChange={(event) => updateValidation(index, { maxLength: optionalNumber(event.target.value) })} /></label>
              <label><span>Pattern (regular expression)</span><input value={field.validation?.pattern ?? ""} onChange={(event) => updateValidation(index, { pattern: event.target.value || undefined })} placeholder="Example: ^[A-Z]{2}$" /></label>
              {field.type === "date" ? <><label><span>Minimum age</span><input type="number" min="0" value={field.validation?.minAge ?? ""} onChange={(event) => updateValidation(index, { minAge: optionalNumber(event.target.value) })} /></label><label><span>Maximum age</span><input type="number" min="0" value={field.validation?.maxAge ?? ""} onChange={(event) => updateValidation(index, { maxAge: optionalNumber(event.target.value) })} /></label></> : null}
              <label className="wide"><span>Validation message override</span><input value={field.validation?.customMessage ?? ""} onChange={(event) => updateValidation(index, { customMessage: event.target.value || undefined })} /></label>
              {field.type === "select" ? <><label><span>Values source</span><select value={field.optionSource?.type === "pco_field" ? field.optionSource.resourceId ?? "" : "manual"} onChange={(event) => { const item = pcoItems.find((candidate) => candidate.id === event.target.value && candidate.kind === "field"); updateField(index, item ? { optionSource: { type: "pco_field", resourceId: item.id, resourceLabel: item.label }, options: item.options ?? [], pcoMapping: field.pcoMapping || item.mapping } : { optionSource: { type: "manual" } }); }}><option value="manual">Manual values</option>{pcoItems.filter((item) => item.kind === "field" && item.options?.length).map((item) => <option value={item.id} key={item.id}>PCO custom field · {item.label}</option>)}</select></label><label className="wide"><span>Options, one per line</span><textarea value={(field.options ?? []).join("\n")} onChange={(event) => updateField(index, { options: event.target.value.split("\n").map((value) => value.trim()).filter(Boolean), optionSource: { type: "manual" } })} disabled={field.optionSource?.type === "pco_field"} /></label></> : null}
            </div></details>
          </article>)}</div>
          <div className="builder-footer"><label className="publish-toggle"><input type="checkbox" checked={draft.status === "published"} onChange={(event) => setDraft({ ...draft, status: event.target.checked ? "published" : "draft" })} disabled={!draft.canEdit} /><span>Published</span></label>{draft.status === "published" ? <a href={`/f/${draft.slug}`} target="_blank">Open form ↗</a> : null}<button className="admin-primary" onClick={saveForm} disabled={!draft.canEdit}>{draft.canEdit ? "Save form" : "Read only"}</button></div>
        </section> : <section className="builder-empty"><h2>{canWrite ? "Create your first form" : "No forms available"}</h2><p>{canWrite ? "Start with a simple connection card and map its fields to Planning Center." : "You have read access, but no forms have been created yet."}</p>{canWrite ? <button className="admin-primary" onClick={createForm}>Create form</button> : null}</section>}
      </div>
    </div>
  );
}

function FamilyFormSettingsPanel({ settings, setSettings, setNotice, canWrite }: { settings: FamilyFormSettings; setSettings: (value: FamilyFormSettings) => void; setNotice: (value: string) => void; canWrite: boolean }) {
  const [pcoItems, setPcoItems] = useState<PcoCatalogItem[]>([]);
  const [catalogState, setCatalogState] = useState("Planning Center fields have not been loaded.");
  const [busy, setBusy] = useState(false);
  const mappingRows = [
    { key: "allergies" as const, label: "Allergies checkbox", source: "Checked or unchecked for each child" },
    { key: "allergyDetails" as const, label: "Allergy details", source: "The family-entered text for each child" },
    { key: "specialNeeds" as const, label: "Special-needs checkbox", source: "Checked or unchecked for each child" },
    { key: "specialNeedsDetails" as const, label: "Special-needs details", source: "The family-entered text for each child" },
  ];

  async function loadPcoCatalog() {
    setCatalogState("Loading Planning Center fields…");
    const response = await fetch("/api/admin/pco/catalog");
    const result = await response.json();
    if (!response.ok) { setPcoItems([]); setCatalogState(result.error || "Planning Center fields are unavailable."); return; }
    const fields = (result.items ?? []).filter((item: PcoCatalogItem) => item.kind === "field");
    setPcoItems(fields);
    setCatalogState(`${fields.length} Planning Center custom fields loaded.`);
  }

  async function save() {
    setBusy(true);
    const response = await fetch("/api/admin/form-settings", { method: "PUT", headers: { "content-type": "application/json" }, body: JSON.stringify(settings) });
    const result = await response.json();
    setBusy(false);
    if (!response.ok) return setNotice(result.error || "Registration form settings could not be saved.");
    setSettings(result.settings);
    setNotice("Registration form settings saved.");
  }

  function updateMapping(key: keyof FamilyFormSettings["mappings"], changes: Record<string, string>) {
    setSettings({ ...settings, mappings: { ...settings.mappings, [key]: { ...settings.mappings[key], ...changes } } });
  }

  return <div className="admin-page family-settings-page">
    <div className="admin-title"><div><p className="eyebrow">Primary Sunday workflow</p><h1>Registration form</h1><p>Edit the built-in family form’s field names and explicitly map child-care answers to Planning Center.</p></div><button className="admin-primary" disabled={busy || !canWrite} onClick={save}>{busy ? "Saving…" : canWrite ? "Save registration form" : "Read only"}</button></div>
    <section className="family-settings-card">
      <div className="access-heading"><div><h2>Field names</h2><p>These labels are delivered to every kiosk and browser when the registration page loads.</p></div></div>
      <div className="family-label-controls">{(Object.keys(settings.labels) as Array<keyof FamilyFormSettings["labels"]>).map((key) => <label key={key}><span>{key.replace(/([A-Z])/g, " $1").toLowerCase()}</span><input value={settings.labels[key]} disabled={!canWrite} onChange={(event) => setSettings({ ...settings, labels: { ...settings.labels, [key]: event.target.value } })} /></label>)}</div>
    </section>
    <section className="family-settings-card mapping-card">
      <div className="mapping-heading"><div><h2>Planning Center value mapping</h2><p>No value is sent unless a destination is selected. Checkbox strings must exactly match the value you want stored in the chosen PCO field.</p><small>{catalogState}</small></div><button className="admin-secondary" onClick={loadPcoCatalog}>Refresh PCO fields</button></div>
      <div className="mapping-table-wrap"><table className="mapping-table"><thead><tr><th>Registration value</th><th>PCO custom field</th><th>Value sent</th></tr></thead><tbody>{mappingRows.map((row) => {
        const mapping = settings.mappings[row.key];
        const isBoolean = "trueValue" in mapping;
        const known = pcoItems.some((item) => item.id === mapping.fieldDefinitionId);
        return <tr key={row.key}><td><strong>{row.label}</strong><small>{row.source}</small></td><td><select value={mapping.fieldDefinitionId} disabled={!canWrite} onChange={(event) => { const item = pcoItems.find((candidate) => candidate.id === event.target.value); updateMapping(row.key, { fieldDefinitionId: event.target.value, fieldLabel: item?.label ?? "" }); }}><option value="">Not mapped</option>{mapping.fieldDefinitionId && !known ? <option value={mapping.fieldDefinitionId}>{mapping.fieldLabel || `Configured field ${mapping.fieldDefinitionId}`}</option> : null}{pcoItems.map((item) => <option key={item.id} value={item.id}>{item.label}{item.dataType ? ` · ${item.dataType}` : ""}</option>)}</select></td><td>{isBoolean ? <div className="boolean-map"><label><span>Checked</span><input value={mapping.trueValue} disabled={!canWrite} onChange={(event) => updateMapping(row.key, { trueValue: event.target.value })} /></label><label><span>Unchecked</span><input value={mapping.falseValue} disabled={!canWrite} onChange={(event) => updateMapping(row.key, { falseValue: event.target.value })} placeholder="Blank = do not send" /></label></div> : <span className="mapping-as-is">Entered text is sent as-is</span>}</td></tr>;
      })}</tbody></table></div>
    </section>
  </div>;
}

function BrandingPanel({ branding, setBranding, setNotice, canWrite }: { branding: BrandingSettings; setBranding: (value: BrandingSettings) => void; setNotice: (value: string) => void; canWrite: boolean }) {
  const [busy, setBusy] = useState(false);
  async function upload(event: ChangeEvent<HTMLInputElement>, field: "logoUrl" | "backgroundImageUrl") {
    const file = event.target.files?.[0]; if (!file) return; setBusy(true); const form = new FormData(); form.append("file", file); const response = await fetch("/api/admin/assets", { method: "POST", body: form }); const result = await response.json(); setBusy(false); if (!response.ok) return setNotice(result.error); setBranding({ ...branding, [field]: result.url }); setNotice("Image uploaded. Save branding to publish it.");
  }
  async function save() { setBusy(true); const response = await fetch("/api/admin/branding", { method: "PUT", headers: { "content-type": "application/json" }, body: JSON.stringify(branding) }); const result = await response.json(); setBusy(false); if (!response.ok) return setNotice(result.error); setBranding(result.branding); setNotice("Branding saved."); }
  return <div className="admin-page">
    <div className="admin-title"><div><p className="eyebrow">Public experience</p><h1>Branding</h1><p>Wake Church Brand Standards v{branding.brandStandardsVersion} provide the defaults. Changes here override them for every public form and kiosk.</p></div><button className="admin-primary" disabled={busy || !canWrite} onClick={save}>{busy ? "Saving…" : canWrite ? "Save branding" : "Read only"}</button></div>
    <div className="branding-layout"><section className="branding-form">
      <div className="branding-section-title"><h2>Identity and welcome</h2><p>Used on the registration form and mobile header.</p></div>
      <label><span>Church name</span><input value={branding.churchName} onChange={(event) => setBranding({ ...branding, churchName: event.target.value })} /></label>
      <label><span>Form eyebrow</span><input value={branding.eyebrow} onChange={(event) => setBranding({ ...branding, eyebrow: event.target.value })} /></label>
      <label><span>Welcome headline</span><textarea value={branding.welcomeTitle} onChange={(event) => setBranding({ ...branding, welcomeTitle: event.target.value })} /><small>Use a new line to control the headline break.</small></label>
      <label><span>Welcome message</span><textarea value={branding.welcomeBody} onChange={(event) => setBranding({ ...branding, welcomeBody: event.target.value })} /></label>
      <label className="wide"><span>Volunteer help note</span><input value={branding.helpText} onChange={(event) => setBranding({ ...branding, helpText: event.target.value })} /><small>This is displayed as guidance, not as a fake link.</small></label>
      <div className="branding-section-title"><h2>Review and completion copy</h2></div>
      <label><span>Review heading</span><input value={branding.reviewTitle} onChange={(event) => setBranding({ ...branding, reviewTitle: event.target.value })} /></label>
      <label><span>Submit button</span><input value={branding.submitLabel} onChange={(event) => setBranding({ ...branding, submitLabel: event.target.value })} /></label>
      <label className="wide"><span>Review instructions</span><textarea value={branding.reviewBody} onChange={(event) => setBranding({ ...branding, reviewBody: event.target.value })} /></label>
      <label><span>Success heading</span><input value={branding.successTitle} onChange={(event) => setBranding({ ...branding, successTitle: event.target.value })} /></label>
      <label><span>Assistance heading</span><input value={branding.assistanceTitle} onChange={(event) => setBranding({ ...branding, assistanceTitle: event.target.value })} /></label>
      <label><span>Success message</span><textarea value={branding.successBody} onChange={(event) => setBranding({ ...branding, successBody: event.target.value })} /></label>
      <label><span>Assistance message</span><textarea value={branding.assistanceBody} onChange={(event) => setBranding({ ...branding, assistanceBody: event.target.value })} /></label>
      <div className="branding-section-title"><h2>Images</h2></div>
      <div className="image-control"><span>Logo image</span>{branding.logoUrl ? <img src={branding.logoUrl} alt="Logo preview" /> : <div>No logo uploaded</div>}<label className="admin-secondary">Upload logo<input type="file" accept="image/*" hidden onChange={(event) => upload(event, "logoUrl")} /></label><input value={branding.logoUrl} onChange={(event) => setBranding({ ...branding, logoUrl: event.target.value })} placeholder="Or enter an image URL" /><label><span>Logo alt text</span><input value={branding.logoAltText} onChange={(event) => setBranding({ ...branding, logoAltText: event.target.value })} /></label></div>
      <div className="image-control"><span>Panel background image</span>{branding.backgroundImageUrl ? <img src={branding.backgroundImageUrl} alt="Background preview" /> : <div>No background image uploaded</div>}<label className="admin-secondary">Upload background<input type="file" accept="image/*" hidden onChange={(event) => upload(event, "backgroundImageUrl")} /></label><input value={branding.backgroundImageUrl} onChange={(event) => setBranding({ ...branding, backgroundImageUrl: event.target.value })} placeholder="Or enter an image URL" /><label><span>Image overlay: {branding.panelOverlayOpacity}%</span><input type="range" min="0" max="95" value={branding.panelOverlayOpacity} onChange={(event) => setBranding({ ...branding, panelOverlayOpacity: Number(event.target.value) })} /></label></div>
      <div className="branding-section-title"><h2>Theme</h2></div>
      <label><span>Typography</span><select value={branding.fontStyle} onChange={(event) => setBranding({ ...branding, fontStyle: event.target.value as BrandingSettings["fontStyle"] })}><option value="editorial">Wake editorial</option><option value="modern">Modern sans</option><option value="classic">Classic serif</option></select></label>
      <label><span>Corner style</span><select value={branding.cornerStyle} onChange={(event) => setBranding({ ...branding, cornerStyle: event.target.value as BrandingSettings["cornerStyle"] })}><option value="soft">Soft</option><option value="rounded">Rounded</option><option value="square">Square</option></select></label>
      <div className="color-controls wide">{(["primaryColor", "accentColor", "panelColor", "formBackgroundColor", "textColor"] as const).map((key) => <label key={key}><span>{key.replace(/([A-Z])/g, " $1").toLowerCase()}</span><input type="color" value={branding[key]} onChange={(event) => setBranding({ ...branding, [key]: event.target.value })} /><code>{branding[key]}</code></label>)}</div>
    </section><BrandPreview branding={branding} /></div>
  </div>;
}

function BrandPreview({ branding }: { branding: BrandingSettings }) { return <aside className="brand-preview" style={{ "--preview-primary": branding.primaryColor, "--preview-accent": branding.accentColor, "--preview-panel": branding.panelColor, backgroundImage: branding.backgroundImageUrl ? `linear-gradient(rgba(38,39,37,.78),rgba(38,39,37,.78)),url(${branding.backgroundImageUrl})` : undefined } as React.CSSProperties}>{branding.logoUrl ? <img src={branding.logoUrl} alt="" /> : <strong>{branding.churchName}</strong>}<div><h2>{branding.welcomeTitle}</h2><p>{branding.welcomeBody}</p></div><i /></aside>; }

function AccessPanel({ setNotice }: { setNotice: (value: string) => void }) {
  const [users, setUsers] = useState<AdminUserRow[]>([]);
  const [groups, setGroups] = useState<AdminGroupRow[]>([]);
  const [memberships, setMemberships] = useState<Membership[]>([]);
  const [settings, setSettings] = useState<AdminAuthSettings>({ localAuthEnabled: false, samlEnabled: true, samlGroupClaim: "groups" });
  const [userDraft, setUserDraft] = useState<AdminUserDraft | null>(null);
  const [groupDraft, setGroupDraft] = useState<AdminGroupDraft | null>(null);
  const [busy, setBusy] = useState(false);
  async function load() { const response = await fetch("/api/admin/access"); if (!response.ok) return; const data = await response.json(); setUsers(data.users); setGroups(data.groups); setMemberships(data.memberships); setSettings(data.settings); }
  useEffect(() => { load(); }, []);
  async function send(payload: unknown, success: string) { setBusy(true); const response = await fetch("/api/admin/access", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(payload) }); const result = await response.json(); setBusy(false); if (!response.ok) { setNotice(result.error || "Settings could not be saved."); return false; } setNotice(success); await load(); return true; }
  function openUser(user: AdminUserRow) { setUserDraft({ ...user, groupIds: memberships.filter((membership) => membership.userId === user.id).map((membership) => membership.groupId) }); }
  function openGroup(group: AdminGroupRow) { setGroupDraft({ ...group, permissions: parsePermissionMap(group.permissions) }); }
  function addUser() { setUserDraft({ id: clientId(), name: "", email: null, username: null, authSource: "saml", enabled: true, groupIds: [] }); }
  function addGroup() { setGroupDraft({ id: clientId(), name: "", samlGroupKey: "", isAdmin: false, permissions: emptyPermissionMap() }); }
  return <div className="admin-page access-page"><div className="admin-title"><div><p className="eyebrow">Identity & authorization</p><h1>Users & groups</h1><p>Users receive access through group membership. Groups own all tab permissions and SAML mappings.</p></div></div>
    <section className="access-settings"><div><h2>Authentication methods</h2><p>The hosted review continues to use its platform sign-in. These controls define the self-hosted backend policy.</p></div><label><input type="checkbox" checked={settings.samlEnabled} onChange={(event) => setSettings({ ...settings, samlEnabled: event.target.checked })} />Allow SAML authentication</label><label><input type="checkbox" checked={settings.localAuthEnabled} onChange={(event) => setSettings({ ...settings, localAuthEnabled: event.target.checked })} />Allow local backend authentication</label><label><span>SAML group-claim name</span><input value={settings.samlGroupClaim} onChange={(event) => setSettings({ ...settings, samlGroupClaim: event.target.value })} /></label><button className="admin-primary compact" disabled={busy} onClick={() => send({ operation: "save_settings", settings }, "Authentication settings saved.")}>Save authentication</button></section>
    <div className="access-heading"><div><h2>Groups</h2><p>Permissions from every matched or assigned group are combined.</p></div><button className="admin-secondary" onClick={addGroup}>+ Add group</button></div>
    <div className="access-table-wrap"><table className="access-table"><thead><tr><th>Group</th><th>SAML value</th><th>Access</th><th>Members</th><th /></tr></thead><tbody>{groups.map((group) => { const permissions = parsePermissionMap(group.permissions); const permissionCount = Object.values(permissions).filter((entry) => entry.read || entry.write).length; const memberCount = memberships.filter((membership) => membership.groupId === group.id).length; return <tr key={group.id} onClick={() => openGroup(group)}><td><strong>{group.name}</strong></td><td>{group.samlGroupKey || <span className="muted-cell">Manual only</span>}</td><td>{group.isAdmin ? "Administrator" : `${permissionCount} tab${permissionCount === 1 ? "" : "s"}`}</td><td>{memberCount}</td><td><button className="table-edit" onClick={(event) => { event.stopPropagation(); openGroup(group); }}>Edit</button></td></tr>; })}{!groups.length ? <tr><td colSpan={5} className="empty-cell">No groups have been created.</td></tr> : null}</tbody></table></div>
    <div className="access-heading"><div><h2>Users</h2><p>Administrators bypass all tab and form-sharing permissions and can read the audit log.</p></div><button className="admin-secondary" onClick={addUser}>+ Add user</button></div>
    <div className="access-table-wrap"><table className="access-table"><thead><tr><th>User</th><th>Identity</th><th>Groups</th><th>Status</th><th /></tr></thead><tbody>{users.map((user) => { const bootstrap = user.id.startsWith("bootstrap:"); const assigned = memberships.filter((membership) => membership.userId === user.id).map((membership) => groups.find((group) => group.id === membership.groupId)?.name).filter(Boolean); return <tr key={user.id} onClick={() => openUser(user)}><td><strong>{user.name}</strong><small>{bootstrap ? "Server administrator" : user.authSource === "local" ? "Local account" : user.authSource === "either" ? "SSO + local" : "SAML / SSO"}</small></td><td>{user.email || user.username || "No identity set"}</td><td>{bootstrap ? "All access" : assigned.join(", ") || <span className="muted-cell">No access groups</span>}</td><td>{user.enabled ? "Enabled" : "Disabled"}</td><td><button className="table-edit" onClick={(event) => { event.stopPropagation(); openUser(user); }}>{bootstrap ? "View" : "Edit"}</button></td></tr>; })}</tbody></table></div>
    {groupDraft ? <div className="admin-modal-backdrop" onMouseDown={(event) => event.target === event.currentTarget && setGroupDraft(null)}><form className="admin-modal" role="dialog" aria-modal="true" aria-labelledby="group-editor-title" onSubmit={async (event) => { event.preventDefault(); if (await send({ operation: "save_group", group: groupDraft }, `Group ${groupDraft.name || "settings"} saved.`)) setGroupDraft(null); }}><header><div><p className="eyebrow">Access group</p><h2 id="group-editor-title">{groups.some((group) => group.id === groupDraft.id) ? "Edit group" : "New group"}</h2></div><button type="button" aria-label="Close" onClick={() => setGroupDraft(null)}>×</button></header><div className="modal-field-grid"><label><span>Group name</span><input autoFocus value={groupDraft.name} onChange={(event) => setGroupDraft({ ...groupDraft, name: event.target.value })} /></label><label><span>SAML group value</span><input value={groupDraft.samlGroupKey} onChange={(event) => setGroupDraft({ ...groupDraft, samlGroupKey: event.target.value })} placeholder="wake-admin-forms" /></label></div><label className="admin-check-row"><input type="checkbox" checked={groupDraft.isAdmin} onChange={(event) => setGroupDraft({ ...groupDraft, isAdmin: event.target.checked })} /><span><strong>Administrator group</strong><small>Members bypass tab permissions, form ownership, and can view users and the audit log.</small></span></label>{groupDraft.isAdmin ? <div className="form-lock-note">This group has full access. Individual tab permissions do not apply.</div> : <PermissionMatrix value={groupDraft.permissions} onChange={(permissions) => setGroupDraft({ ...groupDraft, permissions })} />}<footer><button type="button" className="admin-secondary" onClick={() => setGroupDraft(null)}>Cancel</button><button className="admin-primary" disabled={busy}>{busy ? "Saving…" : "Save group"}</button></footer></form></div> : null}
    {userDraft ? <div className="admin-modal-backdrop" onMouseDown={(event) => event.target === event.currentTarget && setUserDraft(null)}><form className="admin-modal" role="dialog" aria-modal="true" aria-labelledby="user-editor-title" onSubmit={async (event) => { event.preventDefault(); if (userDraft.id.startsWith("bootstrap:")) return; if (await send({ operation: "save_user", user: userDraft, groupIds: userDraft.groupIds }, `User ${userDraft.email || userDraft.username || "settings"} saved.`)) setUserDraft(null); }}><header><div><p className="eyebrow">Admin user</p><h2 id="user-editor-title">{userDraft.id.startsWith("bootstrap:") ? "Server administrator" : users.some((user) => user.id === userDraft.id) ? "Edit user" : "New user"}</h2></div><button type="button" aria-label="Close" onClick={() => setUserDraft(null)}>×</button></header>{userDraft.id.startsWith("bootstrap:") ? <div className="form-lock-note">This account is managed by the server allowlist and always has full access.</div> : <><div className="modal-field-grid"><label><span>Name</span><input autoFocus value={userDraft.name} onChange={(event) => setUserDraft({ ...userDraft, name: event.target.value })} /></label><label><span>Account type</span><select value={userDraft.authSource} onChange={(event) => setUserDraft({ ...userDraft, authSource: event.target.value })}><option value="saml">SAML / SSO</option><option value="local">Local account</option><option value="either">SAML / SSO and local</option></select></label>{userDraft.authSource !== "local" ? <label><span>Email</span><input type="email" value={userDraft.email ?? ""} onChange={(event) => setUserDraft({ ...userDraft, email: event.target.value })} required /></label> : <label><span>Email (optional)</span><input type="email" value={userDraft.email ?? ""} onChange={(event) => setUserDraft({ ...userDraft, email: event.target.value })} /></label>}{userDraft.authSource !== "saml" ? <label><span>Local username</span><input value={userDraft.username ?? ""} onChange={(event) => setUserDraft({ ...userDraft, username: event.target.value })} required /></label> : null}</div><label className="admin-check-row"><input type="checkbox" checked={userDraft.enabled} onChange={(event) => setUserDraft({ ...userDraft, enabled: event.target.checked })} /><span><strong>Enabled</strong><small>Disabled users cannot enter the admin portal.</small></span></label><div className="membership-picks"><strong>Group membership</strong>{groups.map((group) => <label key={group.id}><input type="checkbox" checked={userDraft.groupIds.includes(group.id)} onChange={() => setUserDraft({ ...userDraft, groupIds: toggleId(userDraft.groupIds, group.id) })} />{group.name || "Unnamed group"}{group.isAdmin ? <small>Administrator</small> : null}</label>)}{!groups.length ? <p>Create a group before granting this user access.</p> : null}</div></>}<footer><button type="button" className="admin-secondary" onClick={() => setUserDraft(null)}>Close</button>{!userDraft.id.startsWith("bootstrap:") ? <button className="admin-primary" disabled={busy}>{busy ? "Saving…" : "Save user"}</button> : null}</footer></form></div> : null}
  </div>;
}

function PermissionMatrix({ value, onChange }: { value: AdminPermissions; onChange: (value: AdminPermissions) => void }) {
  const labels: Record<AdminTab, string> = { transactions: "Transactions", forms: "Forms", registration: "Registration form", branding: "Branding", system: "System" };
  return <div className="permission-matrix"><div><strong>Admin tab</strong><strong>Read</strong><strong>Write</strong></div>{(["transactions", "forms", "registration", "branding", "system"] as AdminTab[]).map((tab) => <div key={tab}><span>{labels[tab]}</span><input type="checkbox" aria-label={`${labels[tab]} read`} checked={value[tab].read} onChange={(event) => onChange({ ...value, [tab]: { ...value[tab], read: event.target.checked, write: event.target.checked ? value[tab].write : false } })} /><input type="checkbox" aria-label={`${labels[tab]} write`} checked={value[tab].write} onChange={(event) => onChange({ ...value, [tab]: { read: event.target.checked ? true : value[tab].read, write: event.target.checked } })} /></div>)}</div>;
}

function AuditPanel() {
  const [events, setEvents] = useState<AuditEvent[]>([]);
  const [search, setSearch] = useState("");
  async function load() { const response = await fetch(`/api/admin/audit?search=${encodeURIComponent(search)}`); if (response.ok) setEvents((await response.json()).events); }
  useEffect(() => { load(); }, []);
  return <div className="admin-page"><div className="admin-title"><div><p className="eyebrow">Administrator only</p><h1>Audit log</h1><p>Administrative changes and submission actions, attributed to the person who performed them.</p></div></div><form className="audit-search" onSubmit={(event) => { event.preventDefault(); load(); }}><input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search actor, action, or record ID" /><button className="admin-secondary">Search</button></form><div className="audit-list">{events.map((event) => <article key={event.id}><i /><div><strong>{event.summary}</strong><span>{event.actorName} · {event.actorEmail}</span><small>{event.action} · {event.targetType}{event.targetId ? ` · ${event.targetId}` : ""} · {formatDate(event.createdAt)}</small>{event.details ? <details><summary>Details</summary><pre>{prettyJson(event.details)}</pre></details> : null}</div></article>)}{!events.length ? <p>No matching audit events.</p> : null}</div></div>;
}

function SystemPanel() { return <div className="admin-page"><div className="admin-title"><div><p className="eyebrow">Connections & security</p><h1>System</h1><p>Deployment-specific integration status and authentication boundaries.</p></div></div><div className="system-grid"><section><div className="system-status pending"><i />Configuration required</div><h2>Planning Center</h2><p>The app saves every registration locally. Add server-side <code>PCO_APP_ID</code> and <code>PCO_SECRET</code> values to enable duplicate checks, custom-field discovery, and submission.</p><ul><li>Credentials are never sent to the kiosk browser.</li><li>Duplicate searches run before any create calls.</li><li>Synced transactions are locked against accidental repeat submission.</li></ul></section><section><div className="system-status pending"><i />Optional</div><h2>Address autocomplete</h2><p>Add <code>GOOGLE_MAPS_API_KEY</code> with Places API access to enable address suggestions and structured field completion.</p><ul><li>The API key remains server-side.</li><li>Manual address entry always remains available.</li><li>Suggestions are restricted to U.S. addresses.</li></ul></section><section><div className="system-status good"><i />Protected</div><h2>Admin authentication</h2><p>This hosted review uses identity sign-in plus an explicit admin email allowlist. The self-host authentication boundary is designed to be replaced by Google SAML and local accounts.</p><ul><li>Public kiosk routes remain anonymous.</li><li>Admin API authorization is enforced server-side.</li><li>Write requests verify their origin.</li></ul></section><section><div className="system-status good"><i />Active</div><h2>Local transaction store</h2><p>Structured submissions, integration progress, complete errors, and the debug timeline are retained independently of Planning Center.</p><ul><li>Safe success response after local save.</li><li>Full external errors stay admin-only.</li><li>Rate limits protect public submission routes.</li></ul></section></div></div>; }

function formatDate(value: string) { const date = new Date(value.endsWith("Z") ? value : `${value.replace(" ", "T")}Z`); return Number.isNaN(date.valueOf()) ? value : new Intl.DateTimeFormat("en-US", { month: "short", day: "numeric", year: "numeric", hour: "numeric", minute: "2-digit" }).format(date); }
function prettyJson(value: string) { try { return JSON.stringify(JSON.parse(value), null, 2); } catch { return value; } }
function optionalNumber(value: string) { return value === "" ? undefined : Number(value); }
function clientId() { return globalThis.crypto?.randomUUID?.() ?? `${Date.now()}-${Math.random().toString(36).slice(2)}`; }
function parseStringArray(value: string) { try { const parsed = JSON.parse(value); return Array.isArray(parsed) ? parsed.filter((item): item is string => typeof item === "string") : []; } catch { return []; } }
function formToDraft(form: FormRow): FormDraft { return { ...form, definition: JSON.parse(form.definition), sharedUserIds: parseStringArray(form.sharedUserIds), sharedGroupIds: parseStringArray(form.sharedGroupIds) }; }
function toggleId(values: string[], id: string) { return values.includes(id) ? values.filter((value) => value !== id) : [...values, id]; }
function emptyPermissionMap(): AdminPermissions { return Object.fromEntries((["transactions", "forms", "registration", "branding", "system"] as AdminTab[]).map((tab) => [tab, { read: false, write: false }])) as AdminPermissions; }
function parsePermissionMap(value: string): AdminPermissions { try { const parsed = JSON.parse(value) as Partial<AdminPermissions>; const result = emptyPermissionMap(); for (const tab of ["transactions", "forms", "registration", "branding", "system"] as AdminTab[]) { result[tab].read = Boolean(parsed[tab]?.read); result[tab].write = Boolean(parsed[tab]?.write); if (result[tab].write) result[tab].read = true; } return result; } catch { return emptyPermissionMap(); } }
