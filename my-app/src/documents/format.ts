import { localeTag } from "@/src/i18n/format";
import type { Locale } from "@/src/i18n/config";

export function formatDocumentBytes(bytes: number, locale: Locale) {
  const unit = bytes >= 1024 * 1024 ? "MB" : "KB";
  const divisor = unit === "MB" ? 1024 * 1024 : 1024;
  const value = bytes / divisor;
  return `${new Intl.NumberFormat(localeTag(locale), {
    minimumFractionDigits: value < 10 ? 1 : 0,
    maximumFractionDigits: value < 10 ? 1 : 0,
  }).format(value)} ${unit}`;
}

export function documentTypeLabel(mimeType: string) {
  switch (mimeType) {
    case "application/pdf":
      return "PDF";
    case "application/vnd.openxmlformats-officedocument.wordprocessingml.document":
      return "DOCX";
    case "text/plain":
      return "TXT";
    case "text/markdown":
      return "Markdown";
    default:
      return mimeType;
  }
}
