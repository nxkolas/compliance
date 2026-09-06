"use client";

import { useEffect, useState } from "react";
import type { Dictionary } from "@/src/i18n";

export function LicenseFilters({
  packageCount,
  licenses,
  labels,
}: {
  packageCount: number;
  licenses: ReadonlyArray<readonly [string, number]>;
  labels: Dictionary["legal"]["licenses"];
}) {
  const [term, setTerm] = useState("");
  const [license, setLicense] = useState("");
  const [shown, setShown] = useState(packageCount);

  useEffect(() => {
    const query = term.trim().toLowerCase();
    const items = document.querySelectorAll<HTMLElement>("[data-license-package]");
    let visible = 0;

    for (const item of items) {
      const matches =
        (!query || item.dataset.search?.includes(query)) &&
        (!license || item.dataset.license === license);
      item.hidden = !matches;
      if (matches) visible += 1;
    }

    setShown(visible);
  }, [license, term]);

  return (
    <div className="sticky top-28 z-30 mt-16 grid items-center gap-3 rounded-xl border-[1.5px] border-[#3D4049] bg-[#1B1E27]/95 p-4 shadow-sm backdrop-blur-md md:grid-cols-[minmax(14rem,1fr)_minmax(12rem,auto)_auto] md:px-6">
      <input
        type="search"
        value={term}
        onChange={(event) => setTerm(event.target.value)}
        placeholder={labels.filterPlaceholder}
        aria-label={labels.filterAriaLabel}
        className="h-11 min-w-0 rounded-lg border border-input bg-surface px-3.5 text-sm text-white outline-none placeholder:text-foreground-subtle focus:border-primary focus:ring-2 focus:ring-primary/35"
      />
      <select
        value={license}
        onChange={(event) => setLicense(event.target.value)}
        aria-label={labels.licenseFilterAriaLabel}
        className="h-11 min-w-0 rounded-lg border border-input bg-surface px-3.5 text-sm text-white outline-none focus:border-primary focus:ring-2 focus:ring-primary/35"
      >
        <option value="">
          {labels.allLicenses.replace("{count}", String(packageCount))}
        </option>
        {licenses.map(([name, count]) => (
          <option key={name} value={name}>
            {name} ({count})
          </option>
        ))}
      </select>
      <p aria-live="polite" className="whitespace-nowrap text-sm text-muted-foreground">
        {labels.packageCount
          .replace("{shown}", String(shown))
          .replace("{total}", String(packageCount))}
      </p>
    </div>
  );
}
