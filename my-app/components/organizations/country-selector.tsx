"use client";

import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import type { Locale } from "@/lib/i18n-config";
import { useMemo } from "react";

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
  openDownward = false,
}: {
  value: string;
  onChange: (code: string) => void;
  locale: Locale;
  id?: string;
  required?: boolean;
  openDownward?: boolean;
}) {
  const countries = useMemo(() => localizedCountries(locale), [locale]);

  return (
    <Select
      value={value}
      onValueChange={onChange}
      required={required}
    >
      <SelectTrigger
        id={id}
        aria-required={required}
        triggerIcon={
          <svg
            width="20"
            height="20"
            viewBox="0 0 20 20"
            fill="none"
            xmlns="http://www.w3.org/2000/svg"
            className="size-5"
            aria-hidden="true"
            focusable="false"
          >
            <path
              d="M5 7.5L10 12.5L15 7.5"
              stroke="currentColor"
              strokeWidth="1.66667"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
        }
      >
        <SelectValue />
      </SelectTrigger>
      <SelectContent
        side={openDownward ? "bottom" : undefined}
        align={openDownward ? "start" : undefined}
        sideOffset={openDownward ? 4 : undefined}
        avoidCollisions={!openDownward}
        className="max-h-72 w-[var(--radix-select-trigger-width)] max-w-[calc(100vw-2rem)] border-border-strong bg-card text-card-foreground"
      >
        {countries.map((country) => (
          <SelectItem
            key={country.code}
            value={country.code}
            className="break-words whitespace-normal focus:bg-accent focus:text-accent-foreground"
          >
            {country.name} ({country.code})
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}
