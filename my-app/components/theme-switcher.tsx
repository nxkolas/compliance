"use client";

import { DropdownMenuCheckboxItem } from "@/components/ui/dropdown-menu";
import { Moon } from "lucide-react";
import { useEffect, useState } from "react";

const storageKey = "complyx-theme";

function applyTheme(isDark: boolean) {
  document.documentElement.classList.toggle("dark", isDark);
}

function getInitialTheme() {
  const savedTheme = window.localStorage.getItem(storageKey);

  if (savedTheme === "dark") {
    return true;
  }

  if (savedTheme === "light") {
    return false;
  }

  return window.matchMedia("(prefers-color-scheme: dark)").matches;
}

type ThemeSwitcherProps = {
  label: string;
};

export function ThemeSwitcher({ label }: ThemeSwitcherProps) {
  const [isDark, setIsDark] = useState(false);

  useEffect(() => {
    const initialTheme = getInitialTheme();

    setIsDark(initialTheme);
    applyTheme(initialTheme);
  }, []);

  function handleCheckedChange(checked: boolean | "indeterminate") {
    const nextIsDark = checked === true;

    setIsDark(nextIsDark);
    window.localStorage.setItem(storageKey, nextIsDark ? "dark" : "light");
    applyTheme(nextIsDark);
  }

  return (
    <DropdownMenuCheckboxItem
      checked={isDark}
      onCheckedChange={handleCheckedChange}
      onSelect={(event) => event.preventDefault()}
    >
      <span className="flex items-center gap-2">
        <Moon className="size-4" />
        {label}
      </span>
    </DropdownMenuCheckboxItem>
  );
}
