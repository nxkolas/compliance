import { Document, Page, StyleSheet, Text, View, renderToBuffer } from "@react-pdf/renderer";
import { reportsMessages } from "@/lib/i18n/messages/reports";
import { formatDateTime } from "@/lib/i18n/format";
import type { ReportRenderSnapshot } from "./render-snapshot";

const styles = StyleSheet.create({ page: { padding: 42, fontSize: 10 }, title: { fontSize: 22, marginBottom: 18 }, heading: { fontSize: 13, marginTop: 14, marginBottom: 6 }, row: { marginBottom: 4 }, muted: { color: "#555" } });
export async function renderComplianceReport(input: { reportId: string; organizationId: string; locale: "de" | "en"; snapshot: ReportRenderSnapshot; inputHash: string }) {
  const labels = reportsMessages[input.locale].reports.pdf;
  return renderToBuffer(
    <Document title={labels.title} subject={labels.subject} language={input.locale}>
      <Page size="A4" style={styles.page}>
        <Text style={styles.title}>{labels.title}</Text>
        <Text style={styles.muted}>
          {labels.immutableSnapshot}:{" "}
          {formatDateTime(input.snapshot.capturedAt, input.locale)}
        </Text>
        <Text style={styles.heading}>{labels.sources}</Text>
        <View>
          <Text style={styles.row}>{labels.applicability}: {input.snapshot.applicabilityRevisionId ?? "-"}</Text>
          <Text style={styles.row}>{labels.gapAnalysis}: {input.snapshot.gapRevisionId ?? "-"}</Text>
          <Text style={styles.row}>{labels.actionPlan}: {input.snapshot.actionPlanId ?? "-"}</Text>
          <Text style={styles.row}>{labels.documents}: {input.snapshot.documentVersionIds.length}</Text>
        </View>
        <Text style={styles.heading}>{labels.provenance}</Text>
        <Text style={styles.row}>{labels.organization}: {input.organizationId}</Text>
        <Text style={styles.row}>{labels.report}: {input.reportId}</Text>
        <Text style={styles.row}>{labels.inputHash}: {input.inputHash}</Text>
        <>
            <Text style={styles.heading}>{input.locale === "de" ? "Betroffenheitsergebnis" : "Applicability result"}</Text>
            <Text style={styles.row}>{input.snapshot.content.applicability.outcome}</Text>
            {input.snapshot.content.applicability.jurisdiction ? (
              <Text style={styles.row}>{input.locale === "de" ? "Rechtsraum" : "Jurisdiction"}: {input.snapshot.content.applicability.jurisdiction}</Text>
            ) : null}
            {input.snapshot.content.applicability.answers.map((answer, index) => (
              <View key={`answer-${index}`} style={styles.row}>
                <Text>{answer.question}</Text>
                <Text style={styles.muted}>{answer.answer}</Text>
              </View>
            ))}
            <Text style={styles.heading}>{input.locale === "de" ? "Feststellungen und Lücken" : "Findings and gaps"}</Text>
            {input.snapshot.content.findings.map((finding, index) => (
              <View key={`finding-${index}`} style={styles.row} wrap={false}>
                <Text>{finding.title} — {finding.status}</Text>
                <Text style={styles.muted}>
                  {finding.hasOrganizationDocument
                    ? input.locale === "de" ? "Dokument hinterlegt" : "Document provided"
                    : input.locale === "de" ? "Kein Dokument hinterlegt" : "No document provided"}
                </Text>
                {finding.reviewNotice ? <Text>{finding.reviewNotice}</Text> : null}
                {finding.gaps.map((gap, gapIndex) => (
                  <Text key={`gap-${gapIndex}`}>• {gap}</Text>
                ))}
                {finding.sources.map((source, sourceIndex) => (
                  <Text key={`source-${sourceIndex}`} style={styles.muted}>{input.locale === "de" ? "Quelle" : "Source"}: {source}</Text>
                ))}
              </View>
            ))}
            <Text style={styles.heading}>{input.locale === "de" ? "Maßnahmen" : "Actions"}</Text>
            {input.snapshot.content.actions.map((action, index) => (
              <View key={`action-${index}`} style={styles.row} wrap={false}>
                <Text>{action.title} — {action.status}</Text>
                <Text>{action.description}</Text>
              </View>
            ))}
        </>
      </Page>
    </Document>,
  );
}
