import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";

const PACKAGE_ID = "1a5be46a-4039-48cd-a2d2-8e702abf9516";
const CKAN_BASE_URL = "https://ckan0.cf.opendata.inter.prod-toronto.ca";
const PACKAGE_SHOW_URL = `${CKAN_BASE_URL}/api/3/action/package_show`;
const DATASTORE_SEARCH_URL = `${CKAN_BASE_URL}/api/3/action/datastore_search`;
const FIXTURE_DIR = path.join(process.cwd(), "tests", "fixtures", "toronto");
const REQUEST_TIMEOUT_MS = 20_000;
const PAGE_SIZE = 5_000;
const USER_AGENT =
  "OpenGym Toronto CKAN inspector (local development; contact: repository owner)";

type JsonRecord = Record<string, unknown>;

type CkanResourceSummary = {
  id: string;
  name: string;
  format: string | null;
  datastoreActive: boolean;
  lastModified: string | null;
  metadataModified: string | null;
};

type DatastoreField = {
  id: string;
  type: string | null;
};

type DatastoreSample = {
  resource: CkanResourceSummary;
  fields: DatastoreField[];
  sampleRecords: JsonRecord[];
  basketballRecords: JsonRecord[];
  basketballTitleCounts: JsonRecord[];
  basketballSummary: JsonRecord | null;
  total: number | null;
  basketballTotal: number | null;
  sampledAt: string;
};

function isRecord(value: unknown): value is JsonRecord {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function readString(record: JsonRecord, key: string): string | null {
  const value = record[key];
  return typeof value === "string" ? value : null;
}

function readBoolean(record: JsonRecord, key: string): boolean {
  return record[key] === true;
}

function readNumberLike(record: JsonRecord, key: string): number | null {
  const value = record[key];

  if (typeof value === "number" && Number.isFinite(value)) {
    return value;
  }

  if (typeof value === "string") {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : null;
  }

  return null;
}

function normalizeName(name: string): string {
  return name
    .normalize("NFKC")
    .trim()
    .toLowerCase()
    .replaceAll(/[\s_-]+/g, " ");
}

async function fetchJson(url: URL): Promise<unknown> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);

  try {
    const response = await fetch(url, {
      cache: "no-store",
      headers: {
        Accept: "application/json",
        "User-Agent": USER_AGENT,
      },
      signal: controller.signal,
    });

    if (!response.ok) {
      throw new Error(`HTTP ${response.status} ${response.statusText} for ${url}`);
    }

    return await response.json();
  } finally {
    clearTimeout(timeout);
  }
}

function unwrapCkanResult(payload: unknown, context: string): unknown {
  if (!isRecord(payload)) {
    throw new Error(`${context} did not return a JSON object`);
  }

  if (payload.success !== true) {
    const errorSummary = isRecord(payload.error)
      ? JSON.stringify(payload.error).slice(0, 500)
      : "missing CKAN error object";
    throw new Error(`${context} returned CKAN success=false: ${errorSummary}`);
  }

  return payload.result;
}

function parseResource(resource: unknown): CkanResourceSummary | null {
  if (!isRecord(resource)) {
    return null;
  }

  const id = readString(resource, "id");
  const name = readString(resource, "name");

  if (!id || !name) {
    return null;
  }

  return {
    id,
    name,
    format: readString(resource, "format"),
    datastoreActive: readBoolean(resource, "datastore_active"),
    lastModified:
      readString(resource, "last_modified") ??
      readString(resource, "last_modified_date"),
    metadataModified: readString(resource, "metadata_modified"),
  };
}

function parseResources(packageResult: unknown): CkanResourceSummary[] {
  if (!isRecord(packageResult) || !Array.isArray(packageResult.resources)) {
    throw new Error("package_show result did not contain a resources array");
  }

  return packageResult.resources.flatMap((resource) => {
    const parsed = parseResource(resource);
    return parsed ? [parsed] : [];
  });
}

function findResource(
  resources: CkanResourceSummary[],
  predicate: (normalizedName: string) => boolean,
): CkanResourceSummary | null {
  return (
    resources.find((resource) => {
      return resource.datastoreActive && predicate(normalizeName(resource.name));
    }) ?? null
  );
}

function parseFields(fields: unknown): DatastoreField[] {
  if (!Array.isArray(fields)) {
    return [];
  }

  return fields.flatMap((field) => {
    if (!isRecord(field)) {
      return [];
    }

    const id = readString(field, "id");
    if (!id) {
      return [];
    }

    return [
      {
        id,
        type: readString(field, "type"),
      },
    ];
  });
}

function parseRecords(records: unknown): JsonRecord[] {
  if (!Array.isArray(records)) {
    return [];
  }

  return records.filter(isRecord);
}

function selectRepresentativeBasketballRecords(records: JsonRecord[]): JsonRecord[] {
  const recordsByTitle = new Map<string, JsonRecord[]>();

  for (const record of records) {
    const title = readString(record, "Course Title") ?? "Unknown";
    const existing = recordsByTitle.get(title) ?? [];
    existing.push(record);
    recordsByTitle.set(title, existing);
  }

  return Array.from(recordsByTitle.entries())
    .sort(([leftTitle], [rightTitle]) => leftTitle.localeCompare(rightTitle))
    .flatMap(([, titleRecords]) => titleRecords.slice(0, 12));
}

function incrementCount(counts: Map<string, number>, key: string): void {
  counts.set(key, (counts.get(key) ?? 0) + 1);
}

function countMapToRecords(
  counts: Map<string, number>,
  keyName: string,
): JsonRecord[] {
  return Array.from(counts.entries())
    .sort(([left], [right]) => left.localeCompare(right))
    .map(([key, count]) => ({
      [keyName]: key,
      count,
    }));
}

function summarizeBasketballRecords(records: JsonRecord[]): JsonRecord {
  const sectionCounts = new Map<string, number>();
  const ageMinCounts = new Map<string, number>();
  const ageMaxCounts = new Map<string, number>();
  let sameFirstLastDateCount = 0;
  let differentFirstLastDateCount = 0;
  let missingCourseIdCount = 0;
  let missingLocationIdCount = 0;
  let endNotAfterStartCount = 0;

  for (const record of records) {
    const firstDate = readString(record, "First Date");
    const lastDate = readString(record, "Last Date");
    const startHour = readNumberLike(record, "Start Hour");
    const startMinute = readNumberLike(record, "Start Minute");
    const endHour = readNumberLike(record, "End Hour");
    const endMinute = readNumberLike(record, "End Min");

    if (firstDate && lastDate && firstDate === lastDate) {
      sameFirstLastDateCount += 1;
    } else {
      differentFirstLastDateCount += 1;
    }

    if (startHour !== null && startMinute !== null && endHour !== null && endMinute !== null) {
      const startTotalMinutes = startHour * 60 + startMinute;
      const endTotalMinutes = endHour * 60 + endMinute;
      if (endTotalMinutes <= startTotalMinutes) {
        endNotAfterStartCount += 1;
      }
    }

    if (readNumberLike(record, "Course_ID") === null) {
      missingCourseIdCount += 1;
    }

    if (readNumberLike(record, "Location ID") === null) {
      missingLocationIdCount += 1;
    }

    incrementCount(sectionCounts, readString(record, "Section") ?? "Missing");
    incrementCount(ageMinCounts, readString(record, "Age Min") ?? "Missing");
    incrementCount(ageMaxCounts, readString(record, "Age Max") ?? "Missing");
  }

  return {
    sameFirstLastDateCount,
    differentFirstLastDateCount,
    missingCourseIdCount,
    missingLocationIdCount,
    endNotAfterStartCount,
    sectionCounts: countMapToRecords(sectionCounts, "Section"),
    ageMinCounts: countMapToRecords(ageMinCounts, "Age Min"),
    ageMaxCounts: countMapToRecords(ageMaxCounts, "Age Max"),
  };
}

async function datastoreSearch({
  resourceId,
  limit,
  offset = 0,
  q,
}: {
  resourceId: string;
  limit: number;
  offset?: number;
  q?: string;
}): Promise<{
  fields: DatastoreField[];
  records: JsonRecord[];
  total: number | null;
}> {
  const url = new URL(DATASTORE_SEARCH_URL);
  url.searchParams.set("resource_id", resourceId);
  url.searchParams.set("limit", String(limit));
  url.searchParams.set("offset", String(offset));

  if (q) {
    url.searchParams.set("q", q);
  }

  const payload = await fetchJson(url);
  const result = unwrapCkanResult(payload, `datastore_search ${resourceId}`);

  if (!isRecord(result)) {
    throw new Error(`datastore_search ${resourceId} result was not an object`);
  }

  const total = typeof result.total === "number" ? result.total : null;

  return {
    fields: parseFields(result.fields),
    records: parseRecords(result.records),
    total,
  };
}

async function fetchAllDatastoreRecords(
  resource: CkanResourceSummary,
): Promise<{
  fields: DatastoreField[];
  records: JsonRecord[];
  total: number;
}> {
  const records: JsonRecord[] = [];
  let fields: DatastoreField[] = [];
  let expectedTotal: number | null = null;
  let offset = 0;

  while (expectedTotal === null || records.length < expectedTotal) {
    const page = await datastoreSearch({
      resourceId: resource.id,
      limit: PAGE_SIZE,
      offset,
    });

    if (fields.length === 0) {
      fields = page.fields;
    }

    if (page.total === null) {
      throw new Error(`DataStore ${resource.name} did not report a total`);
    }

    expectedTotal = page.total;

    if (page.records.length === 0 && records.length < expectedTotal) {
      throw new Error(
        `DataStore ${resource.name} returned an empty page at offset ${offset}`,
      );
    }

    records.push(...page.records);
    console.log(
      `Fetched ${resource.name} page: offset ${offset}, page ${page.records.length}, accumulated ${records.length}/${expectedTotal}`,
    );
    offset += page.records.length;
  }

  return {
    fields,
    records,
    total: expectedTotal,
  };
}

async function sampleResource(
  resource: CkanResourceSummary,
  options: {
    basketballLocalScan?: boolean;
  } = {},
): Promise<DatastoreSample> {
  const sample = await datastoreSearch({
    resourceId: resource.id,
    limit: 20,
  });

  let basketballRecords: JsonRecord[] = [];
  let basketballTitleCounts: JsonRecord[] = [];
  let basketballSummary: JsonRecord | null = null;
  let basketballTotal: number | null = null;

  if (options.basketballLocalScan) {
    const complete = await fetchAllDatastoreRecords(resource);
    const basketballMatches = complete.records.filter((record) => {
      const title = readString(record, "Course Title");
      return title ? normalizeName(title).includes("basketball") : false;
    });

    const titleCounts = new Map<string, number>();
    for (const record of basketballMatches) {
      const title = readString(record, "Course Title") ?? "Unknown";
      titleCounts.set(title, (titleCounts.get(title) ?? 0) + 1);
    }

    basketballRecords = selectRepresentativeBasketballRecords(basketballMatches);
    basketballTitleCounts = Array.from(titleCounts.entries())
      .sort(([leftTitle], [rightTitle]) => leftTitle.localeCompare(rightTitle))
      .map(([title, count]) => ({
        "Course Title": title,
        count,
      }));
    basketballSummary = summarizeBasketballRecords(basketballMatches);
    basketballTotal = basketballMatches.length;
  }

  return {
    resource,
    fields: sample.fields,
    sampleRecords: sample.records,
    basketballRecords,
    basketballTitleCounts,
    basketballSummary,
    total: sample.total,
    basketballTotal,
    sampledAt: new Date().toISOString(),
  };
}

async function sampleLocationsByIds(
  resource: CkanResourceSummary,
  locationIds: number[],
): Promise<DatastoreSample> {
  const uniqueIds = Array.from(new Set(locationIds)).slice(0, 25);
  const sample = await sampleResource(resource);

  if (uniqueIds.length === 0) {
    return sample;
  }

  const complete = await fetchAllDatastoreRecords(resource);
  const idSet = new Set(uniqueIds);
  const relatedLocations = complete.records.filter((record) => {
    const locationId = readNumberLike(record, "Location ID");
    return locationId === null ? false : idSet.has(locationId);
  });

  relatedLocations.sort(
    (left, right) =>
      (readNumberLike(left, "Location ID") ?? 0) -
      (readNumberLike(right, "Location ID") ?? 0),
  );

  return {
    ...sample,
    sampleRecords: relatedLocations,
  };
}

function printResource(resource: CkanResourceSummary): void {
  console.log(`- ${resource.name}`);
  console.log(`  id: ${resource.id}`);
  console.log(`  format: ${resource.format ?? "unknown"}`);
  console.log(`  datastore_active: ${resource.datastoreActive}`);
  console.log(`  last_modified: ${resource.lastModified ?? "unknown"}`);
  console.log(`  metadata_modified: ${resource.metadataModified ?? "unknown"}`);
}

function printSample(label: string, sample: DatastoreSample): void {
  console.log(`\n${label} fields (${sample.fields.length}):`);
  console.log(sample.fields.map((field) => field.id).join(", "));
  console.log(`${label} total: ${sample.total ?? "unknown"}`);
  console.log(
    `${label} Basketball matches: ${sample.basketballTotal ?? "unknown"}`,
  );

  if (sample.basketballRecords.length > 0) {
    console.log(`${label} first Basketball record:`);
    console.log(JSON.stringify(sample.basketballRecords[0], null, 2));
  }
}

async function writeFixture(fileName: string, value: unknown): Promise<void> {
  await mkdir(FIXTURE_DIR, { recursive: true });
  await writeFile(
    path.join(FIXTURE_DIR, fileName),
    `${JSON.stringify(value, null, 2)}\n`,
    "utf8",
  );
}

async function main(): Promise<void> {
  const packageUrl = new URL(PACKAGE_SHOW_URL);
  packageUrl.searchParams.set("id", PACKAGE_ID);

  const packagePayload = await fetchJson(packageUrl);
  const packageResult = unwrapCkanResult(packagePayload, "package_show");

  if (!isRecord(packageResult)) {
    throw new Error("package_show result was not an object");
  }

  console.log(`Package title: ${readString(packageResult, "title") ?? "unknown"}`);
  console.log(`Package name: ${readString(packageResult, "name") ?? "unknown"}`);
  console.log(
    `Package metadata modified: ${
      readString(packageResult, "metadata_modified") ?? "unknown"
    }`,
  );
  console.log(`Package version: ${readString(packageResult, "version") ?? "unknown"}`);

  const resources = parseResources(packageResult);
  console.log(`\nResources (${resources.length}):`);
  resources.forEach(printResource);

  const dropInResource = findResource(resources, (name) => {
    return name.includes("drop in") || name.includes("drop-in");
  });
  const locationsResource = findResource(resources, (name) => {
    return name.includes("location");
  });
  const facilitiesResource = findResource(resources, (name) => {
    return name.includes("facilit");
  });

  console.log("\nCandidate resources:");
  console.log(`Drop-in: ${dropInResource?.name ?? "not found"}`);
  console.log(`Locations: ${locationsResource?.name ?? "not found"}`);
  console.log(`Facilities: ${facilitiesResource?.name ?? "not found"}`);

  await writeFixture("package-show.json", packagePayload);

  if (dropInResource) {
    const sample = await sampleResource(dropInResource, {
      basketballLocalScan: true,
    });
    printSample("Drop-in", sample);
    if (sample.basketballTitleCounts.length > 0) {
      console.log("Drop-in Basketball title counts:");
      console.log(JSON.stringify(sample.basketballTitleCounts, null, 2));
    }
    await writeFixture("drop-in-sample.json", sample);

    if (locationsResource) {
      const locationIds = sample.basketballRecords.flatMap((record) => {
        const locationId = readNumberLike(record, "Location ID");
        return locationId === null ? [] : [locationId];
      });
      const locationsSample = await sampleLocationsByIds(
        locationsResource,
        locationIds,
      );
      printSample("Locations", locationsSample);
      await writeFixture("locations-sample.json", locationsSample);
    }
  }

  if (locationsResource && !dropInResource) {
    const sample = await sampleResource(locationsResource);
    printSample("Locations", sample);
    await writeFixture("locations-sample.json", sample);
  }

  if (facilitiesResource) {
    const sample = await sampleResource(facilitiesResource);
    printSample("Facilities", sample);
    await writeFixture("facilities-sample.json", sample);
  }
}

main().catch((error: unknown) => {
  const message = error instanceof Error ? error.message : String(error);
  console.error(message);
  process.exitCode = 1;
});
