import { readFileSync } from "node:fs";
import path from "node:path";
import { Font, StyleSheet } from "@react-pdf/renderer";

/**
 * Hex mirrors of the light-theme design tokens in app/globals.css. The app
 * declares several of them in oklch, which @react-pdf cannot parse, so they are
 * converted once here instead of at every use site.
 */
export const palette = {
  primary: "#002aff", // --primary
  foreground: "#042c53", // --foreground
  muted: "#185fa5", // --muted-foreground
  subtle: "#64748b", // --foreground-subtle
  success: "#16a34a", // --success
  successText: "#166534", // --success-foreground
  warning: "#d97706", // --warning
  warningText: "#92400e", // --warning-foreground
  info: "#2563eb", // --info
  infoText: "#1d4ed8", // --info-foreground
  // --destructive resolves to a very light #ff3b30 that bleeds on paper, so the
  // report uses the muted variant the UI already applies to destructive text.
  danger: "#b91c1c", // --destructive-muted-foreground
  surface: "#f8fafc", // --surface
  surfaceMuted: "#e6f1fb", // --muted
  border: "#e6f1fb", // --border
  borderStrong: "#d7dfeb", // --border-strong
  white: "#ffffff",
} as const;

export const FONT_FAMILY = "Space Grotesk";

const fontDirectory = path.join(process.cwd(), "src", "server", "reports", "fonts");

/**
 * Raster copy of public/images/Logo-schwarz.svg. @react-pdf cannot rasterize
 * SVG files, so the brand mark ships as a PNG. Regenerate with:
 * `sharp('public/images/Logo-schwarz.svg', { density: 600 }).resize({ width: 900 })`
 */
const logoPath = path.join(process.cwd(), "src", "server", "reports", "assets", "logo.png");

/** Intrinsic aspect ratio of the logo (900 × 307). */
export const LOGO_ASPECT_RATIO = 900 / 307;

let logoImage: { data: Buffer; format: "png" } | undefined;

/**
 * @react-pdf resolves a string `src` as a URL, which fails for absolute Windows
 * paths, so the logo is handed over as a buffer and cached across renders.
 */
export function getLogoImage() {
  logoImage ??= { data: readFileSync(logoPath), format: "png" };
  return logoImage;
}

let fontsRegistered = false;

export function registerReportFonts() {
  if (fontsRegistered) return;
  Font.register({
    family: FONT_FAMILY,
    fonts: [
      { src: path.join(fontDirectory, "SpaceGrotesk-Regular.ttf"), fontWeight: 400 },
      { src: path.join(fontDirectory, "SpaceGrotesk-Medium.ttf"), fontWeight: 500 },
      { src: path.join(fontDirectory, "SpaceGrotesk-Bold.ttf"), fontWeight: 700 },
    ],
  });
  // German compounds are long; the default hyphenation splits them in places
  // that read as typos. Keep words intact and let the line breaker wrap.
  Font.registerHyphenationCallback((word) => [word]);
  fontsRegistered = true;
}

export type Tone = "danger" | "warning" | "info" | "success" | "neutral";

export function toneColors(tone: Tone) {
  switch (tone) {
    case "danger":
      return { accent: palette.danger, text: palette.danger, background: "#fef2f2" };
    case "warning":
      return { accent: palette.warning, text: palette.warningText, background: "#fffbeb" };
    case "info":
      return { accent: palette.info, text: palette.infoText, background: "#eff6ff" };
    case "success":
      return { accent: palette.success, text: palette.successText, background: "#f0fdf4" };
    default:
      return { accent: palette.borderStrong, text: palette.subtle, background: palette.surface };
  }
}

export function gapStatusTone(status: string): Tone {
  switch (status) {
    case "not_fulfilled":
      return "danger";
    case "partially_fulfilled":
      return "warning";
    case "insufficient_evidence":
      return "info";
    case "fulfilled":
      return "success";
    default:
      return "neutral";
  }
}

export function actionStatusTone(status: string): Tone {
  switch (status) {
    case "open":
      return "warning";
    case "in_progress":
      return "info";
    case "done":
      return "success";
    default:
      return "neutral";
  }
}

/**
 * A unitless `lineHeight` on the Page style is inherited as-is by @react-pdf and
 * both crowds large headings and silently drops fixed views that contain a
 * dynamic `render` callback (the page footer). Line height is therefore always
 * declared per text style, never on the page.
 */
export const styles = StyleSheet.create({
  page: {
    fontFamily: FONT_FAMILY,
    fontSize: 9.5,
    color: palette.foreground,
    paddingTop: 64,
    paddingBottom: 56,
    paddingHorizontal: 48,
  },
  coverPage: {
    fontFamily: FONT_FAMILY,
    fontSize: 9.5,
    color: palette.foreground,
    backgroundColor: palette.surface,
    padding: 0,
  },
  coverBody: { paddingTop: 84, paddingBottom: 48, paddingHorizontal: 56 },
  coverLogo: { width: 132, height: 132 / LOGO_ASPECT_RATIO, marginBottom: 44 },
  headerLogo: { width: 40, height: 40 / LOGO_ASPECT_RATIO },
  coverEyebrow: {
    fontSize: 8.5,
    lineHeight: 1.4,
    fontWeight: 700,
    letterSpacing: 1.2,
    color: palette.primary,
    marginBottom: 14,
  },
  coverTitle: {
    fontSize: 34,
    lineHeight: 1.2,
    fontWeight: 700,
    letterSpacing: -0.6,
    marginBottom: 40,
  },
  coverOrganization: { fontSize: 18, lineHeight: 1.3, fontWeight: 700 },
  coverLegalName: { fontSize: 10.5, lineHeight: 1.4, color: palette.subtle },
  coverSpacer: { height: 34 },

  outcomeCard: {
    borderWidth: 1,
    borderStyle: "solid",
    borderColor: palette.borderStrong,
    borderRadius: 12,
    backgroundColor: palette.white,
    padding: 20,
    marginBottom: 26,
  },
  outcomeLabel: {
    fontSize: 8,
    lineHeight: 1.4,
    fontWeight: 700,
    letterSpacing: 1,
    color: palette.primary,
    marginBottom: 10,
  },
  outcomeValue: {
    fontSize: 26,
    lineHeight: 1.2,
    fontWeight: 700,
    letterSpacing: -0.4,
    marginBottom: 12,
  },
  outcomeDetail: { fontSize: 10, lineHeight: 1.5, color: palette.muted },

  header: {
    position: "absolute",
    top: 26,
    left: 48,
    right: 48,
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-end",
    borderBottomWidth: 1,
    borderBottomStyle: "solid",
    borderBottomColor: palette.border,
    paddingBottom: 6,
  },
  headerTextMuted: { fontSize: 7.5, lineHeight: 1.4, color: palette.subtle },
  footer: {
    position: "absolute",
    bottom: 26,
    left: 48,
    right: 48,
    flexDirection: "row",
    justifyContent: "space-between",
    borderTopWidth: 1,
    borderTopStyle: "solid",
    borderTopColor: palette.border,
    paddingTop: 6,
  },
  footerText: { fontSize: 7.5, lineHeight: 1.4, color: palette.subtle },
  /**
   * The page counter is produced by a dynamic `render` callback. @react-pdf
   * drops the entire fixed footer when such a Text carries a `lineHeight`, so
   * this variant deliberately omits it.
   */
  footerPageNumber: { fontSize: 7.5, color: palette.subtle },

  sectionEyebrow: {
    fontSize: 8,
    lineHeight: 1.4,
    fontWeight: 700,
    letterSpacing: 1.1,
    color: palette.primary,
    marginBottom: 8,
  },
  sectionTitle: {
    fontSize: 21,
    lineHeight: 1.25,
    fontWeight: 700,
    letterSpacing: -0.4,
    marginBottom: 6,
  },
  sectionIntro: { fontSize: 9.5, lineHeight: 1.45, color: palette.subtle, marginBottom: 20 },
  blockTitle: { fontSize: 12, lineHeight: 1.35, fontWeight: 700, marginBottom: 10, marginTop: 6 },

  headlineTile: {
    borderWidth: 1,
    borderStyle: "solid",
    borderColor: palette.borderStrong,
    borderRadius: 8,
    paddingVertical: 9,
    paddingHorizontal: 12,
    marginBottom: 8,
    flexDirection: "row",
    alignItems: "baseline",
    gap: 8,
  },
  headlineValue: { fontSize: 20, lineHeight: 1.2, fontWeight: 700 },
  headlineLabel: { fontSize: 9.5, lineHeight: 1.4, fontWeight: 500 },

  countStrip: { flexDirection: "row", gap: 8, marginBottom: 20 },
  countTile: {
    flexGrow: 1,
    flexBasis: 0,
    borderWidth: 1,
    borderStyle: "solid",
    borderColor: palette.borderStrong,
    borderRadius: 8,
    paddingVertical: 7,
    paddingHorizontal: 9,
  },
  countValue: { fontSize: 15, lineHeight: 1.25, fontWeight: 700 },
  countLabel: { fontSize: 7, lineHeight: 1.35, color: palette.subtle },

  card: {
    borderWidth: 1,
    borderStyle: "solid",
    borderColor: palette.borderStrong,
    borderRadius: 10,
    padding: 12,
    marginBottom: 10,
  },
  cardHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
    gap: 10,
  },
  cardTitle: { fontSize: 11, lineHeight: 1.35, fontWeight: 700, flexGrow: 1, flexShrink: 1 },
  cardMeta: { fontSize: 8, lineHeight: 1.4, color: palette.subtle, marginTop: 3, marginBottom: 7 },
  cardBody: { fontSize: 9.5, lineHeight: 1.45, marginTop: 4 },
  pill: {
    fontSize: 7.5,
    lineHeight: 1.4,
    fontWeight: 700,
    borderRadius: 999,
    paddingVertical: 3,
    paddingHorizontal: 8,
  },

  bulletRow: { flexDirection: "row", marginBottom: 3 },
  bulletMark: { width: 10, fontSize: 9.5, lineHeight: 1.45, color: palette.muted },
  bulletText: { flexGrow: 1, flexShrink: 1, fontSize: 9.5, lineHeight: 1.45 },

  legalBasis: {
    fontSize: 8,
    lineHeight: 1.45,
    color: palette.subtle,
    marginTop: 8,
    paddingTop: 6,
    borderTopWidth: 1,
    borderTopStyle: "solid",
    borderTopColor: palette.border,
  },

  groupHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    backgroundColor: palette.foreground,
    color: palette.white,
    borderRadius: 8,
    paddingVertical: 6,
    paddingHorizontal: 10,
    marginTop: 8,
    marginBottom: 6,
  },
  groupTitle: { fontSize: 9.5, lineHeight: 1.4, fontWeight: 700, color: palette.white },
  groupCount: { fontSize: 8, lineHeight: 1.4, color: palette.white },

  answerGrid: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  answerCard: {
    width: "48%",
    backgroundColor: palette.surface,
    borderRadius: 6,
    paddingVertical: 7,
    paddingHorizontal: 10,
  },
  answerQuestion: { fontSize: 8.5, lineHeight: 1.4, fontWeight: 700 },
  answerValue: { fontSize: 8.5, lineHeight: 1.4, color: palette.muted, marginTop: 2 },

  methodRow: { flexDirection: "row", gap: 8, marginBottom: 20 },
  methodCard: {
    flexGrow: 1,
    flexBasis: 0,
    borderWidth: 1,
    borderStyle: "solid",
    borderColor: palette.borderStrong,
    borderRadius: 8,
    padding: 9,
  },
  methodStep: {
    fontSize: 8,
    lineHeight: 1.4,
    fontWeight: 700,
    color: palette.primary,
    marginBottom: 4,
  },
  methodTitle: { fontSize: 9, lineHeight: 1.35, fontWeight: 700, marginBottom: 4 },
  methodText: { fontSize: 7.5, lineHeight: 1.45, color: palette.subtle },

  tableHeader: {
    flexDirection: "row",
    gap: 12,
    backgroundColor: palette.foreground,
    borderTopLeftRadius: 8,
    borderTopRightRadius: 8,
    paddingVertical: 6,
    paddingHorizontal: 10,
  },
  tableHeaderCell: {
    fontSize: 7.5,
    lineHeight: 1.4,
    fontWeight: 700,
    letterSpacing: 0.4,
    color: palette.white,
  },
  tableRow: {
    flexDirection: "row",
    gap: 12,
    borderBottomWidth: 1,
    borderBottomStyle: "solid",
    borderBottomColor: palette.border,
    paddingVertical: 7,
    paddingHorizontal: 10,
  },
  tableCell: { fontSize: 8.5, lineHeight: 1.45 },
  // flexBasis 0 + grow keeps the three columns proportional and, with the row
  // gap, stops long legal references from running into the location column.
  columnSource: { flexGrow: 5, flexBasis: 0 },
  columnReference: { flexGrow: 4, flexBasis: 0 },
  columnLocation: { flexGrow: 2, flexBasis: 0 },

  disclaimer: {
    fontSize: 7.5,
    lineHeight: 1.5,
    color: palette.subtle,
    marginTop: 24,
    paddingTop: 10,
    borderTopWidth: 1,
    borderTopStyle: "solid",
    borderTopColor: palette.borderStrong,
  },
  empty: { fontSize: 9, lineHeight: 1.45, color: palette.subtle },
});
