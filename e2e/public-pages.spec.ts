import { expect, test } from "@playwright/test";

test("home page links to runs page", async ({ page }) => {
  await page.goto("/");

  await expect(
    page.getByRole("heading", {
      name: "Find your next indoor basketball run.",
    }),
  ).toBeVisible();

  await page.getByRole("link", { name: "Browse runs" }).click();

  await expect(page).toHaveURL("/runs");
  await expect(
    page.getByRole("heading", { name: "Browse upcoming runs" }),
  ).toBeVisible();
});

test("create run page requires sign in", async ({ page }) => {
  await page.goto("/runs/new");

  await expect(
    page.getByRole("heading", { name: "Sign in to OpenGym" }),
  ).toBeVisible();

  await expect(page.getByLabel("Email address")).toBeVisible();
});