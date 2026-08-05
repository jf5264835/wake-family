import { eq } from "drizzle-orm";
import { getDb } from "../db";
import { siteSettings } from "../db/schema";
import { defaultFamilyFormSettings } from "./defaults";
import type { FamilyFormLabels, FamilyFormSettings, PcoBooleanValueMapping, PcoTextValueMapping } from "./types";

function object(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value) ? value as Record<string, unknown> : {};
}

function text(value: unknown, fallback = "") {
  return typeof value === "string" ? value.trim() : fallback;
}

function textMapping(value: unknown, fallback: PcoTextValueMapping): PcoTextValueMapping {
  const incoming = object(value);
  return {
    fieldDefinitionId: text(incoming.fieldDefinitionId, fallback.fieldDefinitionId),
    fieldLabel: text(incoming.fieldLabel, fallback.fieldLabel),
  };
}

function booleanMapping(value: unknown, fallback: PcoBooleanValueMapping): PcoBooleanValueMapping {
  const incoming = object(value);
  return {
    ...textMapping(incoming, fallback),
    trueValue: text(incoming.trueValue, fallback.trueValue),
    falseValue: text(incoming.falseValue, fallback.falseValue),
  };
}

export function normalizeFamilyFormSettings(value: unknown, legacyLabels?: unknown): FamilyFormSettings {
  const incoming = object(value);
  const labels = { ...object(legacyLabels), ...object(incoming.labels) };
  const mappings = object(incoming.mappings);
  return {
    labels: Object.fromEntries(Object.entries(defaultFamilyFormSettings.labels).map(([key, fallback]) => [key, text(labels[key], fallback)])) as FamilyFormLabels,
    mappings: {
      allergies: booleanMapping(mappings.allergies, defaultFamilyFormSettings.mappings.allergies),
      allergyDetails: textMapping(mappings.allergyDetails, defaultFamilyFormSettings.mappings.allergyDetails),
      specialNeeds: booleanMapping(mappings.specialNeeds, defaultFamilyFormSettings.mappings.specialNeeds),
      specialNeedsDetails: textMapping(mappings.specialNeedsDetails, defaultFamilyFormSettings.mappings.specialNeedsDetails),
    },
  };
}

export async function getFamilyFormSettings() {
  const db = getDb();
  const [row] = await db.select().from(siteSettings).where(eq(siteSettings.id, "family-form")).limit(1);
  if (row) {
    try { return normalizeFamilyFormSettings(JSON.parse(row.settings)); } catch { return normalizeFamilyFormSettings({}); }
  }
  const [brandingRow] = await db.select().from(siteSettings).where(eq(siteSettings.id, "default")).limit(1);
  if (!brandingRow) return normalizeFamilyFormSettings({});
  try {
    const legacy = JSON.parse(brandingRow.settings) as Record<string, unknown>;
    return normalizeFamilyFormSettings({}, legacy.familyFormLabels);
  } catch {
    return normalizeFamilyFormSettings({});
  }
}
