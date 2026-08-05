import type { FormDefinition } from "./types";
import { ageOnDate } from "./normalize";

export function normalizeFormValues(definition: FormDefinition, values: Record<string, unknown>) {
  return Object.fromEntries(definition.fields.map((field) => {
    const value = values[field.id];
    if (typeof value !== "string") return [field.id, value];
    const trimmed = value.trim().replace(/\s+/g, " ");
    if (field.type === "email") return [field.id, trimmed.toLowerCase()];
    if (field.type === "phone") return [field.id, trimmed.replace(/\D/g, "").slice(-10)];
    return [field.id, trimmed];
  }));
}

export function validateFormValues(definition: FormDefinition, values: Record<string, unknown>) {
  const errors: Record<string, string> = {};
  for (const field of definition.fields) {
    const value = values[field.id];
    const empty = value === undefined || value === null || value === "" || value === false;
    if (field.required && empty) {
      errors[field.id] = `${field.label} is required.`;
      continue;
    }
    if (empty) continue;
    const text = String(value);
    const message = field.validation?.customMessage;
    if (field.type === "email" && !/^\S+@\S+\.\S+$/.test(text)) errors[field.id] = message || `Enter a valid ${field.label.toLowerCase()}.`;
    if (field.type === "phone" && text.replace(/\D/g, "").length !== 10) errors[field.id] = message || `${field.label} must be a 10-digit phone number.`;
    if (field.validation?.minLength !== undefined && text.length < field.validation.minLength) errors[field.id] = message || `${field.label} must be at least ${field.validation.minLength} characters.`;
    if (field.validation?.maxLength !== undefined && text.length > field.validation.maxLength) errors[field.id] = message || `${field.label} must be no more than ${field.validation.maxLength} characters.`;
    if (field.validation?.pattern) {
      try {
        if (!new RegExp(field.validation.pattern).test(text)) errors[field.id] = message || `${field.label} is not in the expected format.`;
      } catch {
        errors[field.id] = `${field.label} has an invalid configured validation pattern.`;
      }
    }
    if (field.type === "date" && (field.validation?.minAge !== undefined || field.validation?.maxAge !== undefined)) {
      const age = ageOnDate(text);
      if (age === null) errors[field.id] = message || `Enter a valid ${field.label.toLowerCase()}.`;
      else if (field.validation.minAge !== undefined && age < field.validation.minAge) errors[field.id] = message || `${field.label} must be at least ${field.validation.minAge}.`;
      else if (field.validation.maxAge !== undefined && age > field.validation.maxAge) errors[field.id] = message || `${field.label} must be no more than ${field.validation.maxAge}.`;
    }
  }
  return errors;
}

export function validateFormDefinition(definition: FormDefinition) {
  const errors: string[] = [];
  if (!definition.fields.length) errors.push("Add at least one field.");
  const ids = new Set<string>();
  for (const field of definition.fields) {
    if (!field.id.trim() || ids.has(field.id)) errors.push("Every field needs a unique id.");
    ids.add(field.id);
    if (!field.label.trim()) errors.push("Every field needs a label.");
    if (field.validation?.minLength !== undefined && field.validation?.maxLength !== undefined && field.validation.minLength > field.validation.maxLength) errors.push(`${field.label}: minimum length cannot exceed maximum length.`);
    if (field.validation?.minAge !== undefined && field.validation?.maxAge !== undefined && field.validation.minAge > field.validation.maxAge) errors.push(`${field.label}: minimum age cannot exceed maximum age.`);
    if (field.validation?.pattern) {
      try { new RegExp(field.validation.pattern); } catch { errors.push(`${field.label}: regular expression is invalid.`); }
    }
  }
  return errors;
}
