import { expect, test } from "@playwright/test";

const identifier = process.env.E2E_USER_IDENTIFIER;
const password = process.env.E2E_USER_PASSWORD;

test.describe("authenticated account", () => {
  test.skip(!identifier || !password, "Set E2E_USER_IDENTIFIER and E2E_USER_PASSWORD");
  test.skip(({ isMobile }) => isMobile, "One browser is enough for the account smoke test");

  test("signs in and loads the authenticated home", async ({ page }) => {
    await page.goto("/app");
    await page.getByPlaceholder("Email or username").fill(identifier ?? "");
    await page
      .getByRole("button", { name: "Continue with email or username" })
      .click();

    await page.getByLabel("Password").fill(password ?? "");
    await page.getByRole("button", { name: "Continue", exact: true }).click();

    await expect(page.getByText("Net worth", { exact: true })).toBeVisible();
    await expect(page.getByRole("button", { name: /New transaction/i })).toBeVisible();

    await page.getByRole("button", { name: "moves" }).click();
    await expect(page.getByRole("heading", { name: "Transactions" })).toBeVisible();

    await page.getByRole("button", { name: "stats" }).click();
    await expect(page.getByRole("heading", { name: "Statistics" })).toBeVisible();

    await page.getByRole("button", { name: "profile" }).click();
    await expect(page.getByRole("button", { name: /Edit profile/i })).toBeVisible();
  });
});
