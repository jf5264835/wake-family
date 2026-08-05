import type { BrandingSettings, FamilyFormSettings, FormDefinition } from "./types";

export const WAKE_BRAND_STANDARDS_VERSION = "1.0";

export const defaultBranding: BrandingSettings = {
  brandStandardsVersion: WAKE_BRAND_STANDARDS_VERSION,
  churchName: "Wake Church",
  eyebrow: "New family registration",
  welcomeTitle: "welcome\nhome",
  welcomeBody: "Tell us about your household so we can help your family get connected.",
  helpText: "Need help or already connected? Ask a volunteer.",
  reviewTitle: "Review your household",
  reviewBody: "Choose the household or any person to make changes before submitting.",
  submitLabel: "Submit family registration",
  successTitle: "Welcome home.",
  successBody: "Your family’s information has been saved. We’re glad you’re here.",
  assistanceTitle: "Please see a volunteer.",
  assistanceBody: "We found an existing record and want to make sure we update the right family.",
  logoUrl: "/wake-mark-cream.png",
  logoAltText: "Wake Church W mark",
  backgroundImageUrl: "",
  primaryColor: "#171717",
  accentColor: "#405A51",
  panelColor: "#262725",
  formBackgroundColor: "#F6F2EF",
  textColor: "#171717",
  fontStyle: "editorial",
  cornerStyle: "square",
  panelOverlayOpacity: 78,
};

const brandControlledDefaults: Pick<BrandingSettings,
  | "brandStandardsVersion"
  | "logoUrl"
  | "logoAltText"
  | "primaryColor"
  | "accentColor"
  | "panelColor"
  | "formBackgroundColor"
  | "textColor"
  | "fontStyle"
  | "cornerStyle"
  | "panelOverlayOpacity"
> = {
  brandStandardsVersion: defaultBranding.brandStandardsVersion,
  logoUrl: defaultBranding.logoUrl,
  logoAltText: defaultBranding.logoAltText,
  primaryColor: defaultBranding.primaryColor,
  accentColor: defaultBranding.accentColor,
  panelColor: defaultBranding.panelColor,
  formBackgroundColor: defaultBranding.formBackgroundColor,
  textColor: defaultBranding.textColor,
  fontStyle: defaultBranding.fontStyle,
  cornerStyle: defaultBranding.cornerStyle,
  panelOverlayOpacity: defaultBranding.panelOverlayOpacity,
};

export function resolveBranding(saved?: Partial<BrandingSettings> | null): BrandingSettings {
  if (!saved) return defaultBranding;
  if (saved.brandStandardsVersion === WAKE_BRAND_STANDARDS_VERSION) return { ...defaultBranding, ...saved };

  return {
    ...defaultBranding,
    ...saved,
    ...brandControlledDefaults,
    logoUrl: saved.logoUrl || defaultBranding.logoUrl,
    logoAltText: saved.logoAltText || defaultBranding.logoAltText,
  };
}

export const defaultFamilyFormSettings: FamilyFormSettings = {
  labels: {
    parent1: "Parent 1",
    parent2: "Parent 2",
    child: "Child",
    guardian: "Guardian",
    firstName: "First name",
    lastName: "Last name",
    mobilePhone: "Mobile phone",
    email: "Email",
    birthdate: "Date of birth",
    householdName: "Household name",
    streetAddress: "Street address",
    addressLine2: "Apartment, suite, etc. (optional)",
    city: "City",
    state: "State",
    postalCode: "ZIP code",
    allergies: "Does this child have any allergies?",
    allergyDetails: "Allergy details (optional)",
    specialNeeds: "Does this child have any special needs?",
    specialNeedsDetails: "Additional information (optional)",
  },
  mappings: {
    allergies: { fieldDefinitionId: "", fieldLabel: "", trueValue: "Yes", falseValue: "No" },
    allergyDetails: { fieldDefinitionId: "", fieldLabel: "" },
    specialNeeds: { fieldDefinitionId: "", fieldLabel: "", trueValue: "Yes", falseValue: "No" },
    specialNeedsDetails: { fieldDefinitionId: "", fieldLabel: "" },
  },
};

export const defaultFormDefinition: FormDefinition = {
  fields: [
    { id: "first_name", label: "First name", type: "text", required: true, pcoMapping: "person.first_name" },
    { id: "last_name", label: "Last name", type: "text", required: true, pcoMapping: "person.last_name" },
    { id: "email", label: "Email", type: "email", required: true, pcoMapping: "email.address" },
    { id: "phone", label: "Mobile phone", type: "phone", required: true, pcoMapping: "phone_number.number" },
  ],
  submitLabel: "Submit form",
  successTitle: "Thank you.",
  successMessage: "Your information has been saved.",
};
