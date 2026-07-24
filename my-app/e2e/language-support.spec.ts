import { expect, test } from "@playwright/test";

const localeCookie = "complyx-locale";

test("public language selection persists without changing the URL", async ({
  page,
  context,
}) => {
  await page.goto("/?source=language-test");

  await expect(page.locator("html")).toHaveAttribute("lang", "de");
  await expect(page).toHaveTitle("NIS2 Compliance Checker");
  await expect(
    page.locator('meta[name="description"]'),
  ).toHaveAttribute(
    "content",
    "Ein übersichtlicher NIS2-Compliance-Checker für Organisationen.",
  );
  await expect(
    page.getByText(
      "Strukturieren Sie Betroffenheitsprüfung, Anforderungen, Risikomanagement",
      { exact: false },
    ),
  ).toBeVisible();

  await page.getByRole("button", { name: "English" }).click();

  await expect(page).toHaveURL(
    "http://127.0.0.1:3000/?source=language-test",
  );
  await expect(page.locator("html")).toHaveAttribute("lang", "en");
  await expect(
    page.locator('meta[name="description"]'),
  ).toHaveAttribute(
    "content",
    "A clear NIS2 compliance checker for organizations.",
  );
  await expect(
    page.getByText(
      "Structure scope checks, requirements, risk management",
      { exact: false },
    ),
  ).toBeVisible();

  const cookie = (await context.cookies()).find(
    ({ name }) => name === localeCookie,
  );
  expect(cookie?.value).toBe("en");
  expect(cookie?.sameSite).toBe("Lax");
  expect(cookie?.expires ?? 0).toBeGreaterThan(
    Date.now() / 1000 + 300 * 24 * 60 * 60,
  );

  await page.reload();
  await expect(page.locator("html")).toHaveAttribute("lang", "en");
  await page.goto("/auth/login?next=%2Ftool%2Forganizations");
  await expect(page.locator("html")).toHaveAttribute("lang", "en");
  await expect(page.getByRole("heading", { name: "Welcome back" })).toBeVisible();

  await page.getByRole("button", { name: "Deutsch" }).click();
  await expect(page).toHaveURL(
    "http://127.0.0.1:3000/auth/login?next=%2Ftool%2Forganizations",
  );
  await expect(page.locator("html")).toHaveAttribute("lang", "de");
  await expect(
    page.getByRole("heading", { name: "Willkommen zurück" }),
  ).toBeVisible();

  await page.goto("/auth/error?code=AUTH_CALLBACK_FAILED");
  await expect(
    page.getByText(
      "Die Anmeldung konnte nicht abgeschlossen werden. Bitte versuchen Sie es erneut.",
    ),
  ).toBeVisible();
});

test("locale output does not leak between browser contexts", async ({
  browser,
}) => {
  const englishContext = await browser.newContext();
  const germanContext = await browser.newContext();
  await englishContext.addCookies([
    {
      name: localeCookie,
      value: "en",
      domain: "127.0.0.1",
      path: "/",
    },
  ]);

  const englishPage = await englishContext.newPage();
  const germanPage = await germanContext.newPage();

  await englishPage.goto("/");
  await germanPage.goto("/");
  await englishPage.goto("/auth/forgot-password");
  await germanPage.goto("/auth/forgot-password");

  await expect(englishPage.locator("html")).toHaveAttribute("lang", "en");
  await expect(germanPage.locator("html")).toHaveAttribute("lang", "de");
  await expect(
    englishPage.getByText("Reset your password", { exact: true }),
  ).toBeVisible();
  await expect(
    germanPage.getByText("Passwort zurücksetzen", { exact: true }),
  ).toBeVisible();

  await Promise.all([englishContext.close(), germanContext.close()]);
});
