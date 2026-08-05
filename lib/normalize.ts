import type { AddressInput, PersonInput, RegistrationInput } from "./types";

function titleCase(value: string) {
  return value
    .trim()
    .replace(/\s+/g, " ")
    .toLocaleLowerCase("en-US")
    .replace(/(^|[\s'-])\p{L}/gu, (letter) => letter.toLocaleUpperCase("en-US"));
}

function normalizePostalCode(value: string) {
  const cleaned = value.trim().replace(/\s+/g, "");
  const digits = cleaned.replace(/\D/g, "").slice(0, 9);
  return digits.length > 5 ? `${digits.slice(0, 5)}-${digits.slice(5)}` : digits;
}

function validDate(value: string) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return null;
  const date = new Date(`${value}T12:00:00Z`);
  return Number.isNaN(date.valueOf()) || date.toISOString().slice(0, 10) !== value ? null : date;
}

export function ageOnDate(birthdate: string, now = new Date()) {
  const birth = validDate(birthdate);
  if (!birth || birth > now) return null;
  let age = now.getUTCFullYear() - birth.getUTCFullYear();
  const month = now.getUTCMonth() - birth.getUTCMonth();
  if (month < 0 || (month === 0 && now.getUTCDate() < birth.getUTCDate())) age -= 1;
  return age;
}

function normalizePerson(person: PersonInput): PersonInput {
  const childOnly = person.role === "child";
  return {
    id: person.id,
    role: person.role,
    firstName: titleCase(person.firstName),
    lastName: titleCase(person.lastName),
    birthdate: person.birthdate.trim(),
    email: person.role === "parent" ? (person.email ?? "").trim().toLocaleLowerCase("en-US") : "",
    phone: person.role === "parent" ? (person.phone ?? "").replace(/\D/g, "").slice(-10) : "",
    hasAllergies: childOnly && Boolean(person.hasAllergies),
    allergyDetails: childOnly ? (person.allergyDetails ?? "").trim().replace(/\s+/g, " ") : "",
    hasSpecialNeeds: childOnly && Boolean(person.hasSpecialNeeds),
    specialNeedsDetails: childOnly ? (person.specialNeedsDetails ?? "").trim().replace(/\s+/g, " ") : "",
  };
}

function normalizeAddress(address: AddressInput): AddressInput {
  return {
    line1: titleCase(address.line1),
    line2: titleCase(address.line2 ?? ""),
    city: titleCase(address.city),
    state: address.state.trim().toLocaleUpperCase("en-US").slice(0, 2),
    postalCode: normalizePostalCode(address.postalCode),
  };
}

const streetSuffixes = new Set([
  "aly", "alley", "ave", "avenue", "blvd", "boulevard", "cir", "circle", "ct", "court", "dr", "drive",
  "expy", "expressway", "hwy", "highway", "ln", "lane", "pkwy", "parkway", "pl", "place", "rd", "road",
  "sq", "square", "st", "street", "ter", "terrace", "trl", "trail", "way",
]);
const directionTokens = new Set(["n", "north", "s", "south", "e", "east", "w", "west", "ne", "nw", "se", "sw"]);
const routeTokens = new Set(["fm", "cr", "sr", "us", "route", "rte", "state", "county", "highway", "hwy"]);

export function isPlausibleStreetAddress(value: string) {
  const tokens = value.trim().split(/\s+/).map((token) => token.toLocaleLowerCase("en-US").replace(/^[^\p{L}\p{N}]+|[^\p{L}\p{N}]+$/gu, "")).filter(Boolean);
  if (tokens.length < 2 || !/\d/u.test(tokens[0])) return false;
  const roadTokens = tokens.slice(1);
  const namedRoadToken = roadTokens.some((token) => /\p{L}/u.test(token) && !streetSuffixes.has(token) && !directionTokens.has(token) && !routeTokens.has(token));
  if (namedRoadToken) return true;
  return roadTokens.some((token, index) => routeTokens.has(token) && roadTokens.slice(index + 1).some((candidate) => /\d/u.test(candidate)));
}

export function normalizeRegistration(input: RegistrationInput): RegistrationInput {
  return {
    people: input.people.map(normalizePerson),
    address: normalizeAddress(input.address),
    householdName: titleCase(input.householdName || `${input.people.find((person) => person.role === "parent")?.lastName ?? ""} Household`),
    customFields: input.customFields ?? {},
  };
}

export function validateRegistration(input: RegistrationInput) {
  const errors: string[] = [];
  let birthdateNeedsVerification = false;
  if (!Array.isArray(input.people) || !input.people.length) return ["At least one person is required."];
  const parents = input.people.filter((person) => person.role === "parent");
  if (!parents.length || parents.length > 2) errors.push("One or two parents are required.");
  const parentAges: number[] = [];
  for (const [index, person] of input.people.entries()) {
    if (!person.firstName?.trim() || !person.lastName?.trim()) errors.push(`Person ${index + 1} needs a first and last name.`);
    const age = ageOnDate(person.birthdate ?? "");
    if (age === null) birthdateNeedsVerification = true;
    if (person.role === "parent") {
      parentAges.push(age ?? -1);
      if (age !== null && (age < 18 || age >= 120)) birthdateNeedsVerification = true;
      const parentPosition = parents.findIndex((candidate) => candidate === person);
      const email = person.email?.trim() ?? "";
      const phone = person.phone?.replace(/\D/g, "") ?? "";
      if (parentPosition === 0 || email) {
        if (!/^\S+@\S+\.\S+$/.test(email)) errors.push(`Parent ${parentPosition + 1} needs a valid email${parentPosition === 1 ? " when one is entered" : ""}.`);
      }
      if (parentPosition === 0 || phone) {
        if (phone.length !== 10) errors.push(`Parent ${parentPosition + 1} needs a 10-digit phone number${parentPosition === 1 ? " when one is entered" : ""}.`);
      }
    } else if (person.role === "guardian") {
      if (age !== null && (age < 18 || age >= 120)) birthdateNeedsVerification = true;
    } else if (age !== null && age >= 18) {
      birthdateNeedsVerification = true;
    }
  }
  if (parents.length === 2) {
    const email1 = parents[0].email?.trim().toLowerCase() ?? "";
    const email2 = parents[1].email?.trim().toLowerCase() ?? "";
    const phone1 = parents[0].phone?.replace(/\D/g, "") ?? "";
    const phone2 = parents[1].phone?.replace(/\D/g, "") ?? "";
    if (email1 && email2 && email1 === email2) errors.push("Parent emails must be different.");
    if (phone1 && phone2 && phone1 === phone2) errors.push("Parent phone numbers must be different.");
  }
  for (const child of input.people.filter((person) => person.role === "child")) {
    const childAge = ageOnDate(child.birthdate);
    if (childAge !== null && parentAges.some((parentAge) => parentAge >= 0 && childAge >= parentAge)) {
      birthdateNeedsVerification = true;
    }
  }
  if (birthdateNeedsVerification) errors.push("Please verify date of birth.");
  if (!input.householdName?.trim()) errors.push("A household name is required.");
  if (!isPlausibleStreetAddress(input.address?.line1 ?? "")) errors.push("Please enter a complete street address.");
  if (!input.address?.city?.trim()) errors.push("A city is required.");
  if (!/^[A-Za-z]{2}$/.test(input.address?.state ?? "")) errors.push("A valid state is required.");
  if (!/^\d{5}(-\d{4})?$/.test(input.address?.postalCode ?? "")) errors.push("A valid ZIP code is required.");
  return errors;
}
