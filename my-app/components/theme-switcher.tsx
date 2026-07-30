"use client";

import { Button } from "@/components/ui/button";
import { DropdownMenuCheckboxItem } from "@/components/ui/dropdown-menu";
import { Switch } from "@/components/ui/switch";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { Moon, Sun } from "lucide-react";
import { useTheme } from "next-themes";
import { useEffect, useState } from "react";

function useMountedTheme() {
  const { theme, setTheme } = useTheme();
  const [mounted, setMounted] = useState(false);

  useEffect(() => setMounted(true), []);

  return {
    isDark: mounted && theme === "dark",
    mounted,
    setTheme,
  };
}

export function ThemeSwitcher({ label }: { label: string }) {
  const { isDark, mounted, setTheme } = useMountedTheme();

  return (
    <DropdownMenuCheckboxItem
      checked={isDark}
      disabled={!mounted}
      onCheckedChange={(checked) => setTheme(checked ? "dark" : "light")}
      onSelect={(event) => event.preventDefault()}
      className="pl-2 [&>span:first-child]:hidden"
    >
      <Moon className="size-4 text-muted-foreground" aria-hidden="true" />
      <span className="flex-1">{label}</span>
      <Switch
        checked={isDark}
        tabIndex={-1}
        aria-hidden="true"
        className="pointer-events-none"
      />
    </DropdownMenuCheckboxItem>
  );
}

export function ThemeToggleButton({
  switchToDarkLabel,
  switchToLightLabel,
}: {
  switchToDarkLabel: string;
  switchToLightLabel: string;
}) {
  const { isDark, mounted, setTheme } = useMountedTheme();
  const label = isDark ? switchToLightLabel : switchToDarkLabel;

  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>
          <Button
            type="button"
            size="icon-lg"
            variant="outline"
            aria-label={label}
            aria-pressed={isDark}
            disabled={!mounted}
            onClick={() => setTheme(isDark ? "light" : "dark")}
            className="bg-background/90 backdrop-blur"
          >
            {isDark ? (
              <Sun className="size-4" aria-hidden="true" />
            ) : (
              <Moon className="size-4" aria-hidden="true" />
            )}
          </Button>
        </TooltipTrigger>
        <TooltipContent sideOffset={6}>{label}</TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}
