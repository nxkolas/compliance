"use client";

import { Input } from "@/components/ui/input";
import type { Locale } from "@/lib/i18n-config";
import { useEffect, useId, useMemo, useState } from "react";

export const isoCountryCodes = (
  "AD AE AF AG AI AL AM AO AQ AR AS AT AU AW AX AZ BA BB BD BE BF BG BH BI BJ BL BM BN BO BQ BR BS BT BV BW BY BZ CA CC CD CF CG CH CI CK CL CM CN CO CR CU CV CW CX CY CZ DE DJ DK DM DO DZ EC EE EG EH ER ES ET FI FJ FK FM FO FR GA GB GD GE GF GG GH GI GL GM GN GP GQ GR GS GT GU GW GY HK HM HN HR HT HU ID IE IL IM IN IO IQ IR IS IT JE JM JO JP KE KG KH KI KM KN KP KR KW KY KZ LA LB LC LI LK LR LS LT LU LV LY MA MC MD ME MF MG MH MK ML MM MN MO MP MQ MR MS MT MU MV MW MX MY MZ NA NC NE NF NG NI NL NO NP NR NU NZ OM PA PE PF PG PH PK PL PM PN PR PS PT PW PY QA RE RO RS RU RW SA SB SC SD SE SG SH SI SJ SK SL SM SN SO SR SS ST SV SX SY SZ TC TD TF TG TH TJ TK TL TM TN TO TR TT TV TW TZ UA UG UM US UY UZ VA VC VE VG VI VN VU WF WS YE YT ZA ZM ZW"
).split(" ");

export function localizedCountries(locale: Locale) {
  const names = new Intl.DisplayNames([locale], { type: "region" });
  return isoCountryCodes
    .map((code) => ({ code, name: names.of(code) ?? code }))
    .sort((a, b) => a.name.localeCompare(b.name, locale, { sensitivity: "base" }));
}

export function CountrySelector({
  value,
  onChange,
  locale,
  id,
  required = true,
}: {
  value: string;
  onChange: (code: string) => void;
  locale: Locale;
  id?: string;
  required?: boolean;
}) {
  const generatedId = useId();
  const listId = `${id ?? generatedId}-countries`;
  const countries = useMemo(() => localizedCountries(locale), [locale]);
  const selected = countries.find((country) => country.code === value);
  const selectedLabel = selected ? `${selected.name} (${selected.code})` : value;
  const [text, setText] = useState(selectedLabel);
  useEffect(() => setText(selectedLabel), [selectedLabel]);

  return (
    <>
      <Input
        id={id}
        list={listId}
        value={text}
        onChange={(event) => {
          const raw = event.target.value;
          setText(raw);
          const match = /\(([A-Z]{2})\)$/.exec(raw);
          const directCode = /^[A-Za-z]{2}$/.test(raw) ? raw.toUpperCase() : null;
          const named = countries.find((country) =>
            country.name.localeCompare(raw, locale, { sensitivity: "base" }) === 0
          );
          const code = match?.[1] ?? directCode ?? named?.code;
          if (code && isoCountryCodes.includes(code)) onChange(code);
        }}
        onBlur={() => setText(selectedLabel)}
        autoComplete="country-name"
        required={required}
      />
      <datalist id={listId}>
        {countries.map((country) => (
          <option key={country.code} value={`${country.name} (${country.code})`} />
        ))}
      </datalist>
    </>
  );
}
