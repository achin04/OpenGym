import { expect, test } from "@playwright/test";

test("home page links to runs page", async ({ page }) => {
  await page.goto("/");

  await expect(
    page.getByRole("heading", {
      name: "Find basketball runs near you.",
    }),
  ).toBeVisible();

  await page.getByRole("button", { name: "Find runs" }).click();

  await expect(page).toHaveURL(/\/runs/);
  await expect(
    page.getByRole("heading", { name: "Find a run that fits your week" }),
  ).toBeVisible();
});

test("create run page requires sign in", async ({ page }) => {
  await page.goto("/runs/new");

  await expect(
    page.getByRole("heading", { name: "Sign in to OpenGym" }),
  ).toBeVisible();

  await expect(page.getByLabel("Email address")).toBeVisible();
});
