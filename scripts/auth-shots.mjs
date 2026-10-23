/**
 * Signs in with a Clerk test identity and screenshots the pages that sit
 * behind auth, which a plain headless fetch cannot reach -- it only ever gets
 * the 307 to /sign-in.
 *
 * Clerk development instances accept any address using the `+clerk_test`
 * subaddress together with the fixed verification code 424242, so this needs
 * no real credentials and keeps no secrets in the repo. It only works against
 * a development instance; a production key will reject the test identity.
 *
 * Cloudflare Turnstile is enabled on Clerk development instances and refuses
 * headless browsers, so without help the sign-up form silently stalls at the
 * verification step. `setupClerkTestingToken` fetches a bypass token using
 * CLERK_SECRET_KEY and attaches it to Clerk's requests, which is why the env
 * file has to be loaded -- a plain node script does not read .env the way
 * Next does.
 *
 * Usage:  node --env-file=.env scripts/auth-shots.mjs
 *         BASE_URL=... OUT_DIR=... TEST_EMAIL=... node scripts/auth-shots.mjs
 *
 * Note that this creates a user in the Clerk development instance, and the
 * pages it visits may create rows in the development database.
 */
import { mkdirSync } from "node:fs";

import { chromium } from "@playwright/test";
import { clerkSetup, setupClerkTestingToken } from "@clerk/testing/playwright";

const BASE = process.env.BASE_URL ?? "http://localhost:3000";
const OUT = process.env.OUT_DIR ?? "test-results/auth-shots";
const EMAIL = process.env.TEST_EMAIL ?? "opengym+clerk_test@example.com";
const PASSWORD = process.env.TEST_PASSWORD ?? "OpenGymTest!2026";
const CODE = "424242";

const PAGES = [
  { path: "/account", name: "account" },
  { path: "/runs/new", name: "runs-new" },
];

mkdirSync(OUT, { recursive: true });

if (!process.env.CLERK_SECRET_KEY) {
  console.error("CLERK_SECRET_KEY is not set. Run with: node --env-file=.env scripts/auth-shots.mjs");
  process.exit(1);
}

// Resolves the Frontend API URL and fetches a testing token from
// CLERK_SECRET_KEY. setupClerkTestingToken needs both and will throw without
// this having run first.
await clerkSetup({
  publishableKey: process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY,
});

const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1440, height: 1000 } });

// Must happen before the first navigation: it installs the route handler that
// adds the testing token to Clerk's requests.
await setupClerkTestingToken({ page });

async function bail(label, err) {
  console.error(`\n--- stuck at: ${label} ---`);
  if (err) console.error(String(err).split("\n")[0]);
  console.error("url:", page.url());
  console.error(
    "visible text:\n" +
      (await page.locator("body").innerText().catch(() => "")).slice(0, 1000),
  );
  await page.screenshot({ path: `${OUT}/auth-debug.png` });
  await browser.close();
  process.exit(1);
}

/** Clerk renders the code as six single-character boxes and autofocuses the
 *  first, so typing is more reliable than filling any one of them. */
async function enterCode() {
  const box = page.locator('input[autocomplete="one-time-code"], input[name^="codeInput"]').first();
  await box.waitFor({ state: "attached", timeout: 25000 });
  await box.focus().catch(() => {});
  await page.keyboard.type(CODE, { delay: 80 });
}

async function signUp() {
  await page.goto(`${BASE}/sign-up`, { waitUntil: "domcontentloaded" });
  const email = page.locator('input[name="emailAddress"]');
  await email.waitFor({ state: "visible", timeout: 25000 });
  await email.fill(EMAIL);

  const password = page.locator('input[name="password"]');
  if (await password.isVisible().catch(() => false)) await password.fill(PASSWORD);

  await email.press("Enter");
  await enterCode();
}

async function signIn() {
  await page.goto(`${BASE}/sign-in`, { waitUntil: "domcontentloaded" });
  const email = page.locator('input[name="identifier"], input[name="emailAddress"]').first();
  await email.waitFor({ state: "visible", timeout: 25000 });
  await email.fill(EMAIL);
  await email.press("Enter");

  const password = page.locator('input[name="password"]');
  if (await password.isVisible({ timeout: 6000 }).catch(() => false)) {
    await password.fill(PASSWORD);
    await password.press("Enter");
  } else {
    await enterCode();
  }
}

const signedIn = () =>
  page.waitForURL((u) => !/\/sign-(in|up)/.test(u.pathname), { timeout: 30000 });

try {
  // The test identity may already exist from a previous run, in which case
  // sign-up dead-ends and signing in is the right path.
  await signUp();
  await signedIn();
} catch {
  try {
    await signIn();
    await signedIn();
  } catch (err) {
    await bail("authentication", err);
  }
}

console.log("signed in at", page.url());

for (const { path, name } of PAGES) {
  const res = await page.goto(`${BASE}${path}`, { waitUntil: "networkidle" });
  if (/\/sign-(in|up)/.test(new URL(page.url()).pathname)) {
    console.error(`${path}: still redirected to auth -- session did not stick`);
    continue;
  }
  for (const [w, h] of [[1440, 1000], [390, 900]]) {
    await page.setViewportSize({ width: w, height: h });
    await page.screenshot({ path: `${OUT}/${name}-${w}.png`, fullPage: true });
  }
  console.log(`${path}: ${res?.status()} -> ${OUT}/${name}-{1440,390}.png`);
}

await browser.close();
