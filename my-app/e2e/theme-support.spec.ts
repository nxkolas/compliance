import { expect, test } from "@playwright/test";

const themeStorageKey = "complyx-theme";

test("theme selection changes the global palette and persists across routes", async ({
  page,
}) => {
  await page.goto("/");

  await expect(page.locator("html")).toHaveClass(/\blight\b/);
  await expect(
    page.getByRole("button", { name: "Zum dunklen Modus wechseln" }),
  ).toBeVisible();
  await expect(page.locator("body")).toHaveCSS(
    "background-image",
    /Login%20%E2%80%93%20Standard\.svg/,
  );

  await page
    .getByRole("button", { name: "Zum dunklen Modus wechseln" })
    .click();

  await expect(page.locator("html")).toHaveClass(/\bdark\b/);
  await expect(page.locator("body")).toHaveCSS(
    "background-image",
    /Startseite\.svg/,
  );
  await expect
    .poll(() => page.evaluate((key) => localStorage.getItem(key), themeStorageKey))
    .toBe("dark");

  await page.reload();
  await expect(page.locator("html")).toHaveClass(/\bdark\b/);

  await page.goto("/auth/login");
  await expect(page.locator("html")).toHaveClass(/\bdark\b/);
  await expect(
    page.getByRole("button", { name: "Zum hellen Modus wechseln" }),
  ).toHaveCount(0);
  await expect(page.locator(".bg-auth-panel")).toHaveCSS(
    "background-color",
    "rgb(250, 250, 250)",
  );
  await expect(page.locator('img[src*="Logo-schwarz"]')).toBeHidden();
  await expect(page.locator('img[src*="Logo-wei"]')).toBeVisible();
});
