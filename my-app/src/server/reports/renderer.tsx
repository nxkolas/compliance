// Aliased: @react-pdf's Image takes no alt prop, and the name `Image` trips
// the jsx-a11y alt-text rule that next/image is registered with.
import { Document, Image as PdfImage, Page, Text, View, renderToBuffer } from "@react-pdf/renderer";
import { modulesMessages } from "@/lib/i18n/messages/modules";
import { reportsMessages } from "@/lib/i18n/messages/reports";
import { formatDateTime } from "@/lib/i18n/format";
import type { Dictionary } from "@/lib/i18n";
import { formatLegalCitations } from "@/src/server/compliance/legal-citation";
import type { GapStatus } from "@/src/server/gap-analysis/workflow-state";
import type { ReportActionStatus, ReportRenderSnapshot } from "./render-snapshot";
import {
  actionStatusTone,
  gapStatusTone,
  getLogoImage,
  palette,
  registerReportFonts,
  styles,
  toneColors,
  type Tone,
} from "./theme";

type Locale = "de" | "en";
type PdfLabels = Dictionary["reports"]["pdf"];
type GapLabels = Dictionary["modules"]["gapAnalysis"]["workflow"];
type ActionLabels = Dictionary["modules"]["actionPlan"]["workflow"];

const METHODOLOGY_STEPS = [
  "applicability",
  "gapAnalysis",
  "actions",
  "report",
] as const;

const GAP_STATUS_ORDER: GapStatus[] = [
  "not_fulfilled",
  "partially_fulfilled",
  "insufficient_evidence",
  "fulfilled",
];
const ACTION_STATUS_ORDER: ReportActionStatus[] = [
  "open",
  "in_progress",
  "done",
  "cancelled",
];

export async function renderComplianceReport(input: {
  locale: Locale;
  snapshot: ReportRenderSnapshot;
}) {
  registerReportFonts();

  const { locale, snapshot } = input;
  const pdf = reportsMessages[locale].reports.pdf;
  const gapLabels = modulesMessages[locale].modules.gapAnalysis.workflow;
  const actionLabels = modulesMessages[locale].modules.actionPlan.workflow;
  const { content } = snapshot;
  const organizationName = content.organization.name;

  return renderToBuffer(
    <Document title={pdf.title} subject={pdf.subject} language={locale}>
      <CoverPage locale={locale} pdf={pdf} snapshot={snapshot} />

      <ContentPage organizationName={organizationName} content={content} pdf={pdf}>
        <SectionHeading
          eyebrow={pdf.eyebrow}
          title={pdf.applicabilitySection}
          intro={pdf.applicabilityIntro}
        />
        <OutcomeCard locale={locale} pdf={pdf} applicability={content.applicability} compact />
        <Text style={styles.blockTitle}>{pdf.answers}</Text>
        <View style={styles.answerGrid}>
          {content.applicability.answers.map((answer, index) => (
            <View key={`answer-${index}`} style={styles.answerCard} wrap={false}>
              <Text style={styles.answerQuestion}>{answer.question}</Text>
              <Text style={styles.answerValue}>{answer.answer}</Text>
            </View>
          ))}
        </View>
      </ContentPage>

      <ContentPage organizationName={organizationName} content={content} pdf={pdf}>
        <SectionHeading
          eyebrow={pdf.eyebrow}
          title={pdf.findingsSection}
          intro={pdf.findingsIntro}
        />
        <HeadlineTile value={content.gap.openGapItemCount} label={pdf.openGaps} tone="danger" />
        <View style={styles.countStrip}>
          {GAP_STATUS_ORDER.map((status) => (
            <CountTile
              key={status}
              value={content.gap.statusCounts[status]}
              label={gapLabels.statuses[status]}
              tone={gapStatusTone(status)}
            />
          ))}
        </View>
        {content.gap.findings.length === 0 ? (
          <Text style={styles.empty}>{pdf.noFindings}</Text>
        ) : (
          content.gap.findings.map((finding, index) => (
            <FindingCard
              key={`finding-${index}`}
              finding={finding}
              pdf={pdf}
              gapLabels={gapLabels}
            />
          ))
        )}
      </ContentPage>

      <ContentPage organizationName={organizationName} content={content} pdf={pdf}>
        <SectionHeading
          eyebrow={pdf.eyebrow}
          title={pdf.actionsSection}
          intro={pdf.actionsIntro}
        />
        <View style={styles.countStrip}>
          {ACTION_STATUS_ORDER.map((status) => (
            <CountTile
              key={status}
              value={content.actions.statusCounts[status]}
              label={actionLabels.statuses[status]}
              tone={actionStatusTone(status)}
            />
          ))}
        </View>
        {content.actions.groups.length === 0 ? (
          <Text style={styles.empty}>{pdf.noActions}</Text>
        ) : (
          content.actions.groups.map((group, groupIndex) => (
            <View key={`group-${groupIndex}`}>
              <View style={styles.groupHeader} wrap={false}>
                <Text style={styles.groupTitle}>{group.findingTitle}</Text>
                <Text style={styles.groupCount}>
                  {group.items.length} {group.items.length === 1 ? pdf.measure : pdf.measures}
                </Text>
              </View>
              {group.items.map((item, itemIndex) => (
                <ActionCard
                  key={`action-${groupIndex}-${itemIndex}`}
                  item={item}
                  actionLabels={actionLabels}
                />
              ))}
            </View>
          ))
        )}
      </ContentPage>

      <ContentPage organizationName={organizationName} content={content} pdf={pdf}>
        <SectionHeading
          eyebrow={pdf.eyebrow}
          title={pdf.appendix}
          intro={pdf.appendixIntro}
        />
        <Text style={styles.blockTitle}>{pdf.methodology}</Text>
        <View style={styles.methodRow}>
          {METHODOLOGY_STEPS.map((key, index) => (
            <View key={key} style={styles.methodCard}>
              <Text style={styles.methodStep}>{String(index + 1).padStart(2, "0")}</Text>
              <Text style={styles.methodTitle}>{pdf.methodologySteps[key].title}</Text>
              <Text style={styles.methodText}>{pdf.methodologySteps[key].text}</Text>
            </View>
          ))}
        </View>

        <Text style={styles.blockTitle}>{pdf.sourceRegister}</Text>
        {content.sourceRegister.length === 0 ? (
          <Text style={styles.empty}>{pdf.noSources}</Text>
        ) : (
          <View>
            <View style={styles.tableHeader} wrap={false}>
              <Text style={[styles.tableHeaderCell, styles.columnSource]}>
                {pdf.registerSource}
              </Text>
              <Text style={[styles.tableHeaderCell, styles.columnReference]}>
                {pdf.registerReference}
              </Text>
              <Text style={[styles.tableHeaderCell, styles.columnLocation]}>
                {pdf.registerLocation}
              </Text>
            </View>
            {content.sourceRegister.map((entry, index) => (
              <View key={`source-${index}`} style={styles.tableRow} wrap={false}>
                <Text style={[styles.tableCell, styles.columnSource]}>{entry.title}</Text>
                <Text style={[styles.tableCell, styles.columnReference, { color: palette.muted }]}>
                  {entry.reference ?? "—"}
                </Text>
                <Text style={[styles.tableCell, styles.columnLocation, { color: palette.subtle }]}>
                  {entry.location ?? "—"}
                </Text>
              </View>
            ))}
          </View>
        )}
        <Text style={styles.disclaimer}>{pdf.disclaimer}</Text>
      </ContentPage>
    </Document>,
  );
}

function CoverPage({
  locale,
  pdf,
  snapshot,
}: {
  locale: Locale;
  pdf: PdfLabels;
  snapshot: ReportRenderSnapshot;
}) {
  const { organization, applicability } = snapshot.content;
  return (
    <Page size="A4" style={styles.coverPage}>
      <View style={styles.coverBody}>
        <PdfImage style={styles.coverLogo} src={getLogoImage()} />
        <Text style={styles.coverEyebrow}>{pdf.eyebrow}</Text>
        <Text style={styles.coverTitle}>{pdf.title}</Text>
        <Text style={styles.coverOrganization}>{organization.name}</Text>
        {organization.legalName ? (
          <Text style={styles.coverLegalName}>{organization.legalName}</Text>
        ) : null}
        <View style={styles.coverSpacer} />
        <OutcomeCard locale={locale} pdf={pdf} applicability={applicability} />
        <Text style={{ fontSize: 8.5, fontWeight: 700, color: palette.subtle }}>
          {pdf.immutableSnapshot}
        </Text>
        <Text style={{ fontSize: 11, marginTop: 3 }}>
          {formatDateTime(snapshot.capturedAt, locale)}
        </Text>
        <Text style={styles.disclaimer}>{pdf.disclaimer}</Text>
      </View>
    </Page>
  );
}

function OutcomeCard({
  locale,
  pdf,
  applicability,
  compact = false,
}: {
  locale: Locale;
  pdf: PdfLabels;
  applicability: ReportRenderSnapshot["content"]["applicability"];
  compact?: boolean;
}) {
  return (
    <View style={styles.outcomeCard} wrap={false}>
      <Text style={styles.outcomeLabel}>{pdf.scopeResult}</Text>
      <Text style={[styles.outcomeValue, { fontSize: compact ? 20 : 26 }]}>
        {applicability.outcome}
      </Text>
      {applicability.jurisdiction ? (
        <Text style={styles.outcomeDetail}>
          {pdf.jurisdiction}: {jurisdictionLabel(applicability.jurisdiction, locale)}
        </Text>
      ) : null}
    </View>
  );
}

function FindingCard({
  finding,
  pdf,
  gapLabels,
}: {
  finding: ReportRenderSnapshot["content"]["gap"]["findings"][number];
  pdf: PdfLabels;
  gapLabels: GapLabels;
}) {
  const colors = toneColors(gapStatusTone(finding.status));
  return (
    <View style={styles.card} wrap={false}>
      <View style={styles.cardHeader}>
        <Text style={styles.cardTitle}>{finding.title}</Text>
        <Text
          style={[
            styles.pill,
            { color: colors.text, backgroundColor: colors.background },
          ]}
        >
          {gapLabels.statuses[finding.status]}
        </Text>
      </View>
      <Text style={styles.cardMeta}>
        {pdf.evidenceStatus}:{" "}
        {finding.hasOrganizationDocument
          ? gapLabels.supportHasDocument
          : gapLabels.supportNoDocument}
      </Text>
      {finding.reviewNotice ? (
        <Text style={[styles.cardMeta, { color: palette.warningText }]}>
          {gapLabels.reviewRequired}: {finding.reviewNotice}
        </Text>
      ) : null}
      {finding.gaps.map((gap, index) => (
        <Bullet key={`gap-${index}`} text={gap} />
      ))}
      {finding.legalReferences.length ? (
        <Text style={styles.legalBasis}>
          {pdf.legalBasis}: {formatLegalCitations(finding.legalReferences)}
        </Text>
      ) : null}
    </View>
  );
}

function ActionCard({
  item,
  actionLabels,
}: {
  item: ReportRenderSnapshot["content"]["actions"]["groups"][number]["items"][number];
  actionLabels: ActionLabels;
}) {
  const colors = toneColors(actionStatusTone(item.status));
  return (
    <View style={styles.card} wrap={false}>
      <View style={styles.cardHeader}>
        <Text style={styles.cardTitle}>{item.title}</Text>
        <Text
          style={[
            styles.pill,
            { color: colors.text, backgroundColor: colors.background },
          ]}
        >
          {actionLabels.statuses[item.status]}
        </Text>
      </View>
      <Text style={styles.cardBody}>{item.result}</Text>
      {item.suggestedEvidence.length ? (
        <Text style={styles.legalBasis}>
          {actionLabels.recommendedEvidence}: {item.suggestedEvidence.join(" · ")}
        </Text>
      ) : null}
    </View>
  );
}

function ContentPage({
  organizationName,
  content,
  pdf,
  children,
}: {
  organizationName: string;
  content: ReportRenderSnapshot["content"];
  pdf: PdfLabels;
  children: React.ReactNode;
}) {
  const footerLeft = content.organization.legalName ?? organizationName;
  return (
    <Page size="A4" style={styles.page}>
      <View style={styles.header} fixed>
        <PdfImage style={styles.headerLogo} src={getLogoImage()} />
        <Text style={styles.headerTextMuted}>{pdf.title}</Text>
      </View>
      <View style={styles.footer} fixed>
        <Text style={styles.footerText}>
          {footerLeft} · {pdf.confidential}
        </Text>
        <Text
          style={styles.footerPageNumber}
          render={({ pageNumber, totalPages }) =>
            pdf.pageOf
              .replace("{page}", String(pageNumber))
              .replace("{total}", String(totalPages))
          }
        />
      </View>
      {children}
    </Page>
  );
}

function SectionHeading({
  eyebrow,
  title,
  intro,
}: {
  eyebrow: string;
  title: string;
  intro: string;
}) {
  return (
    <View>
      <Text style={styles.sectionEyebrow}>{eyebrow}</Text>
      <Text style={styles.sectionTitle}>{title}</Text>
      <Text style={styles.sectionIntro}>{intro}</Text>
    </View>
  );
}

function HeadlineTile({
  value,
  label,
  tone,
}: {
  value: number;
  label: string;
  tone: Tone;
}) {
  const colors = toneColors(tone);
  return (
    <View style={styles.headlineTile}>
      <Text style={[styles.headlineValue, { color: colors.text }]}>{value}</Text>
      <Text style={styles.headlineLabel}>{label}</Text>
    </View>
  );
}

function CountTile({
  value,
  label,
  tone,
}: {
  value: number;
  label: string;
  tone: Tone;
}) {
  const colors = toneColors(tone);
  return (
    <View style={styles.countTile}>
      <Text style={[styles.countValue, { color: colors.text }]}>{value}</Text>
      <Text style={styles.countLabel}>{label}</Text>
    </View>
  );
}

function Bullet({ text }: { text: string }) {
  return (
    <View style={styles.bulletRow}>
      <Text style={styles.bulletMark}>•</Text>
      <Text style={styles.bulletText}>{text}</Text>
    </View>
  );
}

function jurisdictionLabel(code: string, locale: Locale) {
  try {
    const display = new Intl.DisplayNames([locale], { type: "region" }).of(
      code.toUpperCase(),
    );
    return display && display !== code.toUpperCase()
      ? `${display} (${code.toUpperCase()})`
      : code.toUpperCase();
  } catch {
    return code.toUpperCase();
  }
}
