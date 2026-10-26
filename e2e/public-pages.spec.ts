import { expect, test } from "@playwright/test";

test("home page search links to filtered runs page", async ({ page }) => {
  await page.goto("/");

  await expect(
    page.getByRole("heading", {
      name: "Find basketball runs near you.",
    }),
  ).toBeVisible();

  await page.getByLabel("City or neighbourhood").fill("Toronto");
  await page.getByRole("button", { name: "FIND RUNS" }).click();

  await expect(page).toHaveURL(/\/runs\?location=Toronto/);
  await expect(
    page.getByRole("heading", { name: "Runs near Toronto" }),
  ).toBeVisible();
});

test("create run page requires sign in", async ({ page }) => {
  await page.goto("/runs/new");

  await expect(
    page.getByRole("heading", { name: "Sign in to OpenGym" }),
  ).toBeVisible();

  await expect(page.getByLabel("Email address")).toBeVisible();
});

test("runs page filters by source from the chip row", async ({ page }) => {
  await page.goto("/runs");

  await page.getByRole("link", { name: "Community runs" }).click();

  await expect(page).toHaveURL(/\/runs\?.*sourceType=USER/);
  await expect(
    page.getByRole("link", { name: "Community runs" }),
  ).toHaveAttribute("aria-current", "true");
});

test("runs page applies level from the More filters popover", async ({
  page,
}) => {
  await page.goto("/runs");

  await expect(page.getByRole("dialog", { name: "More filters" })).not.toBeVisible();

  await page.getByRole("button", { name: "More filters" }).click();
  await expect(page.getByRole("dialog", { name: "More filters" })).toBeVisible();

  // The selects live outside the search form in the DOM and belong to it via
  // the form attribute, so this asserts that wiring as much as the filter.
  await page.getByLabel("Level").selectOption("OPEN");
  await page.getByRole("button", { name: "Apply filters" }).click();

  await expect(page).toHaveURL(/\/runs\?.*skillLevel=OPEN/);
});

test("runs page clears every filter at once", async ({ page }) => {
  await page.goto(
    "/runs?location=Toronto&availability=week&sourceType=USER&skillLevel=OPEN&ageGroup=ADULT",
  );

  await expect(page.getByLabel("Where")).toHaveValue("Toronto");
  await expect(page.getByLabel("When")).toHaveValue("week");

  await page.getByRole("link", { name: "Clear all", exact: true }).click();

  await expect(page).toHaveURL(/\/runs$/);
  await expect(page.getByLabel("Where")).toHaveValue("");
  await expect(page.getByLabel("When")).toHaveValue("upcoming");
  await expect(
    page.getByRole("link", { name: "Clear all", exact: true }),
  ).toHaveCount(0);
});

test("runs page loads more runs in place", async ({ page }) => {
  await page.goto("/runs");

  const cards = page.locator("article");
  const first = await cards.count();
  expect(first).toBeGreaterThan(0);

  const loadMore = page.getByRole("link", { name: /^Load \d+ more$/ });

  if ((await loadMore.count()) === 0) {
    test.skip(true, "development data has only one batch of runs");
    return;
  }

  await loadMore.click();

  await expect(page).toHaveURL(/show=\d+/);
  await expect
    .poll(async () => cards.count(), { timeout: 10000 })
    .toBeGreaterThan(first);
});
