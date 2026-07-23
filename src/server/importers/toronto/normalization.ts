import { createHash } from "node:crypto";
import { z } from "zod";
import {
  AgeGroup,
  RunSourceType,
  SkillLevel,
  VenueMatchStatus,
} from "@/generated/prisma/enums";

const TORONTO_TIME_ZONE = "America/Toronto";
const TORONTO_LOCATION_URL_BASE =
  "https://www.toronto.ca/explore-enjoy/parks-recreation/places-spaces/parks-and-recreation-facilities/location/";
const TORONTO_MATCH_CITY = "toronto";

const BASKETBALL_COURSE_TITLES = new Set([
  "Basketball",
  "Basketball (Girls)",
  "Basketball (Men)",
  "Basketball (Women)",
  "Basketball with Family",
  "Parasport: Wheelchair Basketball",
]);

const sourceIntegerSchema = z.union([
  z.number().int(),
  z
    .string()
    .trim()
    .regex(/^\d+$/)
    .transform((value) => Number(value)),
]);

const sourceTextSchema = z
  .union([z.string(), z.number()])
  .transform((value) => String(value).trim());

const nonEmptySourceTextSchema = sourceTextSchema.pipe(z.string().min(1));

const sourceDateSchema = sourceTextSchema.refine(
  (value) => /^\d{4}-\d{2}-\d{2}$/.test(value),
  "Expected YYYY-MM-DD date",
);

const sourceHourSchema = sourceIntegerSchema.refine(
  (value) => value >= 0 && value <= 23,
  "Expected hour from 0 to 23",
);

const sourceMinuteSchema = sourceIntegerSchema.refine(
  (value) => value >= 0 && value <= 59,
  "Expected minute from 0 to 59",
);

export const torontoDropInRowSchema = z.object({
  _id: sourceIntegerSchema,
  "Location ID": sourceIntegerSchema,
  Course_ID: sourceIntegerSchema,
  "Course Title": nonEmptySourceTextSchema,
  Section: nonEmptySourceTextSchema,
  "Age Min": sourceTextSchema,
  "Age Max": sourceTextSchema,
  "Date Range": sourceTextSchema,
  "Start Hour": sourceHourSchema,
  "Start Minute": sourceMinuteSchema,
  "End Hour": sourceHourSchema,
  "End Min": sourceMinuteSchema,
  "First Date": sourceDateSchema,
  "Last Date": sourceDateSchema,
  DayOftheWeek: nonEmptySourceTextSchema,
});

export type TorontoDropInRow = z.infer<typeof torontoDropInRowSchema>;

export const torontoLocationRowSchema = z.object({
  _id: sourceIntegerSchema,
  "Location ID": sourceIntegerSchema,
  "Parent Location ID": sourceIntegerSchema,
  "Location Name": nonEmptySourceTextSchema,
  "Location Type": sourceTextSchema,
  Accessibility: sourceTextSchema,
  Intersection: sourceTextSchema,
  "TTC Information": sourceTextSchema,
  District: sourceTextSchema,
  "Street No": sourceTextSchema,
  "Street No Suffix": sourceTextSchema,
  "Street Name": sourceTextSchema,
  "Street Type": sourceTextSchema,
  "Street Direction": sourceTextSchema,
  "Postal Code": sourceTextSchema,
  Description: sourceTextSchema,
});

export type TorontoLocationRow = z.infer<typeof torontoLocationRowSchema>;

export function isTorontoBasketballDropInRow(row: TorontoDropInRow): boolean {
  return BASKETBALL_COURSE_TITLES.has(row["Course Title"]);
}

function buildSourceOccurrenceId(row: TorontoDropInRow): string {
  return [
    "toronto-drop-in",
    row.Course_ID,
    row["Location ID"],
    row["First Date"],
    row["Start Hour"],
    row["Start Minute"],
  ].join(":");
}

function buildSourceSeriesId(row: TorontoDropInRow): string {
  return ["toronto-drop-in", row.Course_ID, row["Location ID"]].join(":");
}

function buildSourceUrl(row: TorontoDropInRow): string {
  const url = new URL(TORONTO_LOCATION_URL_BASE);
  url.searchParams.set("id", String(row["Location ID"]));

  return url.toString();
}

function buildLocationSourceUrl(locationId: string): string {
  const url = new URL(TORONTO_LOCATION_URL_BASE);
  url.searchParams.set("id", locationId);

  return url.toString();
}

export function normalizeTorontoSourceText(value: string): string | null {
  const normalized = value.normalize("NFKC").trim().replaceAll(/\s+/g, " ");

  if (normalized === "" || normalized.toLowerCase() === "none") {
    return null;
  }

  return normalized;
}

export function normalizeTorontoPostalCode(value: string): string | null {
  const normalized = normalizeTorontoSourceText(value);

  if (!normalized) {
    return null;
  }

  const compactPostalCode = normalized.replaceAll(/\s+/g, "").toUpperCase();

  if (
    !/^[ABCEGHJ-NPRSTVXY]\d[ABCEGHJ-NPRSTV-Z]\d[ABCEGHJ-NPRSTV-Z]\d$/.test(
      compactPostalCode,
    )
  ) {
    return normalized.toUpperCase();
  }

  return `${compactPostalCode.slice(0, 3)} ${compactPostalCode.slice(3)}`;
}

function buildLocationAddressLine1(row: TorontoLocationRow): string | null {
  const addressParts = [
    row["Street No"],
    row["Street No Suffix"],
    row["Street Name"],
    row["Street Type"],
    row["Street Direction"],
  ]
    .map((part) => normalizeTorontoSourceText(part))
    .filter((part): part is string => part !== null);

  return addressParts.length > 0 ? addressParts.join(" ") : null;
}

export function normalizeTorontoLocationRow(
  row: TorontoLocationRow,
): NormalizedTorontoLocation {
  const sourceName = normalizeTorontoSourceText(row["Location Name"]);

  if (!sourceName) {
    throw new Error("Toronto location source name is required");
  }

  const sourceLocationId = String(row["Location ID"]);

  return {
    sourceLocationId,
    sourceName,
    sourceAddressLine1: buildLocationAddressLine1(row),
    sourcePostalCode: normalizeTorontoPostalCode(row["Postal Code"]),
    sourceUrl: buildLocationSourceUrl(sourceLocationId),
    rawSource: row,
  };
}

function normalizeVenueMatchText(value: string | null | undefined): string | null {
  const normalized = normalizeTorontoSourceText(value ?? "");

  if (!normalized) {
    return null;
  }

  return normalized
    .toLowerCase()
    .replaceAll(/[.,]/g, "")
    .replaceAll(/\s+/g, " ");
}

function normalizeVenueMatchPostalCode(
  value: string | null | undefined,
): string | null {
  return normalizeTorontoPostalCode(value ?? "");
}

function postalCodesAreCompatible(
  sourcePostalCode: string | null,
  venuePostalCode: string | null,
): boolean {
  return (
    sourcePostalCode === null ||
    venuePostalCode === null ||
    sourcePostalCode === venuePostalCode
  );
}

function venueMatchesTorontoLocation(
  location: NormalizedTorontoLocation,
  venue: TorontoVenueMatchCandidate,
): boolean {
  const sourceAddressLine1 = normalizeVenueMatchText(location.sourceAddressLine1);

  if (!sourceAddressLine1) {
    return false;
  }

  return (
    normalizeVenueMatchText(location.sourceName) ===
      normalizeVenueMatchText(venue.name) &&
    sourceAddressLine1 === normalizeVenueMatchText(venue.addressLine1) &&
    normalizeVenueMatchText(venue.city) === TORONTO_MATCH_CITY &&
    postalCodesAreCompatible(
      location.sourcePostalCode,
      normalizeVenueMatchPostalCode(venue.postalCode),
    )
  );
}

export function matchTorontoVenue(
  location: NormalizedTorontoLocation,
  venues: TorontoVenueMatchCandidate[],
): TorontoVenueMatchResult {
  if (!location.sourceAddressLine1) {
    return {
      status: VenueMatchStatus.PENDING,
      venueId: null,
      reason: "missing_source_address",
    };
  }

  const matches = venues.filter((venue) => {
    return venueMatchesTorontoLocation(location, venue);
  });

  if (matches.length === 1) {
    return {
      status: VenueMatchStatus.MATCHED,
      venueId: matches[0].id,
      reason: "exact_name_address",
      matchedVenue: matches[0],
    };
  }

  return {
    status: VenueMatchStatus.PENDING,
    venueId: null,
    reason: matches.length === 0 ? "no_exact_match" : "multiple_exact_matches",
  };
}

type TorontoDateTimeParts = {
  year: number;
  month: number;
  day: number;
  hour: number;
  minute: number;
};

const torontoDateTimeFormatter = new Intl.DateTimeFormat("en-CA", {
  timeZone: TORONTO_TIME_ZONE,
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
  hour: "2-digit",
  minute: "2-digit",
  hourCycle: "h23",
});

function parseSourceDateParts(date: string): Omit<TorontoDateTimeParts, "hour" | "minute"> {
  const [year, month, day] = date.split("-").map((part) => Number(part));

  return { year, month, day };
}

function getFormattedDateTimePart(
  parts: Intl.DateTimeFormatPart[],
  type: Intl.DateTimeFormatPartTypes,
): number {
  const part = parts.find((item) => item.type === type);

  if (!part || !/^\d+$/.test(part.value)) {
    throw new Error(`Could not read Toronto date/time part: ${type}`);
  }

  return Number(part.value);
}

function getTorontoDateTimeParts(date: Date): TorontoDateTimeParts {
  const parts = torontoDateTimeFormatter.formatToParts(date);

  return {
    year: getFormattedDateTimePart(parts, "year"),
    month: getFormattedDateTimePart(parts, "month"),
    day: getFormattedDateTimePart(parts, "day"),
    hour: getFormattedDateTimePart(parts, "hour"),
    minute: getFormattedDateTimePart(parts, "minute"),
  };
}

function dateTimePartsToUtcMilliseconds(parts: TorontoDateTimeParts): number {
  return Date.UTC(parts.year, parts.month - 1, parts.day, parts.hour, parts.minute);
}

function sameDateTimeParts(
  left: TorontoDateTimeParts,
  right: TorontoDateTimeParts,
): boolean {
  return (
    left.year === right.year &&
    left.month === right.month &&
    left.day === right.day &&
    left.hour === right.hour &&
    left.minute === right.minute
  );
}

export function parseTorontoLocalDateTime(
  date: string,
  hour: number,
  minute: number,
): Date {
  const sourceDateParts = parseSourceDateParts(date);
  const targetParts = { ...sourceDateParts, hour, minute };
  let candidate = new Date(dateTimePartsToUtcMilliseconds(targetParts));

  for (let attempt = 0; attempt < 3; attempt += 1) {
    const candidateParts = getTorontoDateTimeParts(candidate);

    if (sameDateTimeParts(candidateParts, targetParts)) {
      return candidate;
    }

    const deltaMilliseconds =
      dateTimePartsToUtcMilliseconds(targetParts) -
      dateTimePartsToUtcMilliseconds(candidateParts);
    candidate = new Date(candidate.getTime() + deltaMilliseconds);
  }

  throw new Error(
    `Could not convert Toronto local time ${date} ${hour}:${minute} to UTC`,
  );
}

function buildRunTimes(row: TorontoDropInRow): {
  startTime: Date;
  endTime: Date;
} {
  const startTime = parseTorontoLocalDateTime(
    row["First Date"],
    row["Start Hour"],
    row["Start Minute"],
  );
  const endTime = parseTorontoLocalDateTime(
    row["Last Date"],
    row["End Hour"],
    row["End Min"],
  );

  if (endTime <= startTime) {
    throw new Error("End time must be after start time");
  }

  return { startTime, endTime };
}

type NormalizedSourceAges = {
  sourceAgeLabel: string | null;
  sourceMinAge: number | null;
  sourceMaxAge: number | null;
  ageGroup: AgeGroup;
};

function parseSourceAge(value: string): number | null {
  if (value === "" || value.toLowerCase() === "none") {
    return null;
  }

  if (!/^\d+$/.test(value)) {
    throw new Error(`Invalid source age value: ${value}`);
  }

  return Number(value);
}

function buildSourceAgeLabel(minAge: number | null, maxAge: number | null): string | null {
  if (minAge === null && maxAge === null) {
    return null;
  }

  if (minAge !== null && maxAge !== null && minAge === maxAge) {
    return `${minAge}`;
  }

  if (minAge !== null && maxAge === null) {
    return `${minAge}+`;
  }

  if (minAge === null && maxAge !== null) {
    return `Up to ${maxAge}`;
  }

  return `${minAge}-${maxAge}`;
}

function mapAgeGroup(
  row: TorontoDropInRow,
  minAge: number | null,
  maxAge: number | null,
): AgeGroup {
  if (row["Course Title"] === "Basketball with Family") {
    return AgeGroup.ALL_AGES;
  }

  if (minAge !== null && minAge >= 60) {
    return AgeGroup.SENIOR;
  }

  if (maxAge !== null && maxAge <= 18) {
    return AgeGroup.YOUTH;
  }

  return AgeGroup.ADULT;
}

function normalizeSourceAges(row: TorontoDropInRow): NormalizedSourceAges {
  const sourceMinAge = parseSourceAge(row["Age Min"]);
  const sourceMaxAge = parseSourceAge(row["Age Max"]);

  if (
    sourceMinAge !== null &&
    sourceMaxAge !== null &&
    sourceMaxAge < sourceMinAge
  ) {
    throw new Error(
      `Source max age ${sourceMaxAge} is less than source min age ${sourceMinAge}`,
    );
  }

  return {
    sourceAgeLabel: buildSourceAgeLabel(sourceMinAge, sourceMaxAge),
    sourceMinAge,
    sourceMaxAge,
    ageGroup: mapAgeGroup(row, sourceMinAge, sourceMaxAge),
  };
}

type CanonicalJsonValue =
  | string
  | number
  | boolean
  | null
  | CanonicalJsonValue[]
  | { [key: string]: CanonicalJsonValue };

function canonicalizeJsonValue(value: CanonicalJsonValue): CanonicalJsonValue {
  if (Array.isArray(value)) {
    return value.map((item) => canonicalizeJsonValue(item));
  }

  if (value && typeof value === "object") {
    return Object.fromEntries(
      Object.entries(value)
        .sort(([leftKey], [rightKey]) => leftKey.localeCompare(rightKey))
        .map(([key, item]) => [key, canonicalizeJsonValue(item)]),
    );
  }

  return value;
}

function stableJsonStringify(value: CanonicalJsonValue): string {
  return JSON.stringify(canonicalizeJsonValue(value));
}

function createSourceFingerprint(value: CanonicalJsonValue): string {
  return createHash("sha256").update(stableJsonStringify(value)).digest("hex");
}

function buildDescription(row: TorontoDropInRow): string | null {
  return row.Section || null;
}

function buildFingerprintPayload(
  candidate: Omit<NormalizedRunCandidate, "sourceFingerprint" | "rawSource">,
): CanonicalJsonValue {
  return {
    title: candidate.title,
    description: candidate.description,
    sourceType: candidate.sourceType,
    sourceUrl: candidate.sourceUrl,
    sourceExternalId: candidate.sourceExternalId,
    sourceSeriesId: candidate.sourceSeriesId,
    startTime: candidate.startTime.toISOString(),
    endTime: candidate.endTime.toISOString(),
    price: candidate.price,
    skillLevel: candidate.skillLevel,
    ageGroup: candidate.ageGroup,
    maxPlayers: candidate.maxPlayers,
    sourceAgeLabel: candidate.sourceAgeLabel,
    sourceMinAge: candidate.sourceMinAge,
    sourceMaxAge: candidate.sourceMaxAge,
    sourceLocationId: candidate.sourceLocationId,
  };
}

export function normalizeTorontoDropInRunCandidate(
  row: TorontoDropInRow,
): NormalizedRunCandidate {
  if (!isTorontoBasketballDropInRow(row)) {
    throw new Error(`Not a basketball drop-in row: ${row["Course Title"]}`);
  }

  if (row["First Date"] !== row["Last Date"]) {
    throw new Error(
      `Expected one-day drop-in row, received ${row["First Date"]} to ${row["Last Date"]}`,
    );
  }

  const { startTime, endTime } = buildRunTimes(row);
  const sourceAges = normalizeSourceAges(row);
  const candidateWithoutFingerprint = {
    title: row["Course Title"],
    description: buildDescription(row),
    sourceType: RunSourceType.CITY,
    sourceUrl: buildSourceUrl(row),
    sourceExternalId: buildSourceOccurrenceId(row),
    sourceSeriesId: buildSourceSeriesId(row),
    startTime,
    endTime,
    price: null,
    skillLevel: SkillLevel.OPEN,
    ageGroup: sourceAges.ageGroup,
    maxPlayers: null,
    sourceAgeLabel: sourceAges.sourceAgeLabel,
    sourceMinAge: sourceAges.sourceMinAge,
    sourceMaxAge: sourceAges.sourceMaxAge,
    sourceLocationId: String(row["Location ID"]),
  } satisfies Omit<NormalizedRunCandidate, "sourceFingerprint" | "rawSource">;

  return {
    ...candidateWithoutFingerprint,
    sourceFingerprint: createSourceFingerprint(
      buildFingerprintPayload(candidateWithoutFingerprint),
    ),
    rawSource: row,
  };
}

function formatZodIssues(error: z.ZodError): string {
  return error.issues
    .map((issue) => {
      const path = issue.path.length > 0 ? issue.path.join(".") : "row";
      return `${path}: ${issue.message}`;
    })
    .join("; ");
}

function classifyNormalizationError(error: unknown): {
  reason: TorontoDropInSkipReason;
  message: string;
} {
  const message = error instanceof Error ? error.message : "Unknown normalization error";

  if (message.startsWith("Not a basketball drop-in row")) {
    return { reason: "not_basketball", message };
  }

  if (message.startsWith("Expected one-day drop-in row")) {
    return { reason: "multi_date_range", message };
  }

  if (message.includes("time") || message.includes("End time")) {
    return { reason: "invalid_time_range", message };
  }

  if (message.includes("age")) {
    return { reason: "invalid_age_range", message };
  }

  return { reason: "invalid_source_row", message };
}

export function normalizeTorontoDropInRunCandidates(
  records: unknown[],
): TorontoDropInNormalizationResult {
  const candidates: NormalizedRunCandidate[] = [];
  const skipped: TorontoDropInSkippedRow[] = [];

  for (const rawSource of records) {
    const rowResult = torontoDropInRowSchema.safeParse(rawSource);

    if (!rowResult.success) {
      skipped.push({
        reason: "invalid_source_row",
        rawSource,
        message: formatZodIssues(rowResult.error),
      });
      continue;
    }

    try {
      candidates.push(normalizeTorontoDropInRunCandidate(rowResult.data));
    } catch (error) {
      const { reason, message } = classifyNormalizationError(error);

      skipped.push({
        reason,
        rawSource,
        message,
      });
    }
  }

  return { candidates, skipped };
}

export type NormalizedRunCandidate = {
  title: string;
  description: string | null;
  sourceType: RunSourceType;
  sourceUrl: string;
  sourceExternalId: string;
  sourceSeriesId: string;
  sourceFingerprint: string;
  startTime: Date;
  endTime: Date;
  price: null;
  skillLevel: SkillLevel;
  ageGroup: AgeGroup;
  maxPlayers: null;
  sourceAgeLabel: string | null;
  sourceMinAge: number | null;
  sourceMaxAge: number | null;
  sourceLocationId: string;
  rawSource: TorontoDropInRow;
};

export type NormalizedTorontoLocation = {
  sourceLocationId: string;
  sourceName: string;
  sourceAddressLine1: string | null;
  sourcePostalCode: string | null;
  sourceUrl: string;
  rawSource: TorontoLocationRow;
};

export type TorontoVenueMatchCandidate = {
  id: string;
  name: string;
  addressLine1: string;
  city: string;
  postalCode: string | null;
};

export type TorontoVenueMatchResult =
  | {
      status: typeof VenueMatchStatus.MATCHED;
      venueId: string;
      reason: "exact_name_address";
      matchedVenue: TorontoVenueMatchCandidate;
    }
  | {
      status: typeof VenueMatchStatus.PENDING;
      venueId: null;
      reason:
        | "missing_source_address"
        | "no_exact_match"
        | "multiple_exact_matches";
    };

export type TorontoDropInSkipReason =
  | "not_basketball"
  | "invalid_source_row"
  | "multi_date_range"
  | "invalid_time_range"
  | "invalid_age_range";

export type TorontoDropInSkippedRow = {
  reason: TorontoDropInSkipReason;
  rawSource: unknown;
  message: string;
};

export type TorontoDropInNormalizationResult = {
  candidates: NormalizedRunCandidate[];
  skipped: TorontoDropInSkippedRow[];
};
