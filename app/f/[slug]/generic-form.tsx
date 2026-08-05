"use client";
/* eslint-disable @next/next/no-img-element */

import { FormEvent, useEffect, useState } from "react";
import type { BrandingSettings, FormDefinition, FormField } from "../../../lib/types";
import { normalizeFormValues, validateFormValues } from "../../../lib/form-validation";
import { defaultBranding } from "../../../lib/defaults";

type PublicForm = { id: string; slug: string; name: string; description: string; definition: FormDefinition };

export function GenericForm({ slug }: { slug: string }) {
  const [branding, setBranding] = useState<BrandingSettings>(defaultBranding);
  const [form, setForm] = useState<PublicForm | null>(null);
  const [values, setValues] = useState<Record<string, string | boolean>>({});
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);
  const [done, setDone] = useState(false);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});

  useEffect(() => {
    fetch(`/api/forms/${slug}`).then(async (response) => {
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Form not found.");
      setForm(data.form);
    }).catch((reason) => setError(reason.message)).finally(() => setLoading(false));
  }, [slug]);

  useEffect(() => {
    fetch("/api/branding", { cache: "no-store" })
      .then((response) => response.ok ? response.json() : null)
      .then((data) => data?.branding && setBranding({ ...defaultBranding, ...data.branding }))
      .catch(() => undefined);
  }, []);

  async function submit(event: FormEvent) {
    event.preventDefault();
    setError("");
    const normalized = normalizeFormValues(form!.definition, values);
    const nextErrors = validateFormValues(form!.definition, normalized);
    setFieldErrors(nextErrors);
    if (Object.keys(nextErrors).length) return;
    const response = await fetch(`/api/forms/${slug}/submissions`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(normalized) });
    const data = await response.json();
    if (!response.ok) return setError(data.error || "Form could not be saved.");
    setDone(true);
  }

  const theme = {
    "--brand-primary": branding.primaryColor,
    "--brand-accent": branding.accentColor,
    "--brand-panel": branding.panelColor,
    "--paper": branding.formBackgroundColor,
    "--ink": branding.textColor,
  } as React.CSSProperties;
  const brandMark = branding.logoUrl === "/wake-mark-cream.png" ? "/wake-mark-ink.png" : branding.logoUrl;
  const shellProps = { style: theme, "data-font": branding.fontStyle, "data-corners": branding.cornerStyle };

  if (loading) return <main className="generic-form-page" {...shellProps}><section className="generic-form-card"><p>Loading form…</p></section></main>;
  if (!form) return <main className="generic-form-page" {...shellProps}><section className="generic-form-card"><h1>Form unavailable</h1><p>{error}</p></section></main>;
  if (done) return <main className="generic-form-page" {...shellProps}><section className="generic-form-card complete"><BrandLockup branding={branding} brandMark={brandMark} /><h1>{form.definition.successTitle}</h1><p>{form.definition.successMessage}</p></section></main>;
  return (
    <main className="generic-form-page" {...shellProps}>
      <form className="generic-form-card" onSubmit={submit}>
        <BrandLockup branding={branding} brandMark={brandMark} />
        <h1>{form.name}</h1>
        {form.description ? <p className="generic-description">{form.description}</p> : null}
        <div className="generic-fields">
          {form.definition.fields.map((field) => <GenericField key={field.id} field={field} value={values[field.id]} error={fieldErrors[field.id]} onChange={(value) => { setValues((current) => ({ ...current, [field.id]: value })); setFieldErrors((current) => ({ ...current, [field.id]: "" })); }} />)}
        </div>
        {error ? <p className="submit-error" role="alert">{error}</p> : null}
        <button className="primary-button" type="submit">{form.definition.submitLabel}</button>
      </form>
    </main>
  );
}

function BrandLockup({ branding, brandMark }: { branding: BrandingSettings; brandMark: string }) {
  return <div className="generic-brand-row">{brandMark ? <img src={brandMark} alt={branding.logoAltText} /> : null}<span>{branding.churchName}</span></div>;
}

function GenericField({ field, value, error, onChange }: { field: FormField; value: string | boolean | undefined; error?: string; onChange: (value: string | boolean) => void }) {
  if (field.type === "checkbox") return <label className={`generic-checkbox ${error ? "invalid" : ""}`}><input type="checkbox" checked={Boolean(value)} onChange={(event) => onChange(event.target.checked)} /><span>{field.label}{field.required ? " *" : ""}{error ? <small>{error}</small> : null}</span></label>;
  if (field.type === "select") return <label className={`field ${error ? "invalid" : ""}`}><span>{field.label}{field.required ? " *" : ""}</span><select value={String(value ?? "")} onChange={(event) => onChange(event.target.value)} required={field.required}><option value="">Choose one</option>{field.options?.map((option) => <option key={option}>{option}</option>)}</select>{error ? <small>{error}</small> : null}</label>;
  if (field.type === "textarea") return <label className={`field ${error ? "invalid" : ""}`}><span>{field.label}{field.required ? " *" : ""}</span><textarea value={String(value ?? "")} onChange={(event) => onChange(event.target.value)} required={field.required} placeholder={field.placeholder} minLength={field.validation?.minLength} maxLength={field.validation?.maxLength} />{error ? <small>{error}</small> : null}</label>;
  return <label className={`field ${error ? "invalid" : ""}`}><span>{field.label}{field.required ? " *" : ""}</span><input type={field.type === "phone" ? "tel" : field.type} value={String(value ?? "")} onChange={(event) => onChange(event.target.value)} required={field.required} placeholder={field.placeholder} minLength={field.validation?.minLength} maxLength={field.validation?.maxLength} pattern={field.validation?.pattern} />{error ? <small>{error}</small> : null}</label>;
}
