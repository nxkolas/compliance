import { Document, Page, StyleSheet, Text, View, renderToBuffer } from "@react-pdf/renderer";
import { reportsMessages } from "@/lib/i18n/messages/reports";
import { formatDateTime } from "@/lib/i18n/format";

const styles = StyleSheet.create({ page: { padding: 42, fontSize: 10 }, title: { fontSize: 22, marginBottom: 18 }, heading: { fontSize: 13, marginTop: 14, marginBottom: 6 }, row: { marginBottom: 4 }, muted: { color: "#555" } });
type Snapshot = { capturedAt: string; applicabilityRevisionId: string | null; gapRevisionId: string | null; actionPlanId: string | null; documentVersionIds: string[] };
export async function renderComplianceReport(input: { reportId: string; organizationId: string; locale: "de" | "en"; snapshot: Snapshot; inputHash: string }) {
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
      </Page>
    </Document>,
  );
}
