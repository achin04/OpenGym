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
