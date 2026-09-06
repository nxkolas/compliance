import { OrganizationDocumentManager } from "@/components/documents/organization-document-manager";
import { getDefaultDictionary } from "@/src/i18n";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";

vi.mock("next/navigation", () => ({
  usePathname: () => "/tool/organizations/example/documents",
  useRouter: () => ({
    refresh: vi.fn(),
    replace: vi.fn(),
  }),
}));

describe("OrganizationDocumentManager layout", () => {
  it("renders the folder filters and document table with shadcn controls", () => {
    const dictionary = getDefaultDictionary();
    const html = renderToStaticMarkup(
      <OrganizationDocumentManager
        organizationId="00000000-0000-4000-8000-000000000001"
        initialDocuments={[
          {
            id: "00000000-0000-4000-8000-000000000002",
            title: "NIS2-Richtlinie Umsetzungskonzept",
            mimeType: "application/pdf",
            byteSize: 2_400_000,
            uploadedAt: "2026-07-12T12:00:00.000Z",
            status: "active",
            indexStatus: "indexed",
          },
        ]}
        initialPermissions={{
          canUpload: true,
          canArchive: true,
          canRestore: true,
          canRetryIndexing: true,
        }}
        initialCounts={{ all: 4, active: 3, archived: 1 }}
        status="all"
        search=""
        locale="de"
        labels={dictionary.modules.documents.workflow}
      />,
    );

    expect(dictionary.modules.documents.title).toBe("Dokumentenbibliothek");
    expect(dictionary.modules.documents.description).toBe(
      "Verwalten Sie organisationsweite Dokumente, Versionen und Verarbeitungsstatus.",
    );
    expect(dictionary.modules.documents.workflow.uploadDialogTitle).toBe(
      "Dokument hochladen",
    );
    expect(dictionary.modules.documents.workflow.uploadDropzone).toBe(
      "Datei hierher ziehen oder auswählen",
    );
    expect(html).not.toContain('data-slot="tabs"');
    expect(html.match(/role="tab"/g)).toHaveLength(3);
    expect(html.match(/width="145" height="114"/g)).toHaveLength(3);
    expect(html).toContain("/document-folder-all.svg");
    expect(html).toContain("/document-folder-active.svg");
    expect(html).toContain("/document-folder-archived.svg");
    expect(html).toContain("top-[57.06px]");
    expect(html).toContain("top-[82.26px]");
    expect(html).toContain("NIS2-Richtlinie Umsetzungskonzept");
    expect(html).toContain('data-slot="dropdown-menu-trigger"');
    expect(html).toContain("min-w-[1190px]");
    expect(html).toContain("w-full min-w-0");
    expect(html).toContain("pr-[43px] text-right");
    expect(html).toContain("bg-card");
    expect(html).toContain("left-[38.57%]");
    expect(html).toContain("left-[55.29%]");
    expect(html).toContain("left-[66.22%]");
    expect(html).toContain("left-[79.16%]");
    expect(html).not.toContain("-ml-[9px]");
    expect(html).toContain("w-[14.54%] text-center");
    expect(html).toContain("flex w-full justify-center");
    expect(html).toContain('class="w-[38.57%]"');
    expect(html).toContain('class="w-[16.97%]"');
    expect(html).toContain("outline-[1.2px]");
    expect(html).toContain(">Titel<");
    expect(html).toContain(">Typ<");
    expect(html).toContain(">Größe<");
    expect(html).toContain(">Datum<");
    expect(html).toContain(">Status<");
    expect(html).toContain("Dokumente hochladen");
    expect(html).toContain("h-12 w-full");
    expect(html).toContain("sm:w-64");
    expect(html).toContain("touch-scroll-x");
    expect(html).toContain("bg-primary");
    expect(html).toContain(
      "border-b border-foreground/[0.04] pt-3.5 pb-1.5",
    );
    expect(html).toContain('aria-live="polite" class="hidden"');
    expect(html).toContain("Dokumente durchsuchen");
    expect(html).toContain("max-w-[539px]");
    expect(html).toContain("bg-surface");
    expect(html).toContain("border-border-strong");
    expect(html).toContain("flex h-4 w-full items-start pt-0.5 text-sm");
  });

  it("keeps the complete table header visible without documents", () => {
    const dictionary = getDefaultDictionary();
    const html = renderToStaticMarkup(
      <OrganizationDocumentManager
        organizationId="00000000-0000-4000-8000-000000000001"
        initialDocuments={[]}
        initialPermissions={{
          canUpload: true,
          canArchive: true,
          canRestore: true,
          canRetryIndexing: true,
        }}
        initialCounts={{ all: 0, active: 0, archived: 0 }}
        status="all"
        search=""
        locale="de"
        labels={dictionary.modules.documents.workflow}
      />,
    );

    expect(html).toContain(">Titel<");
    expect(html).toContain(">Typ<");
    expect(html).toContain(">Größe<");
    expect(html).toContain(">Datum<");
    expect(html).toContain(">Status<");
    expect(html).toContain(dictionary.modules.documents.workflow.noDocuments);
  });
});
