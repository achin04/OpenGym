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
