import "server-only";
import { z } from "zod";

export const TORONTO_CKAN_PACKAGE_ID =
  "1a5be46a-4039-48cd-a2d2-8e702abf9516";

export const TORONTO_CKAN_BASE_URL =
  "https://ckan0.cf.opendata.inter.prod-toronto.ca";

const PACKAGE_SHOW_ACTION = "/api/3/action/package_show";
const DATASTORE_SEARCH_ACTION = "/api/3/action/datastore_search";

const DEFAULT_PAGE_SIZE = 5_000;
const REQUEST_TIMEOUT_MS = 20_000;
const USER_AGENT =
  "OpenGym Toronto CKAN client (server import pipeline; contact: repository owner)";

export type JsonRecord = Record<string, unknown>;

type FetchLike = typeof fetch;

export type TorontoCkanClientOptions = {
  fetcher?: FetchLike;
  baseUrl?: string;
  packageId?: string;
  pageSize?: number;
  requestTimeoutMs?: number;
};

const ckanResourceSchema = z.looseObject({
  id: z.string().min(1),
  name: z.string().min(1),
  format: z.string().nullable().optional(),
  datastore_active: z.boolean().optional(),
  last_modified: z.string().nullable().optional(),
  last_modified_date: z.string().nullable().optional(),
  metadata_modified: z.string().nullable().optional(),
});

const ckanPackageSchema = z
  .looseObject({
    id: z.string().min(1),
    name: z.string().min(1),
    title: z.string().nullable().optional(),
    metadata_modified: z.string().nullable().optional(),
    resources: z.array(ckanResourceSchema),
  });

const ckanPackageEnvelopeSchema = z.object({
  success: z.literal(true),
  result: ckanPackageSchema,
});

const ckanErrorEnvelopeSchema = z
  .looseObject({
    success: z.literal(false),
    error: z.unknown().optional(),
  });

const datastoreFieldSchema = z
  .looseObject({
    id: z.string().min(1),
    type: z.string().nullable().optional(),
  });

const datastoreSearchResultSchema = z
  .looseObject({
    fields: z.array(datastoreFieldSchema).optional(),
    records: z.array(z.record(z.string(), z.unknown())),
    total: z.number().int().nonnegative(),
  });

const datastoreSearchEnvelopeSchema = z.object({
  success: z.literal(true),
  result: datastoreSearchResultSchema,
});

export type CkanResource = z.infer<typeof ckanResourceSchema>;
export type CkanPackage = z.infer<typeof ckanPackageSchema>;
export type DatastoreField = z.infer<typeof datastoreFieldSchema>;
export type DatastorePage = z.infer<typeof datastoreSearchResultSchema>;

const DROP_IN_REQUIRED_FIELDS = [
  "Location ID",
  "Course_ID",
  "Course Title",
  "First Date",
  "Last Date",
  "Start Hour",
  "Start Minute",
  "End Hour",
  "End Min",
] as const;

const LOCATIONS_REQUIRED_FIELDS = [
  "Location ID",
  "Location Name",
  "Street No",
  "Street Name",
  "Postal Code",
] as const;

const FACILITIES_REQUIRED_FIELDS = [
  "Facility ID",
  "Location ID",
  "Facility Type (Display Name)",
] as const;

type ResolvedTorontoCkanClientOptions = {
  fetcher: FetchLike;
  baseUrl: string;
  packageId: string;
  pageSize: number;
  requestTimeoutMs: number;
};

type DatastoreSearchOptions = {
  resourceId: string;
  limit: number;
  offset?: number;
};

function resolveOptions(
  options: TorontoCkanClientOptions = {},
): ResolvedTorontoCkanClientOptions {
  return {
    fetcher: options.fetcher ?? fetch,
    baseUrl: options.baseUrl ?? TORONTO_CKAN_BASE_URL,
    packageId: options.packageId ?? TORONTO_CKAN_PACKAGE_ID,
    pageSize: options.pageSize ?? DEFAULT_PAGE_SIZE,
    requestTimeoutMs: options.requestTimeoutMs ?? REQUEST_TIMEOUT_MS,
  };
}

function buildActionUrl(
  baseUrl: string,
  action: string,
  searchParams: Record<string, string | number>,
): URL {
  const url = new URL(action, baseUrl);

  for (const [key, value] of Object.entries(searchParams)) {
    url.searchParams.set(key, String(value));
  }

  return url;
}

function normalizeResourceName(name: string): string {
  return name
    .normalize("NFKC")
    .trim()
    .toLowerCase()
    .replaceAll(/[\s_-]+/g, " ");
}

function fieldIds(fields: DatastoreField[] | undefined): Set<string> {
  return new Set((fields ?? []).map((field) => field.id));
}

function hasRequiredFields(
  fields: DatastoreField[] | undefined,
  requiredFields: readonly string[],
): boolean {
  const ids = fieldIds(fields);
  return requiredFields.every((field) => ids.has(field));
}

function describeMissingFields(
  fields: DatastoreField[] | undefined,
  requiredFields: readonly string[],
): string {
  const ids = fieldIds(fields);
  const missing = requiredFields.filter((field) => !ids.has(field));
  return missing.length > 0 ? missing.join(", ") : "none";
}

function findActiveResourceByName(
  pkg: CkanPackage,
  expectedName: string,
): CkanResource | null {
  const normalizedExpectedName = normalizeResourceName(expectedName);

  return (
    pkg.resources.find((resource) => {
      return (
        resource.datastore_active === true &&
        normalizeResourceName(resource.name) === normalizedExpectedName
      );
    }) ?? null
  );
}

function formatCkanError(error: unknown): string {
  if (typeof error === "string") {
    return error;
  }

  if (error && typeof error === "object") {
    return JSON.stringify(error).slice(0, 500);
  }

  return "missing CKAN error details";
}

function formatZodError(error: z.ZodError): string {
  return error.issues
    .map((issue) => {
      const path = issue.path.length > 0 ? issue.path.join(".") : "response";
      return `${path}: ${issue.message}`;
    })
    .join("; ");
}

async function fetchJson(
  url: URL,
  options: Pick<ResolvedTorontoCkanClientOptions, "fetcher" | "requestTimeoutMs">,
): Promise<unknown> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), options.requestTimeoutMs);

  try {
    const response = await options.fetcher(url, {
      cache: "no-store",
      headers: {
        Accept: "application/json",
        "User-Agent": USER_AGENT,
      },
      signal: controller.signal,
    });

    if (!response.ok) {
      throw new Error(
        `HTTP ${response.status} ${response.statusText} for ${url.toString()}`,
      );
    }

    return await response.json();
  } catch (error) {
    if (error instanceof Error && error.name === "AbortError") {
      throw new Error(`Request timed out after ${options.requestTimeoutMs}ms`);
    }

    throw error;
  } finally {
    clearTimeout(timeout);
  }
}

function parsePackageEnvelope(payload: unknown, context: string): CkanPackage {
  const errorEnvelope = ckanErrorEnvelopeSchema.safeParse(payload);

  if (errorEnvelope.success) {
    throw new Error(
      `${context} returned CKAN success=false: ${formatCkanError(
        errorEnvelope.data.error,
      )}`,
    );
  }

  const envelope = ckanPackageEnvelopeSchema.safeParse(payload);

  if (!envelope.success) {
    throw new Error(
      `${context} returned an invalid CKAN package response: ${formatZodError(
        envelope.error,
      )}`,
    );
  }

  return envelope.data.result;
}

function parseDatastoreSearchEnvelope(
  payload: unknown,
  context: string,
): DatastorePage {
  const errorEnvelope = ckanErrorEnvelopeSchema.safeParse(payload);

  if (errorEnvelope.success) {
    throw new Error(
      `${context} returned CKAN success=false: ${formatCkanError(
        errorEnvelope.data.error,
      )}`,
    );
  }

  const envelope = datastoreSearchEnvelopeSchema.safeParse(payload);

  if (!envelope.success) {
    throw new Error(
      `${context} returned an invalid CKAN DataStore response: ${formatZodError(
        envelope.error,
      )}`,
    );
  }

  return envelope.data.result;
}

export async function getPackage(
  options: TorontoCkanClientOptions = {},
): Promise<CkanPackage> {
  const resolvedOptions = resolveOptions(options);
  const url = buildActionUrl(resolvedOptions.baseUrl, PACKAGE_SHOW_ACTION, {
    id: resolvedOptions.packageId,
  });
  const payload = await fetchJson(url, resolvedOptions);

  return parsePackageEnvelope(payload, "package_show");
}

async function datastoreSearch(
  searchOptions: DatastoreSearchOptions,
  clientOptions: ResolvedTorontoCkanClientOptions,
): Promise<DatastorePage> {
  const url = buildActionUrl(clientOptions.baseUrl, DATASTORE_SEARCH_ACTION, {
    resource_id: searchOptions.resourceId,
    limit: searchOptions.limit,
    offset: searchOptions.offset ?? 0,
  });
  const payload = await fetchJson(url, clientOptions);

  return parseDatastoreSearchEnvelope(
    payload,
    `datastore_search ${searchOptions.resourceId}`,
  );
}

async function verifyResourceFields(
  resource: CkanResource,
  requiredFields: readonly string[],
  clientOptions: ResolvedTorontoCkanClientOptions,
): Promise<void> {
  const sample = await datastoreSearch(
    {
      resourceId: resource.id,
      limit: 1,
    },
    clientOptions,
  );

  if (!hasRequiredFields(sample.fields, requiredFields)) {
    throw new Error(
      `${resource.name} resource ${resource.id} is missing expected fields: ${describeMissingFields(
        sample.fields,
        requiredFields,
      )}`,
    );
  }
}

async function findVerifiedResource(
  pkg: CkanPackage,
  expectedName: string,
  requiredFields: readonly string[],
  options: TorontoCkanClientOptions = {},
): Promise<CkanResource> {
  const resource = findActiveResourceByName(pkg, expectedName);

  if (!resource) {
    throw new Error(
      `Could not find active Toronto CKAN DataStore resource named ${expectedName}`,
    );
  }

  await verifyResourceFields(resource, requiredFields, resolveOptions(options));

  return resource;
}

export async function findDropInResource(
  pkg: CkanPackage,
  options: TorontoCkanClientOptions = {},
): Promise<CkanResource> {
  return findVerifiedResource(pkg, "Drop-in", DROP_IN_REQUIRED_FIELDS, options);
}

export async function findLocationsResource(
  pkg: CkanPackage,
  options: TorontoCkanClientOptions = {},
): Promise<CkanResource> {
  return findVerifiedResource(
    pkg,
    "Locations",
    LOCATIONS_REQUIRED_FIELDS,
    options,
  );
}

export async function findFacilitiesResource(
  pkg: CkanPackage,
  options: TorontoCkanClientOptions = {},
): Promise<CkanResource> {
  return findVerifiedResource(
    pkg,
    "Facilities",
    FACILITIES_REQUIRED_FIELDS,
    options,
  );
}

export async function fetchAllDatastoreRecords(
  resource: CkanResource,
  options: TorontoCkanClientOptions = {},
): Promise<DatastorePage> {
  const resolvedOptions = resolveOptions(options);
  const records: JsonRecord[] = [];
  let fields: DatastoreField[] | undefined;
  let expectedTotal: number | null = null;
  let offset = 0;

  while (expectedTotal === null || records.length < expectedTotal) {
    const page = await datastoreSearch(
      {
        resourceId: resource.id,
        limit: resolvedOptions.pageSize,
        offset,
      },
      resolvedOptions,
    );

    fields ??= page.fields;
    expectedTotal = page.total;

    if (page.records.length === 0 && records.length < expectedTotal) {
      throw new Error(
        `DataStore ${resource.name} returned an empty page at offset ${offset}`,
      );
    }

    records.push(...page.records);
    offset += page.records.length;
  }

  return {
    fields,
    records,
    total: expectedTotal,
  };
}

export type TorontoCkanClient = {
  getPackage: () => Promise<CkanPackage>;
  findDropInResource: (pkg: CkanPackage) => Promise<CkanResource>;
  findLocationsResource: (pkg: CkanPackage) => Promise<CkanResource>;
  findFacilitiesResource: (pkg: CkanPackage) => Promise<CkanResource>;
  fetchAllDatastoreRecords: (resource: CkanResource) => Promise<DatastorePage>;
};

export function createTorontoCkanClient(
  options: TorontoCkanClientOptions = {},
): TorontoCkanClient {
  return {
    getPackage: () => getPackage(options),
    findDropInResource: (pkg) => findDropInResource(pkg, options),
    findLocationsResource: (pkg) => findLocationsResource(pkg, options),
    findFacilitiesResource: (pkg) => findFacilitiesResource(pkg, options),
    fetchAllDatastoreRecords: (resource) => fetchAllDatastoreRecords(resource, options),
  };
}
