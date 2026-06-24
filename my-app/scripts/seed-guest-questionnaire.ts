import "dotenv/config";
import { and, eq } from "drizzle-orm";
import { db } from "../src/db";
import {
  questionnaireQuestions,
  questionnaireSections,
  questionnaireTemplates,
} from "../src/db/schema";

const templateCode = "nis2_guest_quick_check";
const version = "1";

const questions = [
  {
    code: "country",
    prompt: "In welchem Land ist Ihr Unternehmen niedergelassen?",
    helpText: "Dieser Schnellcheck ist auf Deutschland und die EU ausgerichtet.",
    questionType: "single_choice" as const,
    isRequired: true,
    options: [
      { value: "DE", label: "Deutschland" },
      { value: "EU", label: "Anderer EU-Mitgliedstaat" },
      { value: "OTHER", label: "Außerhalb der EU" },
    ],
    sortOrder: 10,
  },
  {
    code: "covered_sector",
    prompt: "Ist Ihr Unternehmen in einem von NIS2 erfassten Sektor tätig?",
    helpText:
      "Dazu zählen unter anderem Energie, Verkehr, Gesundheit, digitale Infrastruktur und bestimmte produzierende Branchen.",
    questionType: "single_choice" as const,
    isRequired: true,
    options: choiceOptions(),
    sortOrder: 20,
  },
  {
    code: "medium_threshold",
    prompt: "Erreicht Ihr Unternehmen mindestens die Schwelle eines mittleren Unternehmens?",
    helpText:
      "Als Orientierung: mindestens 50 Beschäftigte oder mehr als 10 Mio. EUR Jahresumsatz und Bilanzsumme.",
    questionType: "single_choice" as const,
    isRequired: true,
    options: choiceOptions(),
    sortOrder: 30,
  },
  {
    code: "special_entity",
    prompt: "Gehört Ihr Unternehmen zu einer größenunabhängig erfassten Sonderkategorie?",
    helpText:
      "Beispiele können bestimmte Vertrauensdienste, DNS-Dienste oder besonders kritische Einrichtungen sein.",
    questionType: "single_choice" as const,
    isRequired: true,
    options: choiceOptions(),
    sortOrder: 40,
  },
  {
    code: "lex_specialis",
    prompt: "Könnte eine sektorspezifische Regelung wie DORA vorrangig gelten?",
    helpText:
      "Eine vorrangige Spezialregelung erfordert eine individuelle rechtliche Prüfung.",
    questionType: "single_choice" as const,
    isRequired: true,
    options: choiceOptions(),
    sortOrder: 50,
  },
  {
    code: "notes",
    prompt: "Möchten Sie ergänzende Angaben machen?",
    helpText: "Optional. Tragen Sie hier Besonderheiten oder offene Fragen ein.",
    questionType: "text" as const,
    isRequired: false,
    options: null,
    sortOrder: 60,
  },
];

async function seed() {
  const [template] = await db
    .insert(questionnaireTemplates)
    .values({
      code: templateCode,
      type: "applicability_check",
      version,
      title: "NIS2 Schnellcheck",
      description:
        "Unverbindliche Erstorientierung zur möglichen NIS2-Betroffenheit.",
      isActive: true,
    })
    .onConflictDoUpdate({
      target: [questionnaireTemplates.code, questionnaireTemplates.version],
      set: {
        title: "NIS2 Schnellcheck",
        description:
          "Unverbindliche Erstorientierung zur möglichen NIS2-Betroffenheit.",
        isActive: true,
        updatedAt: new Date(),
      },
    })
    .returning();

  let section = await db.query.questionnaireSections.findFirst({
    where: and(
      eq(questionnaireSections.templateId, template.id),
      eq(questionnaireSections.code, "quick_check"),
    ),
  });

  if (!section) {
    [section] = await db
      .insert(questionnaireSections)
      .values({
        templateId: template.id,
        code: "quick_check",
        title: "Unternehmensangaben",
        description: "Sechs kurze Fragen für eine erste Orientierung.",
        sortOrder: 10,
      })
      .returning();
  } else {
    [section] = await db
      .update(questionnaireSections)
      .set({
        title: "Unternehmensangaben",
        description: "Sechs kurze Fragen für eine erste Orientierung.",
        sortOrder: 10,
      })
      .where(eq(questionnaireSections.id, section.id))
      .returning();
  }

  for (const question of questions) {
    const existing = await db.query.questionnaireQuestions.findFirst({
      where: and(
        eq(questionnaireQuestions.sectionId, section.id),
        eq(questionnaireQuestions.code, question.code),
      ),
    });

    if (existing) {
      await db
        .update(questionnaireQuestions)
        .set(question)
        .where(eq(questionnaireQuestions.id, existing.id));
    } else {
      await db
        .insert(questionnaireQuestions)
        .values({ sectionId: section.id, ...question });
    }
  }

  console.log(`Seeded ${templateCode} v${version} with ${questions.length} questions.`);
}

function choiceOptions() {
  return [
    { value: "yes", label: "Ja" },
    { value: "no", label: "Nein" },
    { value: "unsure", label: "Unsicher" },
  ];
}

seed()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
