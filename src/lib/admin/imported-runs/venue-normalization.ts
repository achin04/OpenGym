export function normalizeAdminPostalCode(value: string | null | undefined) {
  const normalized = (value ?? "").normalize("NFKC").trim();

  if (normalized === "") {
    return "";
  }

  const compact = normalized.replaceAll(/\s+/g, "").toUpperCase();

  if (
    /^[ABCEGHJ-NPRSTVXY]\d[ABCEGHJ-NPRSTV-Z]\d[ABCEGHJ-NPRSTV-Z]\d$/.test(
      compact,
    )
  ) {
    return `${compact.slice(0, 3)} ${compact.slice(3)}`;
  }

  return normalized.toUpperCase();
}

export function normalizeVenueDuplicateText(value: string | null | undefined) {
  const normalized = (value ?? "")
    .normalize("NFKC")
    .trim()
    .toLowerCase()
    .replaceAll(/[.,]/g, "")
    .replaceAll(/\s+/g, " ");

  return normalized === "" ? null : normalized;
}

export function normalizeVenueDuplicatePostalCode(
  value: string | null | undefined,
) {
  const normalized = normalizeAdminPostalCode(value);

  return normalized === "" ? null : normalized;
}

export type DuplicateVenueInput = {
  name: string;
  addressLine1: string;
  city: string;
  postalCode?: string | null;
};

export type DuplicateVenueCandidate = {
  name: string;
  addressLine1: string;
  city: string;
  postalCode: string | null;
};

export function likelyDuplicateVenue(
  input: DuplicateVenueInput,
  venue: DuplicateVenueCandidate,
) {
  const inputCity = normalizeVenueDuplicateText(input.city);
  const venueCity = normalizeVenueDuplicateText(venue.city);

  if (!inputCity || inputCity !== venueCity) {
    return false;
  }

  const inputPostalCode = normalizeVenueDuplicatePostalCode(input.postalCode);
  const venuePostalCode = normalizeVenueDuplicatePostalCode(venue.postalCode);
  const postalCodesMatch =
    inputPostalCode !== null && inputPostalCode === venuePostalCode;

  if (!postalCodesMatch) {
    return false;
  }

  return (
    normalizeVenueDuplicateText(input.name) ===
      normalizeVenueDuplicateText(venue.name) ||
    normalizeVenueDuplicateText(input.addressLine1) ===
      normalizeVenueDuplicateText(venue.addressLine1)
  );
}
