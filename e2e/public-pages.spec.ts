import { expect, test } from "@playwright/test";

test("home page search links to filtered runs page", async ({ page }) => {
  await page.goto("/");

  await expect(
    page.getByRole("heading", {
      name: "Find basketball runs near you.",
    }),
  ).toBeVisible();

  await page.getByLabel("City or area").fill("Toronto");
  await page.getByRole("button", { name: "Find runs" }).click();

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

test("runs page can filter by source", async ({ page }) => {
  await page.goto("/runs");

  await page.getByLabel("Source").selectOption("USER");
  await page.getByRole("button", { name: "Search" }).click();

  await expect(page).toHaveURL(/\/runs\?.*sourceType=USER/);
});

test("runs page opens advanced filters from icon button", async ({ page }) => {
  await page.goto("/runs");

  await expect(
    page.getByRole("dialog", { name: "Advanced filters" }),
  ).not.toBeVisible();

  await page.getByRole("button", { name: "Advanced filters" }).click();

  await expect(
    page.getByRole("dialog", { name: "Advanced filters" }),
  ).toBeVisible();

  await page.getByLabel("Skill").selectOption("OPEN");
  await page.getByRole("button", { name: "Search" }).click();

  await expect(page).toHaveURL(/\/runs\?.*skillLevel=OPEN/);
});
