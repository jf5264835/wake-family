import type { DuplicateMatch, FamilyFormSettings, PcoCatalogItem, RegistrationInput } from "./types";
import { getRuntimeEnv } from "./runtime-env";

type JsonApiResource = {
  id: string;
  type: string;
  attributes?: Record<string, unknown>;
  relationships?: Record<string, { data?: { id: string; type: string } | Array<{ id: string; type: string }> }>;
};

type JsonApiDocument = {
  data: JsonApiResource | JsonApiResource[];
  included?: JsonApiResource[];
};

type IntegrationState = {
  people?: Record<string, string>;
  householdId?: string;
  completedSteps?: string[];
};

export class PcoError extends Error {
  status: number;
  endpoint: string;
  responseBody: string;
  requestId: string | null;

  constructor(message: string, status: number, endpoint: string, responseBody: string, requestId: string | null) {
    super(message);
    this.name = "PcoError";
    this.status = status;
    this.endpoint = endpoint;
    this.responseBody = responseBody;
    this.requestId = requestId;
  }

  details() {
    return { status: this.status, endpoint: this.endpoint, responseBody: this.responseBody, requestId: this.requestId };
  }
}

function runtimeValue(name: string) {
  const value = getRuntimeEnv()[name];
  return typeof value === "string" ? value.trim() : undefined;
}

export function pcoIsConfigured() {
  return Boolean(runtimeValue("PCO_APP_ID") && runtimeValue("PCO_SECRET"));
}

async function pcoRequest(endpoint: string, init: RequestInit = {}) {
  const appId = runtimeValue("PCO_APP_ID");
  const secret = runtimeValue("PCO_SECRET");
  if (!appId || !secret) throw new Error("Planning Center credentials are not configured.");
  const response = await fetch(`https://api.planningcenteronline.com${endpoint}`, {
    ...init,
    headers: {
      authorization: `Basic ${btoa(`${appId}:${secret}`)}`,
      accept: "application/vnd.api+json",
      ...(init.body ? { "content-type": "application/vnd.api+json" } : {}),
      ...(init.headers ?? {}),
    },
  });
  const body = await response.text();
  if (!response.ok) {
    throw new PcoError(`Planning Center returned ${response.status}.`, response.status, endpoint, body.slice(0, 12000), response.headers.get("x-request-id"));
  }
  return body ? (JSON.parse(body) as JsonApiDocument) : ({ data: [] } as JsonApiDocument);
}

function relationshipIds(resource: JsonApiResource, name: string) {
  const data = resource.relationships?.[name]?.data;
  if (!data) return [];
  return (Array.isArray(data) ? data : [data]).map((item) => item.id);
}

function resources(document: JsonApiDocument) {
  return Array.isArray(document.data) ? document.data : [document.data];
}

function maskEmail(value: string | null) {
  if (!value || !value.includes("@")) return null;
  const [local, domain] = value.split("@");
  return `${local.slice(0, 2)}***@${domain}`;
}

function maskPhone(value: string | null) {
  if (!value) return null;
  const digits = value.replace(/\D/g, "");
  return digits.length >= 4 ? `***-***-${digits.slice(-4)}` : null;
}

function mapSearchResults(document: JsonApiDocument): DuplicateMatch[] {
  const people = Array.isArray(document.data) ? document.data : [document.data];
  const included = document.included ?? [];
  const byId = new Map(included.map((resource) => [`${resource.type}:${resource.id}`, resource]));
  return people.filter(Boolean).map((person) => {
    const email = relationshipIds(person, "emails")
      .map((id) => byId.get(`Email:${id}`)?.attributes?.address)
      .find((value) => typeof value === "string") as string | undefined;
    const phone = relationshipIds(person, "phone_numbers")
      .map((id) => byId.get(`PhoneNumber:${id}`)?.attributes?.number)
      .find((value) => typeof value === "string") as string | undefined;
    const householdIds = relationshipIds(person, "households");
    const householdMemberIds = householdIds.flatMap((id) => {
      const household = byId.get(`Household:${id}`);
      return household ? relationshipIds(household, "people") : [];
    });
    const household = householdMemberIds
      .map((id) => byId.get(`Person:${id}`)?.attributes?.first_name)
      .filter((value): value is string => typeof value === "string");
    const firstName = String(person.attributes?.first_name ?? "").trim();
    const lastName = String(person.attributes?.last_name ?? "").trim();
    return {
      id: person.id,
      name: `${firstName} ${lastName}`.trim() || "Existing person",
      email: maskEmail(email ?? null),
      phone: maskPhone(phone ?? null),
      household: [...new Set(household)],
    };
  });
}

export async function searchPcoDuplicates(email: string, phone: string) {
  const queries = [...new Set([email.trim().toLowerCase(), phone.replace(/\D/g, "")].filter(Boolean))];
  const results = await Promise.all(
    queries.map((query) =>
      pcoRequest(`/people/v2/people?where[search_name_or_email]=${encodeURIComponent(query)}&include=emails,phone_numbers,households&per_page=25`),
    ),
  );
  const matches = results.flatMap(mapSearchResults);
  return [...new Map(matches.map((match) => [match.id, match])).values()];
}

export async function fetchPcoCatalog(): Promise<PcoCatalogItem[]> {
  const [fieldDocument, listDocument] = await Promise.all([
    pcoRequest("/people/v2/field_definitions?include=field_options&per_page=100"),
    pcoRequest("/people/v2/lists?per_page=100"),
  ]);
  const included = fieldDocument.included ?? [];
  const includedById = new Map(included.map((resource) => [`${resource.type.toLowerCase()}:${resource.id}`, resource]));
  const fields = resources(fieldDocument).filter(Boolean).map((field) => {
    const optionIds = relationshipIds(field, "field_options");
    const options = optionIds.map((id) => includedById.get(`fieldoption:${id}`)?.attributes?.value ?? includedById.get(`field_option:${id}`)?.attributes?.value)
      .filter((value): value is string => typeof value === "string" && Boolean(value.trim()));
    const label = String(field.attributes?.name ?? field.attributes?.label ?? `Custom field ${field.id}`).trim();
    return { id: field.id, label, kind: "field" as const, mapping: `field_data.${field.id}`, options, dataType: String(field.attributes?.data_type ?? "") };
  });
  const lists = resources(listDocument).filter(Boolean).map((list) => ({
    id: list.id,
    label: String(list.attributes?.name ?? `List ${list.id}`).trim(),
    kind: "list" as const,
    mapping: `list.${list.id}`,
  }));
  return [...fields, ...lists].sort((a, b) => a.label.localeCompare(b.label));
}

async function createResource(endpoint: string, type: string, attributes: Record<string, unknown>) {
  const response = await pcoRequest(endpoint, {
    method: "POST",
    body: JSON.stringify({ data: { type, attributes } }),
  });
  const resource = Array.isArray(response.data) ? response.data[0] : response.data;
  if (!resource?.id) throw new Error(`Planning Center did not return an id for ${type}.`);
  return resource.id;
}

export async function syncFamilyToPco(
  registration: RegistrationInput,
  initialState: IntegrationState,
  persistState: (state: IntegrationState, message: string, details?: unknown) => Promise<void>,
  mappings: FamilyFormSettings["mappings"],
) {
  const state: IntegrationState = {
    people: { ...(initialState.people ?? {}) },
    householdId: initialState.householdId,
    completedSteps: [...(initialState.completedSteps ?? [])],
  };
  const primary = registration.people.find((person) => person.role === "parent") ?? registration.people[0];

  for (const [index, person] of registration.people.entries()) {
    const key = person.id || `person-${index}`;
    let personId = state.people?.[key];
    if (!personId) {
      personId = await createResource("/people/v2/people", "Person", {
        first_name: person.firstName,
        last_name: person.lastName,
        birthdate: person.birthdate,
      });
      state.people![key] = personId;
      await persistState(state, `Created ${person.role} in Planning Center.`, { pcoPersonId: personId, personIndex: index });
    }

    const completed = new Set(state.completedSteps);
    if (person.role === "parent" && person.email && !completed.has(`${key}:email`)) {
      await createResource(`/people/v2/people/${personId}/emails`, "Email", { address: person.email, location: "Home", primary: true });
      completed.add(`${key}:email`);
      state.completedSteps = [...completed];
      await persistState(state, "Added email to Planning Center person.", { pcoPersonId: personId });
    }
    if (person.role === "parent" && person.phone && !completed.has(`${key}:phone`)) {
      await createResource(`/people/v2/people/${personId}/phone_numbers`, "PhoneNumber", { number: person.phone, location: "Mobile", primary: true });
      completed.add(`${key}:phone`);
      state.completedSteps = [...completed];
      await persistState(state, "Added phone to Planning Center person.", { pcoPersonId: personId });
    }
    if (person === primary && !completed.has(`${key}:address`)) {
      await createResource(`/people/v2/people/${personId}/addresses`, "Address", {
        street: [registration.address.line1, registration.address.line2].filter(Boolean).join("\n"),
        city: registration.address.city,
        state: registration.address.state,
        zip: registration.address.postalCode,
        location: "Home",
        primary: true,
      });
      completed.add(`${key}:address`);
      state.completedSteps = [...completed];
      await persistState(state, "Added household address to primary person.", { pcoPersonId: personId });
    }
    if (person.role === "child") {
      const mappedValues = [
        { source: "allergies", mapping: mappings.allergies, value: person.hasAllergies ? mappings.allergies.trueValue : mappings.allergies.falseValue },
        { source: "allergyDetails", mapping: mappings.allergyDetails, value: person.allergyDetails ?? "" },
        { source: "specialNeeds", mapping: mappings.specialNeeds, value: person.hasSpecialNeeds ? mappings.specialNeeds.trueValue : mappings.specialNeeds.falseValue },
        { source: "specialNeedsDetails", mapping: mappings.specialNeedsDetails, value: person.specialNeedsDetails ?? "" },
      ];
      for (const mapped of mappedValues) {
        const fieldDefinitionId = mapped.mapping.fieldDefinitionId.trim();
        const value = mapped.value.trim();
        const step = `${key}:field:${mapped.source}:${fieldDefinitionId}`;
        if (!fieldDefinitionId || !value || completed.has(step)) continue;
        await createResource(`/people/v2/people/${personId}/field_data`, "FieldDatum", { field_definition_id: fieldDefinitionId, value });
        completed.add(step);
        state.completedSteps = [...completed];
        await persistState(state, `Mapped child ${mapped.source} to Planning Center.`, { pcoPersonId: personId, fieldDefinitionId, value });
      }
    }
  }

  if (!state.householdId) {
    state.householdId = await createResource("/people/v2/households", "Household", { name: registration.householdName || `${primary.lastName} Household` });
    await persistState(state, "Created household in Planning Center.", { pcoHouseholdId: state.householdId });
  }

  const completed = new Set(state.completedSteps);
  for (const [key, personId] of Object.entries(state.people ?? {})) {
    if (completed.has(`${key}:household`)) continue;
    await pcoRequest(`/people/v2/households/${state.householdId}/people`, {
      method: "POST",
      body: JSON.stringify({ data: { type: "Person", id: personId } }),
    });
    completed.add(`${key}:household`);
    state.completedSteps = [...completed];
    await persistState(state, "Added person to Planning Center household.", { pcoPersonId: personId, pcoHouseholdId: state.householdId });
  }

  return { state, primaryPersonId: state.people?.[primary.id || "person-0"] ?? null, householdId: state.householdId ?? null };
}

export function pcoErrorDetails(error: unknown) {
  if (error instanceof PcoError) return error.details();
  return { message: error instanceof Error ? error.message : "Unknown Planning Center error" };
}
