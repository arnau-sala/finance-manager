import { expect, test } from "@playwright/test";

test.describe("desktop entry", () => {
  test.skip(({ isMobile }) => isMobile, "Desktop landing only");

  test("explains the product and opens the full app", async ({ page }) => {
    await page.goto("/");

    await expect(
      page.getByRole("heading", { name: "Money, made clear." }),
    ).toBeVisible();
    await expect(
      page.getByRole("button", { name: /Launch on this device/i }),
    ).toBeVisible();

    await page.getByRole("button", { name: /Launch on this device/i }).click();

    await expect(page).toHaveURL(/\/app$/);
    await expect(
      page.getByRole("heading", { name: "Money, made clear." }),
    ).toBeVisible();
    await expect(page.getByPlaceholder("Email or username")).toBeVisible();
  });

  test("opens the complete legal notice", async ({ page }) => {
    await page.goto("/");
    await page.getByRole("link", { name: "Privacy & Terms" }).click();

    await expect(
      page.getByRole("heading", { name: "Privacy & Terms" }),
    ).toBeVisible();
    await expect(
      page.getByRole("heading", { name: "Privacy Policy" }),
    ).toBeVisible();
    await expect(page.getByRole("heading", { name: "Terms of Use" })).toBeVisible();
  });

  test("offers every account creation method and opens credential forms", async ({ page }) => {
    await page.goto("/app");
    await page.getByRole("button", { name: "Create an account" }).click();

    await expect(page.getByText("Email account", { exact: true })).toBeVisible();
    await expect(page.getByText("Username account", { exact: true })).toBeVisible();
    await expect(page.getByText("Google account", { exact: true })).toBeVisible();

    await page.getByText("Email account", { exact: true }).click();
    await expect(page.getByLabel("Email address")).toBeVisible();
    await expect(page.getByRole("textbox", { name: "Name", exact: true })).toBeVisible();

    await page.getByRole("button", { name: /back/i }).click();
    await page.getByText("Username account", { exact: true }).click();
    await expect(
      page.getByRole("textbox", { name: "Username", exact: true }),
    ).toBeVisible();
    await expect(page.getByRole("textbox", { name: "Name", exact: true })).toBeVisible();
  });

  test("opens account recovery help without leaving the landing", async ({ page }) => {
    await page.goto("/app");
    await page.getByRole("button", { name: "Need help?" }).click();
    await expect(page.getByText("Forgot your username?")).toBeVisible();
  });
});

test.describe("mobile browser entry", () => {
  test.skip(({ isMobile }) => !isMobile, "Mobile guide only");

  test("shows a three-step Home Screen guide", async ({ page }) => {
    await page.goto("/");

    await expect(
      page.getByRole("heading", { name: "Add it to your Home Screen" }),
    ).toBeVisible();
    await expect(page.getByRole("list", { name: "Install steps" }).getByRole("listitem"))
      .toHaveCount(3);
    await expect(page.getByRole("button", { name: "Privacy & Terms" })).toBeVisible();
  });
});
