import { describe, expect, it, vi } from "vitest";
import packageShowFixture from "../../../../tests/fixtures/toronto/package-show.json";
import { fetchAllDatastoreRecords, getPackage } from "./ckan";
import type { CkanResource } from "./ckan";

vi.mock("server-only", () => ({}));

function jsonResponse(body: unknown): Response {
  return new Response(JSON.stringify(body), {
    status: 200,
    headers: {
      "Content-Type": "application/json",
    },
  });
}

function datastoreSearchEnvelope(records: { _id: number }[], total: number) {
  return {
    success: true,
    result: {
      fields: [{ id: "_id", type: "int" }],
      records,
      total,
    },
  };
}

const testResource: CkanResource = {
  id: "resource-1",
  name: "Drop-in",
};

describe("getPackage", () => {
  it("fetches and parses the Toronto CKAN package with a mocked fetcher", async () => {
    const fetcher = vi.fn<typeof fetch>(async () => {
      return jsonResponse(packageShowFixture);
    });

    const pkg = await getPackage({
      fetcher,
      baseUrl: "https://example.test",
      packageId: "test-package",
    });

    expect(pkg.name).toBe("registered-programs-and-drop-in-courses-offering");
    expect(pkg.resources).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          id: "c99ec04f-4540-482c-9ee4-efb38774eab4",
          name: "Drop-in",
          datastore_active: true,
        }),
      ]),
    );

    expect(fetcher).toHaveBeenCalledOnce();

    const [url, init] = fetcher.mock.calls[0];
    expect(url).toBeInstanceOf(URL);
    expect((url as URL).toString()).toBe(
      "https://example.test/api/3/action/package_show?id=test-package",
    );
    expect(init).toMatchObject({
      cache: "no-store",
      headers: {
        Accept: "application/json",
      },
    });
  });
});

describe("fetchAllDatastoreRecords", () => {
  it("requests every page sorted by _id so pagination is deterministic", async () => {
    const fetcher = vi.fn<typeof fetch>(async (url) => {
      const offset = new URL(url as unknown as string).searchParams.get(
        "offset",
      );

      if (offset === "0") {
        return jsonResponse(
          datastoreSearchEnvelope([{ _id: 1 }, { _id: 2 }], 3),
        );
      }

      return jsonResponse(datastoreSearchEnvelope([{ _id: 3 }], 3));
    });

    const page = await fetchAllDatastoreRecords(testResource, {
      fetcher,
      baseUrl: "https://example.test",
      pageSize: 2,
    });

    expect(page.total).toBe(3);
    expect(page.records).toEqual([{ _id: 1 }, { _id: 2 }, { _id: 3 }]);
    expect(fetcher).toHaveBeenCalledTimes(2);

    for (const [url] of fetcher.mock.calls) {
      expect((url as URL).searchParams.get("sort")).toBe("_id asc");
    }
  });

  it("returns a single page without extra requests when everything fits", async () => {
    const fetcher = vi.fn<typeof fetch>(async () => {
      return jsonResponse(
        datastoreSearchEnvelope([{ _id: 1 }, { _id: 2 }], 2),
      );
    });

    const page = await fetchAllDatastoreRecords(testResource, {
      fetcher,
      baseUrl: "https://example.test",
      pageSize: 5,
    });

    expect(page.total).toBe(2);
    expect(page.records).toEqual([{ _id: 1 }, { _id: 2 }]);
    expect(fetcher).toHaveBeenCalledOnce();
  });

  it("throws if the reported total changes between pages", async () => {
    const fetcher = vi.fn<typeof fetch>(async (url) => {
      const offset = new URL(url as unknown as string).searchParams.get(
        "offset",
      );

      if (offset === "0") {
        return jsonResponse(datastoreSearchEnvelope([{ _id: 1 }], 3));
      }

      // Simulates the source being refreshed mid-fetch: the second page
      // reports a different total than the first page did.
      return jsonResponse(datastoreSearchEnvelope([{ _id: 2 }], 5));
    });

    await expect(
      fetchAllDatastoreRecords(testResource, {
        fetcher,
        baseUrl: "https://example.test",
        pageSize: 1,
      }),
    ).rejects.toThrow(/total changed mid-fetch from 3 to 5/);
  });
});
