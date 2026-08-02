import {
  Bug,
  Building2,
  ClipboardCheck,
  DatabaseBackup,
  GraduationCap,
  KeyRound,
  Link,
  LockKeyhole,
  Shapes,
  ShieldAlert,
  Siren,
  type LucideIcon,
} from "lucide-react";

const icons: Record<string, LucideIcon> = {
  Building2,
  ShieldAlert,
  KeyRound,
  Siren,
  DatabaseBackup,
  Link,
  Bug,
  ClipboardCheck,
  GraduationCap,
  LockKeyhole,
};

export function GapCategoryIcon({
  name,
  className = "h-5 w-5 shrink-0",
}: {
  name?: string | null;
  className?: string;
}) {
  const Icon = (name && icons[name]) || Shapes;
  return <Icon aria-hidden="true" className={className} />;
}
