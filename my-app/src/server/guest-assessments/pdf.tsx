import {
  Document,
  Page,
  StyleSheet,
  Text,
  View,
} from "@react-pdf/renderer";
import type { getGuestAssessment } from "./service";

type GuestAssessment = Awaited<ReturnType<typeof getGuestAssessment>>;

const styles = StyleSheet.create({
  page: { padding: 44, fontFamily: "Helvetica", color: "#111827" },
  brand: { fontSize: 11, color: "#002aff", marginBottom: 24 },
  title: { fontSize: 25, fontWeight: 700, marginBottom: 8 },
  subtitle: { fontSize: 11, color: "#4b5563", marginBottom: 28 },
  result: {
    border: "1 solid #d1d5db",
    borderRadius: 8,
    padding: 18,
    marginBottom: 22,
  },
  resultLabel: { fontSize: 10, color: "#6b7280", marginBottom: 5 },
  resultValue: { fontSize: 18, fontWeight: 700, marginBottom: 8 },
  body: { fontSize: 11, lineHeight: 1.5 },
  sectionTitle: { fontSize: 14, fontWeight: 700, marginBottom: 10 },
  answer: { marginBottom: 10 },
  question: { fontSize: 10, color: "#4b5563", marginBottom: 3 },
  value: { fontSize: 11 },
  footer: {
    position: "absolute",
    left: 44,
    right: 44,
    bottom: 32,
    fontSize: 8,
    color: "#6b7280",
  },
});

export function GuestAssessmentPdf({
  assessment,
}: {
  assessment: GuestAssessment;
}) {
  const answers = new Map(
    assessment.answers.map((answer) => [answer.questionId, answer.value]),
  );

  return (
    <Document
      title={`NIS2 Schnellcheck - ${assessment.organization.name}`}
      author="complyX"
      subject="Unverbindliche NIS2-Erstorientierung"
      language="de"
    >
      <Page size="A4" style={styles.page}>
        <Text style={styles.brand}>complyX · NIS2 Compliance Checker</Text>
        <Text style={styles.title}>Ergebnis Ihres NIS2 Schnellchecks</Text>
        <Text style={styles.subtitle}>
          {assessment.organization.name} · Erstellt am{" "}
          {new Date().toLocaleDateString("de-DE")}
        </Text>

        <View style={styles.result}>
          <Text style={styles.resultLabel}>EINSCHÄTZUNG</Text>
          <Text style={styles.resultValue}>
            {resultLabel(assessment.run.result)}
          </Text>
          <Text style={styles.body}>{assessment.run.summary ?? ""}</Text>
          <Text style={[styles.body, { marginTop: 8 }]}>
            {assessment.run.reasoning ?? ""}
          </Text>
        </View>

        <Text style={styles.sectionTitle}>Ihre Angaben</Text>
        {assessment.template.sections.flatMap((section) =>
          section.questions.map((question) => (
            <View key={question.id} style={styles.answer}>
              <Text style={styles.question}>{question.prompt}</Text>
              <Text style={styles.value}>
                {formatAnswer(answers.get(question.id))}
              </Text>
            </View>
          )),
        )}

        <Text style={styles.footer}>
          Dieser Schnellcheck dient ausschließlich der unverbindlichen
          Erstorientierung und ist keine Rechtsberatung. Eine abschließende
          Bewertung erfordert die Prüfung Ihrer konkreten Umstände.
        </Text>
      </Page>
    </Document>
  );
}

function resultLabel(result: string) {
  if (result === "affected") return "Voraussichtlich betroffen";
  if (result === "not_affected") return "Aktuell nicht erkennbar betroffen";
  return "Individuelle Prüfung erforderlich";
}

function formatAnswer(value: unknown) {
  if (!value || typeof value !== "object" || !("value" in value)) return "—";
  const answer = value.value;
  if (answer === "yes") return "Ja";
  if (answer === "no") return "Nein";
  if (answer === "unsure") return "Unsicher";
  if (answer === "DE") return "Deutschland";
  if (answer === "EU") return "Anderer EU-Mitgliedstaat";
  if (answer === "OTHER") return "Außerhalb der EU";
  if (Array.isArray(answer)) return answer.join(", ");
  return String(answer || "—");
}
