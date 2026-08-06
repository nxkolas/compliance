import { describe, expect, it } from "vitest";
import { validateGeneratedAction } from "@/src/server/action-plans/action-style";
import { ACTION_PLAN_PROMPT_TEMPLATE } from "@/src/server/action-plans/prompt-contract";

describe("generated Action Plan style", () => {
  it("states the validator ceilings in the model prompt", () => {
    expect(ACTION_PLAN_PROMPT_TEMPLATE).toContain("at most 12 words");
    expect(ACTION_PLAN_PROMPT_TEMPLATE).toContain("at most 40 words");
    expect(ACTION_PLAN_PROMPT_TEMPLATE).toContain(
      "one to five concrete evidence names",
    );
  });

  it("accepts concise action content", () => {
    expect(
      validateGeneratedAction({
        title: "Introduce MFA for privileged access",
        result: "Privileged accounts require MFA when signing in.",
        suggestedEvidence: ["MFA policy", "MFA configuration export"],
        locale: "en",
        gapKinds: ["missing"],
      }),
    ).toEqual({
      title: "Introduce MFA for privileged access",
      result: "Privileged accounts require MFA when signing in.",
      suggestedEvidence: ["MFA policy", "MFA configuration export"],
    });
  });

  it("enforces explicit title, result, and evidence ceilings", () => {
    expect(() =>
      validateGeneratedAction({
        title:
          "Introduce and configure and validate and document and deploy and monitor and review MFA everywhere immediately",
        result: "Privileged access uses MFA.",
        suggestedEvidence: ["MFA export"],
        locale: "en",
        gapKinds: ["missing"],
      }),
    ).toThrow(/12 words/i);
    expect(() =>
      validateGeneratedAction({
        title: "Introduce MFA",
        result: `${"MFA coverage is documented and tested. ".repeat(9)}`,
        suggestedEvidence: ["MFA export"],
        locale: "en",
        gapKinds: ["missing"],
      }),
    ).toThrow(/40 words/i);
    expect(() =>
      validateGeneratedAction({
        title: "Introduce MFA",
        result: "Privileged access uses MFA.",
        suggestedEvidence: [],
        locale: "en",
        gapKinds: ["missing"],
      }),
    ).toThrow(/evidence/i);
  });

  it.each([
    "Establish MFA as required by NIS2 and BSI law.",
    "Document restoration testing as required by legal obligations.",
    "Implement controls to satisfy statutory requirements.",
    "Die Umsetzung erfÃ¼llt die gesetzlichen NIS2-Verpflichtungen.",
  ])("rejects legal-analysis prose: %s", (result) => {
    expect(() =>
      validateGeneratedAction({
        title: "Implement the control",
        result,
        suggestedEvidence: ["Implementation record"],
        locale: result.startsWith("Die ") ? "de" : "en",
        gapKinds: ["missing"],
      }),
    ).toThrow(/legal analysis/i);
  });

  it("requires verification-first, conditional work for uncertain gaps", () => {
    expect(() =>
      validateGeneratedAction({
        title: "Introduce MFA for privileged access",
        result: "Privileged access requires MFA.",
        suggestedEvidence: ["MFA export"],
        locale: "en",
        gapKinds: ["uncertain"],
      }),
    ).toThrow(/verification/i);

    expect(
      validateGeneratedAction({
        title: "Verify MFA coverage",
        result:
          "MFA coverage is documented, and any identified deficiencies are corrected.",
        suggestedEvidence: ["MFA coverage record"],
        locale: "en",
        gapKinds: ["uncertain"],
      }),
    ).toMatchObject({ title: "Verify MFA coverage" });

    expect(
      validateGeneratedAction({
        title: "Check risk analysis updates",
        result:
          "Remediation will depend on identifying gaps in regular or post-incident updates.",
        suggestedEvidence: ["Risk analysis update log"],
        locale: "en",
        gapKinds: ["uncertain"],
      }),
    ).toMatchObject({ title: "Check risk analysis updates" });

    expect(
      validateGeneratedAction({
        title: "Confirm risk analysis updates",
        result:
          "Remediation is conditional upon identifying that updates are lacking.",
        suggestedEvidence: ["Risk analysis revision log"],
        locale: "en",
        gapKinds: ["uncertain"],
      }),
    ).toMatchObject({ title: "Confirm risk analysis updates" });

    expect(
      validateGeneratedAction({
        title: "Regelmäßigkeit von Wiederherstellungstests prüfen",
        result:
          "Verifizieren Sie, ob Wiederherstellungstests durchgeführt werden. Eine Anpassung ist nur bei festgestellten Mängeln vorzusehen.",
        suggestedEvidence: ["Wiederherstellungstest-Bericht"],
        locale: "de",
        gapKinds: ["uncertain"],
      }),
    ).toMatchObject({
      title: "Regelmäßigkeit von Wiederherstellungstests prüfen",
    });

    expect(
      validateGeneratedAction({
        title: "Vorhandensein einer Risikoanalyse prüfen",
        result:
          "Dokumentieren Sie, ob eine aktuelle Risikoanalyse vorliegt. Etwaige Lücken sind zu adressieren.",
        suggestedEvidence: ["Risikoanalyse-Dokument"],
        locale: "de",
        gapKinds: ["uncertain"],
      }),
    ).toMatchObject({ title: "Vorhandensein einer Risikoanalyse prüfen" });

    expect(
      validateGeneratedAction({
        title: "Backup-Schutz überprüfen",
        result:
          "Prüfen Sie, ob Backups geschützt sind; ggf. sind fehlende Schutzmaßnahmen einzurichten.",
        suggestedEvidence: ["Backup-Schutzkonzept"],
        locale: "de",
        gapKinds: ["uncertain"],
      }),
    ).toMatchObject({ title: "Backup-Schutz überprüfen" });

    expect(
      validateGeneratedAction({
        title: "Nachvollziehen, ob Backups getrennt gespeichert werden",
        result:
          "Besteht Handlungsbedarf, ist die Trennung der Backups umzusetzen.",
        suggestedEvidence: ["Backup-Speicherarchitektur"],
        locale: "de",
        gapKinds: ["uncertain"],
      }),
    ).toMatchObject({
      title: "Nachvollziehen, ob Backups getrennt gespeichert werden",
    });

    expect(
      validateGeneratedAction({
        title: "Cyberhygiene-Regeln überprüfen",
        result:
          "Sollten Lücken bestehen, sind verbindliche Regeln zu dokumentieren.",
        suggestedEvidence: ["Cyberhygiene-Leitfaden"],
        locale: "de",
        gapKinds: ["uncertain"],
      }),
    ).toMatchObject({ title: "Cyberhygiene-Regeln überprüfen" });

    expect(
      validateGeneratedAction({
        title: "Notfallplan überprüfen",
        result:
          "Vor weiterem Handeln klären, ob ein aktueller Notfallplan existiert.",
        suggestedEvidence: ["Notfallplan"],
        locale: "de",
        gapKinds: ["uncertain"],
      }),
    ).toMatchObject({ title: "Notfallplan überprüfen" });

    expect(
      validateGeneratedAction({
        title: "Sichere Kommunikationswege prüfen",
        result:
          "Identifizierte Defizite sind zu beheben und nachvollziehbar zu dokumentieren.",
        suggestedEvidence: ["Prüfbericht Kommunikationswege"],
        locale: "de",
        gapKinds: ["uncertain"],
      }),
    ).toMatchObject({ title: "Sichere Kommunikationswege prüfen" });

    expect(
      validateGeneratedAction({
        title: "Security-by-Design-Vorgaben prüfen",
        result:
          "Prüfen Sie die Vorgaben. Nur falls dies nicht nachvollziehbar belegt werden kann, Vorgaben etablieren.",
        suggestedEvidence: ["Beschaffungsvorgaben"],
        locale: "de",
        gapKinds: ["uncertain"],
      }),
    ).toMatchObject({ title: "Security-by-Design-Vorgaben prüfen" });

    expect(() =>
      validateGeneratedAction({
        title: "MFA-Abdeckung überprüfen",
        result:
          "Prüfen Sie, ob MFA verwendet wird. MFA ist anschließend einzuführen.",
        suggestedEvidence: ["MFA-Prüfbericht"],
        locale: "de",
        gapKinds: ["uncertain"],
      }),
    ).toThrow(/conditional/i);

    expect(() =>
      validateGeneratedAction({
        title: "Cyberhygiene-Regeln überprüfen",
        result:
          "Es ist erkannt, ob verbindliche Regeln bestehen. Falls nötig, werden Regeln erstellt.",
        suggestedEvidence: ["Cyberhygiene-Richtlinie"],
        locale: "de",
        gapKinds: ["uncertain"],
      }),
    ).toThrow(/conditional/i);

    expect(() =>
      validateGeneratedAction({
        title: "Cyberhygiene-Regeln überprüfen",
        result:
          "Es ist erkannt, ob verbindliche Regeln bestehen. Bei Bedarf werden Regeln erstellt.",
        suggestedEvidence: ["Cyberhygiene-Richtlinie"],
        locale: "de",
        gapKinds: ["uncertain"],
      }),
    ).toThrow(/conditional/i);
  });
});
