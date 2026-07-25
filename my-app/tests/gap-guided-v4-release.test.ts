import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { compileRelease } from "@/src/server/compliance/publishing/compile-release";
import { nis2ReleaseDefinition } from "@/src/server/compliance/nis2/releases/2026-v1/release";
import { nis2ReleaseDefinition2026V2 } from "@/src/server/compliance/nis2/releases/2026-v2/release";
import { compileGapAnalysisRelease } from "@/src/server/gap-analysis/publishing/compile-release";
import { guidedV4GapRelease } from "@/src/server/gap-analysis/releases/guided-v4/release";

describe("guided-v4 Gap release", () => {
  it("compiles deterministically with the agreed cardinalities and mappings", () => {
    const first = compileGapAnalysisRelease(guidedV4GapRelease);
    const second = compileGapAnalysisRelease(guidedV4GapRelease);
    const questions = guidedV4GapRelease.questionnaire.questions;
    const requirements = guidedV4GapRelease.requirementSet.requirements;

    expect(first.hashes).toEqual(second.hashes);
    expect(questions).toHaveLength(31);
    expect(requirements).toHaveLength(10);
    expect(questions.flatMap((question) => question.options)).toHaveLength(155);
    expect(
      questions.map((question) => question.sourceNumber).sort((a, b) => a! - b!),
    ).toEqual(Array.from({ length: 31 }, (_, index) => index + 1));
    expect(
      new Set(
        requirements.flatMap(
          (requirement) => requirement.questionStableKeys,
        ),
      ).size,
    ).toBe(31);
    for (const question of questions) {
      expect(question.options.map((option) => option.stableValue)).toEqual([
        "fully_implemented",
        "partially_implemented",
        "not_implemented",
        "unsure",
        "not_applicable",
      ]);
      expect(question.text.en.trim()).not.toBe("");
      expect(question.help.en.trim()).not.toBe("");
      expect(question.legalProvisionKeys?.length).toBeGreaterThan(0);
    }
    for (const requirement of requirements) {
      expect(requirement.applicableOutcomeCodes).toEqual([
        "essential_entity",
        "important_entity",
      ]);
    }
  });

  it("matches every reviewed German CSV question and help value", () => {
    const rows = parseCsv(
      readFileSync(
        new URL(
          "../docs/product/1. Gap-Analyse-Fragebogen.xlsx - Gap-Analyse.csv",
          import.meta.url,
        ),
        "utf8",
      ),
    ).slice(3);
    expect(rows).toHaveLength(31);
    for (const row of rows) {
      const sourceNumber = Number(row[0]);
      const question = guidedV4GapRelease.questionnaire.questions.find(
        (candidate) => candidate.sourceNumber === sourceNumber,
      );
      expect(question?.text.de).toBe(row[2]);
      expect(question?.help.de).toBe(row[4]);
    }
  });

  it("extends the legal catalogue without changing applicability behavior", () => {
    expect(() => compileRelease(nis2ReleaseDefinition2026V2)).not.toThrow();
    expect(nis2ReleaseDefinition2026V2.fixtures).toEqual(nis2ReleaseDefinition.fixtures);
    expect(nis2ReleaseDefinition2026V2.questions).toEqual(nis2ReleaseDefinition.questions);
    expect(nis2ReleaseDefinition2026V2.entityTypes).toEqual(
      nis2ReleaseDefinition.entityTypes,
    );
    expect(nis2ReleaseDefinition2026V2.thresholds).toEqual(nis2ReleaseDefinition.thresholds);
    const keys = new Set(
      nis2ReleaseDefinition2026V2.legalInstruments.flatMap((instrument) =>
        instrument.provisions.map(
          (provision) => `${instrument.code}.${provision.code}`,
        ),
      ),
    );
    for (const question of guidedV4GapRelease.questionnaire.questions) {
      for (const key of question.legalProvisionKeys ?? []) {
        expect(keys.has(key), key).toBe(true);
      }
    }
  });
});

function parseCsv(input: string) {
  const rows: string[][] = [];
  let row: string[] = [];
  let field = "";
  let quoted = false;
  for (let index = 0; index < input.length; index += 1) {
    const character = input[index];
    if (character === '"') {
      if (quoted && input[index + 1] === '"') {
        field += '"';
        index += 1;
      } else {
        quoted = !quoted;
      }
    } else if (character === "," && !quoted) {
      row.push(field);
      field = "";
    } else if ((character === "\n" || character === "\r") && !quoted) {
      if (character === "\r" && input[index + 1] === "\n") index += 1;
      row.push(field);
      if (row.some((value) => value.length > 0)) rows.push(row);
      row = [];
      field = "";
    } else {
      field += character;
    }
  }
  if (field || row.length) {
    row.push(field);
    rows.push(row);
  }
  return rows;
}
