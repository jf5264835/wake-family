export type PersonRole = "parent" | "child" | "guardian";

export type PersonInput = {
  id?: string;
  role: PersonRole;
  firstName: string;
  lastName: string;
  birthdate: string;
  email?: string;
  phone?: string;
  hasAllergies?: boolean;
  allergyDetails?: string;
  hasSpecialNeeds?: boolean;
  specialNeedsDetails?: string;
};

export type AddressInput = {
  line1: string;
  line2?: string;
  city: string;
  state: string;
  postalCode: string;
};

export type RegistrationInput = {
  people: PersonInput[];
  address: AddressInput;
  householdName?: string;
  customFields?: Record<string, string | boolean | string[]>;
};

export type DuplicateMatch = {
  id: string;
  name: string;
  email: string | null;
  phone: string | null;
  household: string[];
};

export type BrandingSettings = {
  brandStandardsVersion: string;
  churchName: string;
  eyebrow: string;
  welcomeTitle: string;
  welcomeBody: string;
  helpText: string;
  reviewTitle: string;
  reviewBody: string;
  submitLabel: string;
  successTitle: string;
  successBody: string;
  assistanceTitle: string;
  assistanceBody: string;
  logoUrl: string;
  logoAltText: string;
  backgroundImageUrl: string;
  primaryColor: string;
  accentColor: string;
  panelColor: string;
  formBackgroundColor: string;
  textColor: string;
  fontStyle: "editorial" | "modern" | "classic";
  cornerStyle: "soft" | "rounded" | "square";
  panelOverlayOpacity: number;
};

export type FamilyFormLabels = {
  parent1: string;
  parent2: string;
  child: string;
  guardian: string;
  firstName: string;
  lastName: string;
  mobilePhone: string;
  email: string;
  birthdate: string;
  householdName: string;
  streetAddress: string;
  addressLine2: string;
  city: string;
  state: string;
  postalCode: string;
  allergies: string;
  allergyDetails: string;
  specialNeeds: string;
  specialNeedsDetails: string;
};

export type PcoTextValueMapping = {
  fieldDefinitionId: string;
  fieldLabel: string;
};

export type PcoBooleanValueMapping = PcoTextValueMapping & {
  trueValue: string;
  falseValue: string;
};

export type FamilyFormSettings = {
  labels: FamilyFormLabels;
  mappings: {
    allergies: PcoBooleanValueMapping;
    allergyDetails: PcoTextValueMapping;
    specialNeeds: PcoBooleanValueMapping;
    specialNeedsDetails: PcoTextValueMapping;
  };
};

export type AdminTab = "transactions" | "forms" | "registration" | "branding" | "system";
export type AdminAction = "read" | "write";
export type AdminPermissions = Record<AdminTab, Record<AdminAction, boolean>>;

export type AdminAuthSettings = {
  localAuthEnabled: boolean;
  samlEnabled: boolean;
  samlGroupClaim: string;
};

export type PcoOptionSource = {
  type: "manual" | "pco_field" | "pco_list";
  resourceId?: string;
  resourceLabel?: string;
};

export type FormField = {
  id: string;
  label: string;
  type: "text" | "email" | "phone" | "date" | "select" | "checkbox" | "textarea";
  required: boolean;
  placeholder?: string;
  options?: string[];
  optionSource?: PcoOptionSource;
  validation?: {
    minLength?: number;
    maxLength?: number;
    pattern?: string;
    minAge?: number;
    maxAge?: number;
    customMessage?: string;
  };
  pcoMapping?: string;
};

export type PcoCatalogItem = {
  id: string;
  label: string;
  kind: "field" | "list";
  mapping: string;
  options?: string[];
  dataType?: string;
};

export type FormDefinition = {
  fields: FormField[];
  submitLabel: string;
  successTitle: string;
  successMessage: string;
};
