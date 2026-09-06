import { expect, test } from "@playwright/test";

test("shows the browser-storage inventory without fake consent controls", async ({
  context,
  page,
}) => {
  await context.clearCookies();
  await page.goto("/cookie");

  await expect(
    page.getByRole("heading", {
      level: 1,
      name: "Cookies und lokale Speicherung",
    }),
  ).toBeVisible();
  await expect(page.getByText("complyx-guest-applicability-claim", { exact: false })).toBeVisible();
  await expect(page.getByText("complyx-theme", { exact: false })).toBeVisible();
  await expect(page.locator('[data-legal-page="cookie"] article')).toBeVisible();
  await expect(page.locator('input[type="checkbox"]')).toHaveCount(0);

  expect((await context.cookies()).some(({ name }) => name === "sidebar_state")).toBe(false);

  await page.getByRole("button", { name: "English" }).click();
  await expect(
    page.getByRole("heading", {
      level: 1,
      name: "Cookies and local storage",
    }),
  ).toBeVisible();
  expect(page.url()).toMatch(/\/cookie$/);

  const localeCookie = (await context.cookies()).find(
    ({ name }) => name === "complyx-locale",
  );
  expect(localeCookie?.value).toBe("en");
  expect(localeCookie?.sameSite).toBe("Lax");
});
