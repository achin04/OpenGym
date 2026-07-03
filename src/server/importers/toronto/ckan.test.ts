import { describe, expect, it, vi } from "vitest";
import packageShowFixture from "../../../../tests/fixtures/toronto/package-show.json";
import { getPackage } from "./ckan";

vi.mock("server-only", () => ({}));

function jsonResponse(body: unknown): Response {
  return new Response(JSON.stringify(body), {
    status: 200,
    headers: {
      "Content-Type": "application/json",
    },
  });
}

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
