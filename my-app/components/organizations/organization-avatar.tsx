import { cn } from "@/src/utils";

export function organizationInitials(name: string) {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (!parts.length) return "OR";
  const initials =
    parts.length === 1
      ? parts[0].slice(0, 2)
      : `${parts[0][0]}${parts.at(-1)?.[0] ?? ""}`;
  return initials.toLocaleUpperCase();
}

function stableHue(id: string) {
  let hash = 0;
  for (const character of id) hash = (hash * 31 + character.charCodeAt(0)) | 0;
  return Math.abs(hash) % 360;
}

export function OrganizationAvatar({
  id,
  name,
  className,
}: {
  id: string;
  name: string;
  className?: string;
}) {
  const hue = stableHue(id);
  return (
    <span
      aria-hidden="true"
      className={cn(
        "flex size-9 shrink-0 items-center justify-center rounded-lg text-xs font-semibold text-primary-foreground",
        className,
      )}
      style={{ backgroundColor: `hsl(${hue} 55% 42%)` }}
    >
      {organizationInitials(name)}
    </span>
  );
}
