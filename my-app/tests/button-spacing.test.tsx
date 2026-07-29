import { Button } from "@/components/ui/button";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

function buttonClassName(html: string) {
  return html.match(/<button[^>]*class="([^"]*)"/)?.[1] ?? "";
}

describe("Button spacing", () => {
  it("keeps the same default padding with and without an icon", () => {
    const textOnlyClassName = buttonClassName(
      renderToStaticMarkup(<Button>Speichern</Button>),
    );
    const iconClassName = buttonClassName(
      renderToStaticMarkup(
        <Button>
          <svg aria-hidden="true" />
          Speichern
        </Button>,
      ),
    );

    expect(textOnlyClassName).toContain("justify-center");
    expect(textOnlyClassName).toContain("gap-2");
    expect(textOnlyClassName).toContain("px-5");
    expect(iconClassName).toContain("px-5");
    expect(iconClassName).not.toContain("has-[&gt;svg]:px-");
  });

  it.each([
    ["xs", "px-2"],
    ["sm", "px-3"],
    ["lg", "px-6"],
  ] as const)("uses consistent %s size padding", (size, paddingClass) => {
    const className = buttonClassName(
      renderToStaticMarkup(
        <Button size={size}>
          <svg aria-hidden="true" />
          Aktion
        </Button>,
      ),
    );

    expect(className).toContain(paddingClass);
    expect(className).not.toContain("has-[&gt;svg]:px-");
  });
});
