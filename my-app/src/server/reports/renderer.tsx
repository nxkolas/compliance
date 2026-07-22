import { Document, Page, StyleSheet, Text, View, renderToBuffer } from "@react-pdf/renderer";

const styles = StyleSheet.create({ page: { padding: 42, fontSize: 10 }, title: { fontSize: 22, marginBottom: 18 }, heading: { fontSize: 13, marginTop: 14, marginBottom: 6 }, row: { marginBottom: 4 }, muted: { color: "#555" } });
type Snapshot = { capturedAt: string; applicabilityRevisionId: string | null; gapRevisionId: string | null; actionPlanId: string | null; documentVersionIds: string[] };
export async function renderComplianceReport(input: { reportId: string; organizationId: string; locale: "de" | "en"; snapshot: Snapshot; inputHash: string }) {
  const de = input.locale === "de";
  return renderToBuffer(
    <Document title={de ? "Compliance-Bericht" : "Compliance report"}>
      <Page size="A4" style={styles.page}>
        <Text style={styles.title}>{de ? "Compliance-Bericht" : "Compliance report"}</Text>
        <Text style={styles.muted}>{de ? "Unveränderlicher Datenstand" : "Immutable source snapshot"}: {input.snapshot.capturedAt}</Text>
        <Text style={styles.heading}>{de ? "Quellen" : "Sources"}</Text>
        <View>
          <Text style={styles.row}>Applicability: {input.snapshot.applicabilityRevisionId ?? "-"}</Text>
          <Text style={styles.row}>Gap analysis: {input.snapshot.gapRevisionId ?? "-"}</Text>
          <Text style={styles.row}>Action plan: {input.snapshot.actionPlanId ?? "-"}</Text>
          <Text style={styles.row}>Documents: {input.snapshot.documentVersionIds.length}</Text>
        </View>
        <Text style={styles.heading}>{de ? "Nachweis" : "Provenance"}</Text>
        <Text style={styles.row}>Organization: {input.organizationId}</Text>
        <Text style={styles.row}>Report: {input.reportId}</Text>
        <Text style={styles.row}>Input SHA-256: {input.inputHash}</Text>
      </Page>
    </Document>,
  );
}
