import "dotenv/config";
import { expect, test } from "@playwright/test";
import { Client } from "pg";

/**
 * The one end-to-end journey the map exists for: see a pin, press it, land on
 * the runs this venue has.
 *
 * Deliberately does not assert anything about tiles or clustering. Those are
 * Leaflet's job, they depend on network imagery, and testing them here would
 * buy flakiness in exchange for no confidence in our own code.
 *
 * The venue is seeded rather than assumed, so the test does not depend on
 * whatever happens to be in the development database, and is placed near
 * Ottawa rather than in Toronto: at the zoom the map opens at, a Toronto
 * fixture would be swallowed by the cluster bubble covering the city and there
 * would be no individual pin to click.
 *
 * Seeding goes through `pg` rather than Prisma because Playwright's loader
 * cannot import the generated client -- it is ESM using import.meta, and the
 * spec is loaded as CommonJS. Raw SQL also means every column this test
 * depends on is stated here, including the enum values and the ids, which
 * Prisma would otherwise generate client-side.
 */
const SUFFIX = Date.now().toString(36);
const VENUE_NAME = `E2E Map Venue ${SUFFIX}`;
const venueId = `e2e-map-venue-${SUFFIX}`;
const runId = `e2e-map-run-${SUFFIX}`;

async function withDb<T>(work: (client: Client) => Promise<T>): Promise<T> {
  const client = new Client({ connectionString: process.env.DATABASE_URL });
  await client.connect();

  try {
    return await work(client);
  } finally {
    await client.end();
  }
}

test.beforeAll(async () => {
  const startTime = new Date(Date.now() + 2 * 24 * 60 * 60 * 1000);
  const endTime = new Date(startTime.getTime() + 90 * 60 * 1000);

  await withDb(async (client) => {
    await client.query(
      `INSERT INTO venues
         (id, name, "addressLine1", city, "postalCode",
          latitude, longitude, "geocodedAt", "geocodeSource", "updatedAt")
       VALUES ($1, $2, $3, $4, $5, $6, $7, NOW(), 'MANUAL', NOW())`,
      [
        venueId,
        VENUE_NAME,
        "1 E2E Test Way",
        "Ottawa",
        "K1A 0A9",
        45.4215,
        -75.6972,
      ],
    );

    await client.query(
      `INSERT INTO runs
         (id, title, "sourceType", "startTime", "endTime",
          "venueId", "sourceStatus", "updatedAt")
       VALUES ($1, $2, 'USER', $3, $4, $5, 'ACTIVE', NOW())`,
      [runId, `E2E Map Run ${SUFFIX}`, startTime, endTime, venueId],
    );
  });
});

// Only the two rows this spec created are removed, by id. Nothing else in the
// development database is touched.
test.afterAll(async () => {
  await withDb(async (client) => {
    await client.query("DELETE FROM runs WHERE id = $1", [runId]);
    await client.query("DELETE FROM venues WHERE id = $1", [venueId]);
  });
});

test("a map pin opens a popup that filters the runs page to that venue", async ({
  page,
}) => {
  await page.goto("/");

  const pin = page.locator(`.leaflet-marker-icon[title="${VENUE_NAME}"]`);
  await expect(pin).toBeVisible();

  await pin.click();

  const popupLink = page.getByRole("link", { name: "View Runs" });
  await expect(popupLink).toBeVisible();
  await popupLink.click();

  await expect(page).toHaveURL(new RegExp(`/runs\\?venueId=${venueId}`));

  await expect(
    page.getByRole("heading", { name: `Runs at ${VENUE_NAME}` }),
  ).toBeVisible();

  // The chip is the part that keeps the filter honest: without it the listing
  // is narrowed for a reason the visitor cannot see or undo.
  await expect(page.getByText("Filtered to")).toBeVisible();
  await expect(
    page.getByRole("link", { name: `Clear the ${VENUE_NAME} filter` }),
  ).toBeVisible();
});

test("the venue filter survives changing another filter", async ({ page }) => {
  await page.goto(`/runs?venueId=${venueId}`);

  await expect(
    page.getByRole("heading", { name: `Runs at ${VENUE_NAME}` }),
  ).toBeVisible();

  // The hidden input's whole purpose. Without it this submission drops the
  // venue and silently returns every run in the city.
  await page.getByLabel("Availability").selectOption("any");
  await page.getByRole("button", { name: "Search" }).click();

  await expect(page).toHaveURL(new RegExp(`venueId=${venueId}`));
  await expect(
    page.getByRole("heading", { name: `Runs at ${VENUE_NAME}` }),
  ).toBeVisible();
});

test("clearing the chip returns the full listing", async ({ page }) => {
  await page.goto(`/runs?venueId=${venueId}`);

  await page
    .getByRole("link", { name: `Clear the ${VENUE_NAME} filter` })
    .click();

  await expect(page).not.toHaveURL(/venueId=/);
  await expect(page.getByText("Filtered to")).not.toBeVisible();
});
