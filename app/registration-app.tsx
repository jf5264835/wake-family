"use client";
/* eslint-disable react-hooks/set-state-in-effect, @next/next/no-img-element */

import { FormEvent, useEffect, useMemo, useState } from "react";
import { ageOnDate, isPlausibleStreetAddress, normalizeRegistration } from "../lib/normalize";
import type { BrandingSettings, FamilyFormLabels, FamilyFormSettings } from "../lib/types";
import { defaultBranding as defaultBrandingSettings, defaultFamilyFormSettings } from "../lib/defaults";

type PersonRole = "parent" | "child" | "guardian";

type Person = {
  id: string;
  role: PersonRole;
  firstName: string;
  lastName: string;
  birthdate: string;
  email: string;
  phone: string;
  hasAllergies: boolean;
  allergyDetails: string;
  hasSpecialNeeds: boolean;
  specialNeedsDetails: string;
};

type Address = {
  line1: string;
  line2: string;
  city: string;
  state: string;
  postalCode: string;
};

type Branding = BrandingSettings;

type DuplicateMatch = {
  id: string;
  name: string;
  email: string | null;
  phone: string | null;
  household: string[];
};

const defaultBranding: Branding = defaultBrandingSettings;

type AddressSuggestion = { id: string; label: string; primary: string; secondary: string };

const emptyAddress: Address = {
  line1: "",
  line2: "",
  city: "",
  state: "TX",
  postalCode: "",
};

function newPerson(role: PersonRole, index = 0): Person {
  return {
    id: `${role}-${Date.now()}-${index}`,
    role,
    firstName: "",
    lastName: "",
    birthdate: "",
    email: "",
    phone: "",
    hasAllergies: false,
    allergyDetails: "",
    hasSpecialNeeds: false,
    specialNeedsDetails: "",
  };
}

function clientId() {
  return globalThis.crypto?.randomUUID?.() ?? `${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

function formatPhone(value: string) {
  const digits = value.replace(/\D/g, "").slice(0, 10);
  if (digits.length < 4) return digits;
  if (digits.length < 7) return `(${digits.slice(0, 3)}) ${digits.slice(3)}`;
  return `(${digits.slice(0, 3)}) ${digits.slice(3, 6)}-${digits.slice(6)}`;
}

function hexToRgbChannels(value: string) {
  const match = /^#([0-9a-f]{2})([0-9a-f]{2})([0-9a-f]{2})$/i.exec(value);
  return match ? `${Number.parseInt(match[1], 16)} ${Number.parseInt(match[2], 16)} ${Number.parseInt(match[3], 16)}` : "38 39 37";
}

function personLabel(person: Person, index: number, labels: FamilyFormLabels) {
  if (person.role === "parent") return index === 0 ? labels.parent1 : labels.parent2;
  if (person.role === "child") return person.firstName || `${labels.child} ${index}`;
  return person.firstName || `${labels.guardian} ${index}`;
}

export function RegistrationApp() {
  const [branding, setBranding] = useState(defaultBranding);
  const [formSettings, setFormSettings] = useState<FamilyFormSettings>(defaultFamilyFormSettings);
  const [people, setPeople] = useState<Person[]>([newPerson("parent")]);
  const [address, setAddress] = useState<Address>(emptyAddress);
  const [householdName, setHouseholdName] = useState("");
  const [householdNameEdited, setHouseholdNameEdited] = useState(false);
  const [activeId, setActiveId] = useState(people[0].id);
  const [mode, setMode] = useState<"people" | "household" | "review">("people");
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState(false);
  const [duplicateMatches, setDuplicateMatches] = useState<DuplicateMatch[]>([]);
  const [transactionId, setTransactionId] = useState<string | null>(null);
  const [finish, setFinish] = useState<"success" | "assistance" | null>(null);
  const [addressSuggestions, setAddressSuggestions] = useState<AddressSuggestion[]>([]);
  const [addressAutocompleteDismissed, setAddressAutocompleteDismissed] = useState(false);
  const [addressSession] = useState(clientId);

  const active = people.find((person) => person.id === activeId) ?? people[0];
  const activeIndex = people.findIndex((person) => person.id === active.id);
  const parentCount = people.filter((person) => person.role === "parent").length;
  const childCount = people.filter((person) => person.role === "child").length;
  const guardianCount = people.filter((person) => person.role === "guardian").length;

  useEffect(() => {
    fetch("/api/branding", { cache: "no-store" })
      .then((response) => (response.ok ? response.json() : null))
      .then((data) => data?.branding && setBranding({ ...defaultBranding, ...data.branding }))
      .catch(() => undefined);
    fetch("/api/form-settings", { cache: "no-store" })
      .then((response) => (response.ok ? response.json() : null))
      .then((data) => data?.settings && setFormSettings({ ...defaultFamilyFormSettings, ...data.settings, labels: { ...defaultFamilyFormSettings.labels, ...(data.settings.labels ?? {}) }, mappings: { ...defaultFamilyFormSettings.mappings, ...(data.settings.mappings ?? {}) } }))
      .catch(() => undefined);

    const draft = window.localStorage.getItem("wake-family-draft");
    if (!draft) return;
    try {
      const parsed = JSON.parse(draft) as { people?: Person[]; address?: Address; householdName?: string; householdNameEdited?: boolean };
      if (parsed.people?.length) {
        setPeople(parsed.people.map((person) => ({ ...newPerson(person.role), ...person })));
        setActiveId(parsed.people[0].id);
      }
      if (parsed.address) setAddress(parsed.address);
      if (parsed.householdName) setHouseholdName(parsed.householdName);
      setHouseholdNameEdited(Boolean(parsed.householdNameEdited));
    } catch {
      window.localStorage.removeItem("wake-family-draft");
    }
  }, []);

  useEffect(() => {
    window.localStorage.setItem("wake-family-draft", JSON.stringify({ people, address, householdName, householdNameEdited }));
  }, [people, address, householdName, householdNameEdited]);

  useEffect(() => {
    if (!householdNameEdited && !householdName && people[0]?.lastName.trim()) setHouseholdName(`${people[0].lastName.trim()} Household`);
  }, [people, householdName, householdNameEdited]);

  useEffect(() => {
    if (addressAutocompleteDismissed || address.line1.trim().length < 3) {
      setAddressSuggestions([]);
      return;
    }
    const controller = new AbortController();
    const timer = window.setTimeout(() => {
      fetch(`/api/address/suggestions?q=${encodeURIComponent(address.line1)}&session=${encodeURIComponent(addressSession)}`, { signal: controller.signal })
        .then((response) => response.ok ? response.json() : null)
        .then((data) => setAddressSuggestions(Array.isArray(data?.suggestions) ? data.suggestions : []))
        .catch(() => undefined);
    }, 300);
    return () => { window.clearTimeout(timer); controller.abort(); };
  }, [address.line1, addressAutocompleteDismissed, addressSession]);

  const progressCopy = useMemo(() => {
    const parts = [`${parentCount} ${parentCount === 1 ? "parent" : "parents"}`];
    if (childCount) parts.push(`${childCount} ${childCount === 1 ? "child" : "children"}`);
    if (guardianCount) parts.push(`${guardianCount} ${guardianCount === 1 ? "guardian" : "guardians"}`);
    return parts.join(" · ");
  }, [parentCount, childCount, guardianCount]);

  function updatePerson(field: keyof Person, value: string | boolean) {
    setPeople((current) =>
      current.map((person) => (person.id === active.id ? { ...person, [field]: value } : person)),
    );
    if (active.id === people[0].id && field === "lastName" && !householdNameEdited) {
      setHouseholdName(value.trim() ? `${value.trim()} Household` : "");
    }
    setErrors((current) => {
      const next = { ...current };
      delete next[`${active.id}.${field}`];
      return next;
    });
  }

  function validatePerson(person: Person) {
    const next: Record<string, string> = {};
    const prefix = `${person.id}.`;
    if (!person.firstName.trim()) next[`${prefix}firstName`] = "Enter a first name.";
    if (!person.lastName.trim()) next[`${prefix}lastName`] = "Enter a last name.";
    const age = ageOnDate(person.birthdate);
    if (age === null) next[`${prefix}birthdate`] = "Please verify date of birth.";
    if (person.role === "parent") {
      const parents = people.filter((candidate) => candidate.role === "parent");
      const parentPosition = parents.findIndex((candidate) => candidate.id === person.id);
      if (age !== null && (age < 18 || age >= 120)) next[`${prefix}birthdate`] = "Please verify date of birth.";
      if (parentPosition === 0 || person.email.trim()) {
        if (!/^\S+@\S+\.\S+$/.test(person.email)) next[`${prefix}email`] = parentPosition === 0 ? "Enter a valid email." : "Enter a valid email or leave it blank.";
      }
      if (parentPosition === 0 || person.phone.replace(/\D/g, "")) {
        if (person.phone.replace(/\D/g, "").length !== 10) next[`${prefix}phone`] = parentPosition === 0 ? "Enter a 10-digit phone number." : "Enter a 10-digit phone number or leave it blank.";
      }
    } else if (person.role === "guardian" && age !== null && (age < 18 || age >= 120)) {
      next[`${prefix}birthdate`] = "Please verify date of birth.";
    } else if (person.role === "child" && age !== null) {
      if (age >= 18) next[`${prefix}birthdate`] = "Please verify date of birth.";
      const parentAges = people.filter((candidate) => candidate.role === "parent").map((parent) => ageOnDate(parent.birthdate)).filter((value): value is number => value !== null);
      if (parentAges.some((parentAge) => age >= parentAge)) next[`${prefix}birthdate`] = "Please verify date of birth.";
    }
    const parents = people.filter((candidate) => candidate.role === "parent");
    if (parents[1]?.id === person.id) {
      if (person.email.trim() && person.email.trim().toLowerCase() === parents[0].email.trim().toLowerCase()) {
        next[`${prefix}email`] = "Parent 2 needs a different email.";
      }
      if (person.phone.replace(/\D/g, "") && person.phone.replace(/\D/g, "") === parents[0].phone.replace(/\D/g, "")) {
        next[`${prefix}phone`] = "Parent 2 needs a different phone number.";
      }
    }
    return next;
  }

  function validateAddress() {
    const next: Record<string, string> = {};
    if (!isPlausibleStreetAddress(address.line1)) next["address.line1"] = "Enter a complete street address.";
    if (!address.city.trim()) next["address.city"] = "Enter a city.";
    if (!/^[A-Za-z]{2}$/.test(address.state)) next["address.state"] = "Use a 2-letter state code.";
    if (!/^\d{5}(-\d{4})?$/.test(address.postalCode)) next["address.postalCode"] = "Enter a valid ZIP code.";
    if (!householdName.trim()) next["household.name"] = "Enter a household name.";
    return next;
  }

  async function chooseAddress(suggestion: AddressSuggestion) {
    setAddressAutocompleteDismissed(true);
    setAddressSuggestions([]);
    const response = await fetch(`/api/address/details?placeId=${encodeURIComponent(suggestion.id)}&session=${encodeURIComponent(addressSession)}`);
    if (!response.ok) return;
    const result = await response.json();
    if (result.address) setAddress({ ...emptyAddress, ...result.address });
  }

  function continueFromPerson() {
    const nextErrors = { ...validatePerson(active), ...(activeIndex === 0 ? validateAddress() : {}) };
    setErrors(nextErrors);
    if (Object.keys(nextErrors).length) return;
    normalizeForDisplay();
    const nextPerson = people[activeIndex + 1];
    if (nextPerson) setActiveId(nextPerson.id);
    else setMode("review");
  }

  function normalizeForDisplay() {
    const normalized = normalizeRegistration({ people, address, householdName });
    setPeople(normalized.people.map((person, index) => ({
      ...person,
      id: person.id ?? people[index].id,
      email: person.email ?? "",
      phone: formatPhone(person.phone ?? ""),
      hasAllergies: Boolean(person.hasAllergies),
      allergyDetails: person.allergyDetails ?? "",
      hasSpecialNeeds: Boolean(person.hasSpecialNeeds),
      specialNeedsDetails: person.specialNeedsDetails ?? "",
    })));
    setAddress({ ...emptyAddress, ...normalized.address });
    setHouseholdName(normalized.householdName ?? householdName);
  }

  function openReview() {
    normalizeForDisplay();
    setMode("review");
  }

  function addPerson(role: PersonRole) {
    if (role === "parent" && parentCount >= 2) return;
    const person = newPerson(role, people.length);
    setPeople((current) => [...current, person]);
    setActiveId(person.id);
    setMode("people");
  }

  function removePerson(id: string) {
    if (id === people[0].id) return;
    setPeople((current) => current.filter((person) => person.id !== id));
    setActiveId(people[0].id);
  }

  function validateAll() {
    const next = Object.assign({}, ...people.map(validatePerson), validateAddress());
    setErrors(next);
    if (Object.keys(next).length) {
      const firstInvalid = people.find((person) => Object.keys(next).some((key) => key.startsWith(person.id)));
      if (firstInvalid) {
        setActiveId(firstInvalid.id);
        setMode("people");
      }
      return false;
    }
    return true;
  }

  function saveHousehold() {
    const next = validateAddress();
    setErrors(next);
    if (!Object.keys(next).length) openReview();
  }

  async function submit(event?: FormEvent) {
    event?.preventDefault();
    if (!validateAll()) return;
    setBusy(true);
    setErrors({});
    try {
      const response = await fetch("/api/registrations", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ people, address, householdName }),
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || "We could not save this registration.");
      setTransactionId(result.transactionId);
      if (result.matches?.length) setDuplicateMatches(result.matches);
      else completeSuccess();
    } catch (error) {
      setErrors({ submit: error instanceof Error ? error.message : "We could not save this registration." });
    } finally {
      setBusy(false);
    }
  }

  function completeSuccess() {
    window.localStorage.removeItem("wake-family-draft");
    setFinish("success");
  }

  async function resolveDuplicate(isMatch: boolean) {
    if (!transactionId) return;
    setBusy(true);
    try {
      const response = await fetch(`/api/registrations/${transactionId}/resolve`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ isMatch }),
      });
      if (!response.ok) throw new Error("Could not save your selection.");
      window.localStorage.removeItem("wake-family-draft");
      setDuplicateMatches([]);
      setFinish(isMatch ? "assistance" : "success");
    } catch (error) {
      setErrors({ submit: error instanceof Error ? error.message : "Could not save your selection." });
    } finally {
      setBusy(false);
    }
  }

  function reset() {
    const first = newPerson("parent");
    setPeople([first]);
    setAddress(emptyAddress);
    setHouseholdName("");
    setHouseholdNameEdited(false);
    setActiveId(first.id);
    setMode("people");
    setFinish(null);
    setTransactionId(null);
    setErrors({});
  }

  const theme = {
    "--brand-primary": branding.primaryColor,
    "--brand-accent": branding.accentColor,
    "--brand-panel": branding.panelColor,
    "--brand-panel-rgb": hexToRgbChannels(branding.panelColor),
    "--paper": branding.formBackgroundColor,
    "--ink": branding.textColor,
    "--panel-overlay": `${Math.min(95, Math.max(0, branding.panelOverlayOpacity)) / 100}`,
  } as React.CSSProperties;

  if (finish) {
    return (
      <main className={`finish-screen ${finish}`} style={theme} data-font={branding.fontStyle} data-corners={branding.cornerStyle}>
        <div className="finish-mark" aria-hidden="true">{finish === "success" ? "✓" : "!"}</div>
        <p className="eyebrow">{branding.churchName}</p>
        <h1>{finish === "success" ? branding.successTitle : branding.assistanceTitle}</h1>
        <p>{finish === "success" ? branding.successBody : branding.assistanceBody}</p>
        <button className="primary-button finish-button" onClick={reset}>Register another family</button>
      </main>
    );
  }

  return (
    <main className="registration-shell" style={theme} data-font={branding.fontStyle} data-corners={branding.cornerStyle}>
      <aside className="welcome-panel" style={branding.backgroundImageUrl ? { backgroundImage: `linear-gradient(rgb(var(--brand-panel-rgb) / var(--panel-overlay)), rgb(var(--brand-panel-rgb) / var(--panel-overlay))), url(${branding.backgroundImageUrl})`, backgroundSize: "cover", backgroundPosition: "center" } : undefined}>
        <div className="brand-row">
          {branding.logoUrl ? <img src={branding.logoUrl} alt={branding.logoAltText} className="brand-logo" /> : null}
          <span>{branding.churchName}</span>
        </div>
        <div className="welcome-copy">
          <h1>{branding.welcomeTitle.split("\n").map((line) => <span key={line}>{line}</span>)}</h1>
          <p>{branding.welcomeBody}</p>
        </div>
        <div className="household-summary" aria-live="polite">
          <span>Your household</span>
          <strong>{progressCopy}</strong>
          <div className="member-dots" aria-hidden="true">
            {people.slice(0, 7).map((person) => <i key={person.id} className={person.id === activeId ? "active" : ""} />)}
          </div>
        </div>
        <div className="accent-arc" aria-hidden="true" />
      </aside>

      <section className="form-panel">
        <header className="mobile-brand">
          <span>{branding.churchName}</span>
          <small>{progressCopy}</small>
        </header>

        {mode === "people" ? (
          <form className="form-content" onSubmit={(event) => { event.preventDefault(); continueFromPerson(); }} noValidate>
            <p className="eyebrow">{branding.eyebrow}</p>
            <div className="section-heading-row">
              <div>
                <h2>{personLabel(active, active.role === "parent" ? activeIndex : people.filter((p) => p.role === active.role).findIndex((p) => p.id === active.id) + 1, formSettings.labels)}</h2>
                <p>{active.role === "parent" ? (activeIndex === 0 ? "Primary household contact" : "Second parent or primary guardian") : active.role === "child" ? "Child in this household" : "Additional guardian"}</p>
              </div>
              {active.id !== people[0].id ? <button type="button" className="text-button danger" onClick={() => removePerson(active.id)}>Remove</button> : null}
            </div>

            <nav className="person-tabs" aria-label="Household members">
              {people.map((person, index) => (
                <button type="button" className={person.id === active.id ? "active" : ""} key={person.id} onClick={() => { setActiveId(person.id); setMode("people"); }}>
                  {personLabel(person, person.role === "parent" ? index : people.filter((p) => p.role === person.role).findIndex((p) => p.id === person.id) + 1, formSettings.labels)}
                </button>
              ))}
              <button type="button" onClick={openReview}>Review</button>
            </nav>

            <div className="field-grid">
              <Field label={formSettings.labels.firstName} error={errors[`${active.id}.firstName`]}>
                <input value={active.firstName} onChange={(event) => updatePerson("firstName", event.target.value)} autoComplete="given-name" placeholder="Example: Jamie" />
              </Field>
              <Field label={formSettings.labels.lastName} error={errors[`${active.id}.lastName`]}>
                <input value={active.lastName} onChange={(event) => updatePerson("lastName", event.target.value)} autoComplete="family-name" placeholder="Example: Anderson" />
              </Field>
              {active.role === "parent" ? (
                <>
                  <Field label={people.filter((person) => person.role === "parent")[0]?.id === active.id ? formSettings.labels.mobilePhone : `${formSettings.labels.mobilePhone} (optional)`} error={errors[`${active.id}.phone`]}>
                    <input value={active.phone} onChange={(event) => updatePerson("phone", formatPhone(event.target.value))} type="tel" inputMode="tel" autoComplete="tel" placeholder="Example: (936) 555-1234" />
                  </Field>
                  <Field label={people.filter((person) => person.role === "parent")[0]?.id === active.id ? formSettings.labels.email : `${formSettings.labels.email} (optional)`} error={errors[`${active.id}.email`]}>
                    <input value={active.email} onChange={(event) => updatePerson("email", event.target.value)} type="email" inputMode="email" autoComplete="email" placeholder="Example: jamie@email.com" />
                  </Field>
                </>
              ) : null}
              <Field label={formSettings.labels.birthdate} error={errors[`${active.id}.birthdate`]} wide={active.role !== "parent"}>
                <input value={active.birthdate} onChange={(event) => updatePerson("birthdate", event.target.value)} type="date" autoComplete="bday" />
              </Field>
              {active.role === "child" ? <>
                <label className="option-card wide"><input type="checkbox" checked={Boolean(active.hasAllergies)} onChange={(event) => updatePerson("hasAllergies", event.target.checked)} /><span>{formSettings.labels.allergies}</span></label>
                {active.hasAllergies ? <Field label={formSettings.labels.allergyDetails} wide><textarea value={active.allergyDetails ?? ""} onChange={(event) => updatePerson("allergyDetails", event.target.value)} rows={3} /></Field> : null}
                <label className="option-card wide"><input type="checkbox" checked={Boolean(active.hasSpecialNeeds)} onChange={(event) => updatePerson("hasSpecialNeeds", event.target.checked)} /><span>{formSettings.labels.specialNeeds}</span></label>
                {active.hasSpecialNeeds ? <Field label={formSettings.labels.specialNeedsDetails} wide><textarea value={active.specialNeedsDetails ?? ""} onChange={(event) => updatePerson("specialNeedsDetails", event.target.value)} rows={3} /></Field> : null}
              </> : null}
              {activeIndex === 0 ? (
                <>
                  <Field label={formSettings.labels.streetAddress} error={errors["address.line1"]} wide>
                    <div className="address-autocomplete">
                      <input value={address.line1} onChange={(event) => { setAddress({ ...address, line1: event.target.value }); setAddressAutocompleteDismissed(false); }} autoComplete="address-line1" placeholder="123 Main Street" role="combobox" aria-autocomplete="list" aria-controls="address-suggestions" aria-expanded={Boolean(addressSuggestions.length)} />
                      {addressSuggestions.length ? <div id="address-suggestions" className="address-suggestions" role="listbox">{addressSuggestions.map((suggestion) => <button type="button" role="option" aria-selected="false" key={suggestion.id} onClick={() => chooseAddress(suggestion)}><strong>{suggestion.primary}</strong><span>{suggestion.secondary}</span></button>)}<small>Powered by Google</small></div> : null}
                    </div>
                  </Field>
                  <Field label={formSettings.labels.addressLine2} wide>
                    <input value={address.line2} onChange={(event) => setAddress({ ...address, line2: event.target.value })} autoComplete="address-line2" />
                  </Field>
                  <Field label={formSettings.labels.city} error={errors["address.city"]}>
                    <input value={address.city} onChange={(event) => setAddress({ ...address, city: event.target.value })} autoComplete="address-level2" placeholder="Conroe" />
                  </Field>
                  <div className="field-pair">
                    <Field label={formSettings.labels.state} error={errors["address.state"]}>
                      <input value={address.state} onChange={(event) => setAddress({ ...address, state: event.target.value.toUpperCase().slice(0, 2) })} autoComplete="address-level1" />
                    </Field>
                    <Field label={formSettings.labels.postalCode} error={errors["address.postalCode"]}>
                      <input value={address.postalCode} onChange={(event) => setAddress({ ...address, postalCode: event.target.value.replace(/[^\d-]/g, "").slice(0, 10) })} inputMode="numeric" autoComplete="postal-code" />
                    </Field>
                  </div>
                </>
              ) : null}
            </div>

            <button className="primary-button" type="submit">{people[activeIndex + 1] ? "Save & next person" : "Continue to review"}<span aria-hidden="true">→</span></button>
            <div className="add-row">
              {parentCount < 2 ? <button type="button" className="add-button" onClick={() => addPerson("parent")}>+ Add {formSettings.labels.parent2.toLowerCase()}</button> : null}
              <button type="button" className="add-button" onClick={() => addPerson("child")}>+ Add {formSettings.labels.child.toLowerCase()}</button>
              <button type="button" className="add-button" onClick={() => addPerson("guardian")}>+ Add {formSettings.labels.guardian.toLowerCase()}</button>
            </div>
            <p className="help-note">{branding.helpText}</p>
          </form>
        ) : mode === "household" ? (
          <form className="form-content" onSubmit={(event) => { event.preventDefault(); saveHousehold(); }} noValidate>
            <p className="eyebrow">{branding.eyebrow}</p>
            <div className="section-heading-row"><div><h2>Household</h2><p>Household name and shared address</p></div></div>
            <nav className="person-tabs" aria-label="Household members"><button type="button" className="active">Household</button>{people.map((person, index) => <button type="button" key={person.id} onClick={() => { setActiveId(person.id); setMode("people"); }}>{personLabel(person, person.role === "parent" ? index : people.filter((candidate) => candidate.role === person.role).findIndex((candidate) => candidate.id === person.id) + 1, formSettings.labels)}</button>)}<button type="button" onClick={openReview}>Review</button></nav>
            <div className="field-grid">
              <Field label={formSettings.labels.householdName} error={errors["household.name"]} wide><input value={householdName} onChange={(event) => { setHouseholdName(event.target.value); setHouseholdNameEdited(true); }} placeholder="Anderson Household" /></Field>
              <Field label={formSettings.labels.streetAddress} error={errors["address.line1"]} wide><div className="address-autocomplete"><input value={address.line1} onChange={(event) => { setAddress({ ...address, line1: event.target.value }); setAddressAutocompleteDismissed(false); }} autoComplete="address-line1" placeholder="123 Main Street" role="combobox" aria-autocomplete="list" aria-controls="household-address-suggestions" aria-expanded={Boolean(addressSuggestions.length)} />{addressSuggestions.length ? <div id="household-address-suggestions" className="address-suggestions" role="listbox">{addressSuggestions.map((suggestion) => <button type="button" role="option" aria-selected="false" key={suggestion.id} onClick={() => chooseAddress(suggestion)}><strong>{suggestion.primary}</strong><span>{suggestion.secondary}</span></button>)}<small>Powered by Google</small></div> : null}</div></Field>
              <Field label={formSettings.labels.addressLine2} wide><input value={address.line2} onChange={(event) => setAddress({ ...address, line2: event.target.value })} autoComplete="address-line2" /></Field>
              <Field label={formSettings.labels.city} error={errors["address.city"]}><input value={address.city} onChange={(event) => setAddress({ ...address, city: event.target.value })} autoComplete="address-level2" placeholder="Conroe" /></Field>
              <div className="field-pair"><Field label={formSettings.labels.state} error={errors["address.state"]}><input value={address.state} onChange={(event) => setAddress({ ...address, state: event.target.value.toUpperCase().slice(0, 2) })} autoComplete="address-level1" /></Field><Field label={formSettings.labels.postalCode} error={errors["address.postalCode"]}><input value={address.postalCode} onChange={(event) => setAddress({ ...address, postalCode: event.target.value.replace(/[^\d-]/g, "").slice(0, 10) })} inputMode="numeric" autoComplete="postal-code" /></Field></div>
            </div>
            <button className="primary-button" type="submit">Save household & return to review<span aria-hidden="true">→</span></button>
            <button className="text-button review-back" type="button" onClick={() => setMode("review")}>Cancel</button>
          </form>
        ) : (
          <section className="form-content review-content">
            <p className="eyebrow">{branding.eyebrow}</p>
            <h2>{branding.reviewTitle}</h2>
            <p className="heading-note">{branding.reviewBody}</p>
            <div className="review-list">
              <button type="button" onClick={() => setMode("household")}>
                <span className="review-avatar">HH</span>
                <span><strong>{householdName || `${people[0].lastName || "Family"} Household`}</strong><small>{address.line1 || "Address needed"}{address.city ? ` · ${address.city}, ${address.state} ${address.postalCode}` : ""}</small></span>
                <span aria-hidden="true">Edit</span>
              </button>
              {people.map((person, index) => (
                <button key={person.id} type="button" onClick={() => { setActiveId(person.id); setMode("people"); }}>
                  <span className="review-avatar">{person.firstName.charAt(0)}{person.lastName.charAt(0)}</span>
                  <span><strong>{person.firstName} {person.lastName}</strong><small>{personLabel(person, person.role === "parent" ? index : people.filter((p) => p.role === person.role).findIndex((p) => p.id === person.id) + 1, formSettings.labels)} · {person.birthdate || "DOB needed"}{person.role === "child" && person.hasAllergies ? " · Allergies noted" : ""}{person.role === "child" && person.hasSpecialNeeds ? " · Additional needs noted" : ""}</small></span>
                  <span aria-hidden="true">Edit</span>
                </button>
              ))}
            </div>
            {errors.submit ? <p className="submit-error" role="alert">{errors.submit}</p> : null}
            <button className="primary-button" type="button" disabled={busy} onClick={() => submit()}>{busy ? "Saving securely…" : branding.submitLabel}<span aria-hidden="true">→</span></button>
            <button className="text-button review-back" type="button" onClick={() => { setActiveId(people[0].id); setMode("people"); }}>Back to household</button>
          </section>
        )}
      </section>

      {duplicateMatches.length ? (
        <div className="modal-backdrop" role="presentation">
          <section className="duplicate-modal" role="dialog" aria-modal="true" aria-labelledby="match-title">
            <p className="eyebrow">Before we finish</p>
            <h2 id="match-title">Is this your family?</h2>
            <p>We found {duplicateMatches.length === 1 ? "a record" : "records"} with similar contact information.</p>
            <div className="match-list">
              {duplicateMatches.map((match) => (
                <article key={match.id}>
                  <strong>{match.name}</strong>
                  <span>{[match.email, match.phone].filter(Boolean).join(" · ")}</span>
                  {match.household.length ? <small>Household: {match.household.join(", ")}</small> : null}
                </article>
              ))}
            </div>
            {errors.submit ? <p className="submit-error" role="alert">{errors.submit}</p> : null}
            <div className="modal-actions">
              <button className="primary-button" type="button" disabled={busy} onClick={() => resolveDuplicate(true)}>Yes, that’s us</button>
              <button className="secondary-button" type="button" disabled={busy} onClick={() => resolveDuplicate(false)}>No, we’re new here</button>
            </div>
          </section>
        </div>
      ) : null}
    </main>
  );
}

function Field({ label, error, wide = false, children }: { label: string; error?: string; wide?: boolean; children: React.ReactNode }) {
  return (
    <label className={`field ${wide ? "wide" : ""} ${error ? "invalid" : ""}`}>
      <span>{label}</span>
      {children}
      {error ? <small role="alert">{error}</small> : null}
    </label>
  );
}
