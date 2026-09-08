import { expect, test } from "@playwright/test";

test("dark mode is locked across routes", async ({
  page,
}) => {
  await page.addInitScript(() => localStorage.setItem("complyx-theme", "light"));
  await page.goto("/");

  await expect(page.locator("html")).toHaveClass(/\bdark\b/);
  await expect(page.locator("html")).not.toHaveClass(/\blight\b/);
  await expect(page.getByLabel(/Modus wechseln/)).toHaveCount(0);
  await expect(page.locator("body")).toHaveCSS(
    "background-image",
    /Startseite\.svg/,
  );

  await page.goto("/auth/login");
  await expect(page.locator("html")).toHaveClass(/\bdark\b/);
  await expect(page.locator("html")).not.toHaveClass(/\blight\b/);
  await expect(page.getByLabel(/Modus wechseln/)).toHaveCount(0);
  await expect(page.locator(".bg-auth-panel")).toHaveCSS(
    "background-color",
    "rgb(250, 250, 250)",
  );
  await expect(page.locator('img[src*="Logo-schwarz"]')).toBeHidden();
  await expect(page.locator('img[src*="Logo-wei"]')).toBeVisible();
});
