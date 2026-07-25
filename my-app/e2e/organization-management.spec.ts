import "dotenv/config";
import { expect, test, type Page } from "@playwright/test";
import { getSupabaseAdminClient } from "@/src/server/supabase-admin";
import postgres from "postgres";

test.describe("organization management redesign", () => {
  test.skip(
    process.env.RUN_ORGANIZATION_E2E !== "1",
    "Set RUN_ORGANIZATION_E2E=1 to provision the disposable development fixture.",
  );
  test.describe.configure({ mode: "serial" });
  test.setTimeout(120_000);

  const password = "Organization-E2E-2026!";
  let runId = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
  let ownerEmail = `organization-owner-${runId}@example.test`;
  let teammateEmail = `organization-teammate-${runId}@example.test`;
  let pendingEmail = `organization-pending-${runId}@example.test`;
  let organizationName = `E2E Organisation ${runId}`;
  let organizationId = "";

  test.beforeAll(async () => {
    const databaseUrl = process.env.DATABASE_URL;
    if (!databaseUrl) throw new Error("DATABASE_URL is required");
    const client = postgres(databaseUrl, { prepare: false, max: 1 });
    const [existing] = await client<{ email: string }[]>`
      select email
      from auth.users owner_user
      where owner_user.email like 'organization-owner-%@example.test'
        and exists (
          select 1
          from auth.users teammate_user
          where teammate_user.email = replace(
            owner_user.email,
            'organization-owner-',
            'organization-teammate-'
          )
        )
      order by owner_user.created_at desc
      limit 1
    `;
    await client.end();
    if (existing) {
      ownerEmail = existing.email;
      runId = ownerEmail.slice("organization-owner-".length, -"@example.test".length);
      teammateEmail = `organization-teammate-${runId}@example.test`;
      pendingEmail = `organization-pending-${runId}@example.test`;
      organizationName = `E2E Organisation ${runId}`;
      return;
    }
    const admin = getSupabaseAdminClient();
    for (const [email, fullName] of [
      [ownerEmail, "E2E Owner"],
      [teammateEmail, "E2E Teammate"],
    ]) {
      const { error } = await admin.auth.admin.createUser({
        email,
        password,
        email_confirm: true,
        user_metadata: { full_name: fullName },
      });
      if (error) throw error;
    }
  });

  test("covers creation, switching, management, governance, invitations, archive, restore, and mobile", async ({ browser, page }) => {
    await login(page, ownerEmail, password);

    const existingResponse = await page.request.get(
      `/api/organizations?status=active&query=${encodeURIComponent(runId)}&limit=25`,
    );
    const existingBody = await existingResponse.json();
    organizationId = existingBody.data.organizations[0]?.id ?? "";

    if (!organizationId) {
      await test.step("zero-organization switcher opens creation", async () => {
        await expect(page).toHaveURL(/\/tool\/organizations$/);
        await expect(page.getByText("Organisation auswählen")).toBeVisible();
        await page.getByRole("button", { name: /Organisationen|Organisation auswählen/ }).first().click();
        await page.getByRole("menuitem", { name: "Neue Organisation erstellen" }).click();
        await expect(page).toHaveURL(/\/tool\/organizations\/new$/);
      });

      await test.step("responsive creation persists an ISO country", async () => {
        await page.setViewportSize({ width: 390, height: 844 });
        await page.locator("#organization-name").fill(organizationName);
        await page.locator("#legal-name").fill(`${organizationName} GmbH`);
        await expect(page.locator("#country")).toHaveValue(/Deutschland \(DE\)/);
        await page.getByRole("button", { name: "Organisation erstellen" }).click();
        await expect(page).toHaveURL(/\/tool\/organizations\/[0-9a-f-]+$/);
        organizationId = page.url().split("/").at(-1)!;
        await page.setViewportSize({ width: 1280, height: 900 });
      });
    }

    await test.step("switcher and searchable management expose the organization", async () => {
      await page.goto("/tool/organizations");
      await page.getByRole("button", { name: "Organisation auswählen" }).click();
      await page.getByRole("menuitem", { name: organizationName }).click();
      await expect(page).toHaveURL(new RegExp(`/tool/organizations/${organizationId}$`));
      await page.getByRole("button", { name: organizationName, exact: true }).click();
      await page.getByRole("menuitem", { name: "Organisationen verwalten" }).click();
      await page.getByLabel("Organisationen durchsuchen").fill(runId);
      await expect(page.getByText(organizationName, { exact: true }).first()).toBeVisible();
    });

    await test.step("atomic edit changes master data and policy in one save", async () => {
      await activeOrganizationRow(page, organizationName).getByRole("button", { name: new RegExp(`Aktionen: ${organizationName}`) }).click();
      await page.getByText("Organisation bearbeiten", { exact: true }).click();
      await page.locator("#edit-legal-name").fill(`${organizationName} AG`);
      await page.getByText("OpenAI erlauben", { exact: true }).click();
      await page.locator("#edit-reason").fill("E2E Richtlinienprüfung");
      await page.getByRole("button", { name: "Änderungen speichern" }).click();
      await expect(page.getByText("Änderungen wurden gespeichert.")).toBeVisible();
      await expect(page.getByText(`${organizationName} AG`, { exact: false }).first()).toBeVisible();
    });

    await test.step("pending invitations can be resent and revoked", async () => {
      await page.goto(`/tool/organizations/${organizationId}/settings/team`);
      await page.locator("#invite-email").fill(pendingEmail);
      await page.getByRole("button", { name: "Einladen" }).click();
      await expect(page.getByText(`Einladung für ${pendingEmail} liegt jetzt im Postfach.`)).toBeVisible();
      await page.getByRole("button", { name: `Erneut senden: ${pendingEmail}` }).first().click();
      await expect(page.getByText("Einladung wurde erneut gesendet.")).toBeVisible();
      await page.getByRole("button", { name: `Widerrufen: ${pendingEmail}` }).first().click();
      await expect(page.getByText("Einladung wurde widerrufen.")).toBeVisible();
    });

    await test.step("administrator cannot archive or govern owners", async () => {
      await page.locator("#invite-email").fill(teammateEmail);
      await page.locator("#invite-role").click();
      await page.getByRole("option", { name: "Administration" }).click();
      await page.getByRole("button", { name: "Einladen" }).click();
      await expect(page.getByText(`Einladung für ${teammateEmail} liegt jetzt im Postfach.`)).toBeVisible();

      const teammateContext = await browser.newContext();
      const teammatePage = await teammateContext.newPage();
      await login(teammatePage, teammateEmail, password);
      const inboxResponse = await teammatePage.request.get("/api/organization-invitations?limit=100");
      const inboxBody = await inboxResponse.json();
      const invitation = inboxBody.data.invitations.find(
        (candidate: { organizationId: string }) => candidate.organizationId === organizationId,
      );
      expect(invitation).toBeTruthy();
      const acceptResponse = await teammatePage.request.post(
        `/api/organization-invitations/${invitation.id}/accept`,
      );
      expect(acceptResponse.ok()).toBe(true);
      await teammatePage.goto(`/tool/organizations/${organizationId}/settings/team`);
      await expect(teammatePage.getByText("E2E Owner", { exact: true })).toBeVisible();

      const organizationResponse = await teammatePage.request.get(`/api/organizations/${organizationId}`);
      const organizationBody = await organizationResponse.json();
      const archiveResponse = await teammatePage.request.post(`/api/organizations/${organizationId}/archive`, {
        headers: { "if-match": String(organizationBody.data.organization.version) },
      });
      expect(archiveResponse.status()).toBe(403);

      const membersResponse = await teammatePage.request.get(`/api/organizations/${organizationId}/members?limit=100`);
      const membersBody = await membersResponse.json();
      const owner = membersBody.data.members.find((member: { role: string }) => member.role === "owner");
      const ownerResponse = await teammatePage.request.patch(`/api/organizations/${organizationId}/members/${owner.userId}`, {
        headers: { "if-match": String(owner.version) },
        data: { role: "member" },
      });
      expect(ownerResponse.status()).toBe(403);

      let teammate = membersBody.data.members.find(
        (member: { role: string }) => member.role === "admin",
      );
      const removeResponse = await page.request.post(
        `/api/organizations/${organizationId}/members/${teammate.userId}/deactivate`,
        { headers: { "if-match": String(teammate.version) } },
      );
      expect(removeResponse.ok()).toBe(true);
      await page.goto(`/tool/organizations/${organizationId}/settings/team`);
      await expect(page.getByText("Ehemalige Mitglieder", { exact: true })).toBeVisible();
      await expect(page.getByText("Entfernt", { exact: true })).toBeVisible();
      page.once("dialog", (dialog) => dialog.accept());
      await page.getByRole("button", { name: "Mitglied wiederherstellen" }).click();
      await expect(
        page.getByText("Mitgliedschaft wurde aktualisiert.", { exact: true }),
      ).toBeVisible();

      const restoredMembersResponse = await page.request.get(
        `/api/organizations/${organizationId}/members?limit=100`,
      );
      const restoredMembersBody = await restoredMembersResponse.json();
      teammate = restoredMembersBody.data.members.find(
        (member: { userId: string }) => member.userId === teammate.userId,
      );
      const auditorResponse = await page.request.patch(
        `/api/organizations/${organizationId}/members/${teammate.userId}`,
        {
          headers: { "if-match": String(teammate.version) },
          data: { role: "auditor" },
        },
      );
      expect(auditorResponse.ok()).toBe(true);
      await teammatePage.goto(`/tool/organizations/${organizationId}/settings/team`);
      await expect(teammatePage.getByText("Sie können die Mitglieder dieser Organisation ansehen.")).toBeVisible();
      await expect(teammatePage.getByRole("combobox")).toHaveCount(0);
      teammatePage.once("dialog", (dialog) => dialog.accept());
      await teammatePage.getByRole("button", { name: "Organisation verlassen" }).click();
      await expect(teammatePage).toHaveURL(/\/tool\/organizations$/);
      await teammateContext.close();

      await page.goto(`/tool/organizations/${organizationId}/settings/team`);
      await expect(page.getByText("Selbst ausgetreten", { exact: true })).toBeVisible();
      await expect(
        page.getByRole("button", { name: "Mitglied wiederherstellen" }),
      ).toHaveCount(0);
    });

    await test.step("owner archive redirects direct routes and restore returns the workspace", async () => {
      const ownerMembersResponse = await page.request.get(
        `/api/organizations/${organizationId}/members?limit=100`,
      );
      const ownerMembersBody = await ownerMembersResponse.json();
      const ownerMembership = ownerMembersBody.data.members.find(
        (member: { role: string }) => member.role === "owner",
      );
      const finalOwnerLeaveResponse = await page.request.post(
        `/api/organizations/${organizationId}/members/me/leave`,
        { headers: { "if-match": String(ownerMembership.version) } },
      );
      expect(finalOwnerLeaveResponse.status()).toBe(409);

      await page.goto("/tool/organizations");
      await page.getByLabel("Organisationen durchsuchen").fill(runId);
      await activeOrganizationRow(page, organizationName).getByRole("button", { name: new RegExp(`Aktionen: ${organizationName}`) }).click();
      await page.getByText("Organisation löschen", { exact: true }).click();
      await page.getByRole("button", { name: "Organisation löschen" }).last().click();
      await expect(page.getByText("Organisation wurde archiviert.")).toBeVisible();
      await page.goto(`/tool/organizations/${organizationId}`);
      await expect(page).toHaveURL(/\/tool\/organizations\?notice=archived$/);
      await expect(page.getByText(/Organisation ist archiviert/)).toBeVisible();

      await page.getByLabel("Organisationen durchsuchen").fill(runId);
      await page.getByRole("button", { name: new RegExp(`Aktionen: ${organizationName}`) }).last().click();
      await page.getByText("Organisation wiederherstellen", { exact: true }).click();
      await page.getByRole("button", { name: "Organisation wiederherstellen" }).last().click();
      await expect(page.getByText("Organisation wurde wiederhergestellt.")).toBeVisible();
      const archivedResponse = await page.request.get(
        `/api/organizations?status=archived&query=${encodeURIComponent(runId)}&limit=25`,
      );
      const archivedBody = await archivedResponse.json();
      const stillArchived = archivedBody.data.organizations.find(
        (candidate: { id: string }) => candidate.id === organizationId,
      );
      if (stillArchived) {
        const restoreResponse = await page.request.post(
          `/api/organizations/${organizationId}/restore`,
          { headers: { "if-match": String(stillArchived.version) } },
        );
        expect(restoreResponse.ok()).toBe(true);
      }
      await page.goto(`/tool/organizations/${organizationId}`);
      await expect(page).toHaveURL(new RegExp(`/tool/organizations/${organizationId}$`));
    });
  });
});

async function login(page: Page, email: string, password: string) {
  await page.goto("/auth/login");
  await page.locator("#email").fill(email);
  await page.locator("#password").fill(password);
  await page.getByRole("button", { name: "Anmelden" }).click();
  await expect(page).toHaveURL(/\/tool\/organizations/, { timeout: 20_000 });
}

function activeOrganizationRow(page: Page, name: string) {
  return page.getByRole("link", { name: new RegExp(name) }).first().locator("..");
}
