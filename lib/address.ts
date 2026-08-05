import { getRuntimeEnv } from "./runtime-env";

type GoogleAddressComponent = { longText?: string; shortText?: string; types?: string[] };

function mapsKey() {
  const value = getRuntimeEnv().GOOGLE_MAPS_API_KEY;
  return typeof value === "string" ? value.trim() : "";
}

export function addressAutocompleteConfigured() {
  return Boolean(mapsKey());
}

async function googleRequest(url: string, init: RequestInit) {
  const response = await fetch(url, {
    ...init,
    headers: {
      "content-type": "application/json",
      "X-Goog-Api-Key": mapsKey(),
      ...(init.headers ?? {}),
    },
  });
  const body = await response.text();
  if (!response.ok) throw new Error(`Google Places returned ${response.status}: ${body.slice(0, 500)}`);
  return body ? JSON.parse(body) as Record<string, unknown> : {};
}

export async function suggestAddresses(input: string, sessionToken?: string) {
  const result = await googleRequest("https://places.googleapis.com/v1/places:autocomplete", {
    method: "POST",
    headers: { "X-Goog-FieldMask": "suggestions.placePrediction.placeId,suggestions.placePrediction.text.text,suggestions.placePrediction.structuredFormat" },
    body: JSON.stringify({ input, sessionToken, includedRegionCodes: ["us"], languageCode: "en", regionCode: "us" }),
  });
  const suggestions = Array.isArray(result.suggestions) ? result.suggestions : [];
  return suggestions.flatMap((entry) => {
    const prediction = (entry as { placePrediction?: { placeId?: string; text?: { text?: string }; structuredFormat?: { mainText?: { text?: string }; secondaryText?: { text?: string } } } }).placePrediction;
    if (!prediction?.placeId || !prediction.text?.text) return [];
    return [{ id: prediction.placeId, label: prediction.text.text, primary: prediction.structuredFormat?.mainText?.text ?? prediction.text.text, secondary: prediction.structuredFormat?.secondaryText?.text ?? "" }];
  });
}

export async function getAddressDetails(placeId: string, sessionToken?: string) {
  const query = sessionToken ? `?sessionToken=${encodeURIComponent(sessionToken)}` : "";
  const result = await googleRequest(`https://places.googleapis.com/v1/places/${encodeURIComponent(placeId)}${query}`, {
    method: "GET",
    headers: { "X-Goog-FieldMask": "addressComponents,formattedAddress" },
  });
  const components = Array.isArray(result.addressComponents) ? result.addressComponents as GoogleAddressComponent[] : [];
  const component = (type: string, short = false) => {
    const match = components.find((item) => item.types?.includes(type));
    return (short ? match?.shortText : match?.longText) ?? "";
  };
  const number = component("street_number");
  const route = component("route");
  const postal = [component("postal_code"), component("postal_code_suffix")].filter(Boolean).join("-");
  return {
    line1: [number, route].filter(Boolean).join(" "),
    line2: "",
    city: component("locality") || component("postal_town") || component("sublocality"),
    state: component("administrative_area_level_1", true),
    postalCode: postal,
    formattedAddress: typeof result.formattedAddress === "string" ? result.formattedAddress : "",
  };
}
