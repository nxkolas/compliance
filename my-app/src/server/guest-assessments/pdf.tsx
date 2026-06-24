import {
  Document,
  Page,
  StyleSheet,
  Text,
  View,
} from "@react-pdf/renderer";
import type { getGuestAssessment } from "./service";
import type { Dictionary, Locale } from "@/lib/i18n";

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
  labels,
  locale,
}: {
  assessment: GuestAssessment;
  labels: Dictionary["guestCheck"];
  locale: Locale;
}) {
  const answers = new Map(
    assessment.answers.map((answer) => [answer.questionId, answer.value]),
  );

  return (
    <Document
      title={`${labels.pdf.title} - ${assessment.organization.name}`}
      author="complyX"
      subject={labels.pdf.subject}
      language={locale}
    >
      <Page size="A4" style={styles.page}>
        <Text style={styles.brand}>complyX · NIS2 Compliance Checker</Text>
        <Text style={styles.title}>{labels.pdf.title}</Text>
        <Text style={styles.subtitle}>
          {assessment.organization.name} · {labels.pdf.createdOn}{" "}
          {new Date().toLocaleDateString(locale)}
        </Text>

        <View style={styles.result}>
          <Text style={styles.resultLabel}>{labels.pdf.assessment}</Text>
          <Text style={styles.resultValue}>
            {resultLabel(assessment.run.result, labels.result)}
          </Text>
          <Text style={styles.body}>
            {resultDetails(assessment.assessment.category, labels.result).summary}
          </Text>
          <Text style={[styles.body, { marginTop: 8 }]}>
            {resultDetails(assessment.assessment.category, labels.result).reasoning}
          </Text>
        </View>

        <Text style={styles.sectionTitle}>{labels.pdf.answers}</Text>
        {assessment.template.sections.flatMap((section) =>
          section.questions.map((question) => (
            <View key={question.id} style={styles.answer}>
              <Text style={styles.question}>
                {questionLabels(labels.questionnaire, question.code)?.prompt ??
                  question.prompt}
              </Text>
              <Text style={styles.value}>
                {formatAnswer(
                  answers.get(question.id),
                  questionLabels(labels.questionnaire, question.code)?.options,
                  labels.pdf.noAnswer,
                )}
              </Text>
            </View>
          )),
        )}

        <Text style={styles.footer}>
          {labels.pdf.disclaimer}
        </Text>
      </Page>
    </Document>
  );
}

function resultLabel(
  result: string,
  labels: Dictionary["guestCheck"]["result"],
) {
  if (result === "affected") return labels.presentations.affected;
  if (result === "not_affected") return labels.presentations.notAffected;
  return labels.presentations.possiblyAffected;
}

function resultDetails(
  category: string,
  labels: Dictionary["guestCheck"]["result"],
) {
  if (category === "important") return labels.details.important;
  if (category === "special_case") return labels.details.specialCase;
  if (category === "not_affected") return labels.details.notAffected;
  return labels.details.unknown;
}

function questionLabels(
  labels: Dictionary["guestCheck"]["questionnaire"],
  code: string,
) {
  const questions = labels.questions as Record<
    string,
    { prompt: string; helpText: string; options: Record<string, string> }
  >;
  return questions[code];
}

function formatAnswer(
  value: unknown,
  options: Record<string, string> | undefined,
  noAnswer: string,
) {
  if (!value || typeof value !== "object" || !("value" in value)) return noAnswer;
  const answer = value.value;
  if (typeof answer === "string" && options?.[answer]) return options[answer];
  if (Array.isArray(answer)) return answer.join(", ");
  return String(answer || noAnswer);
}
