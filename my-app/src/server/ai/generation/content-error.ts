import type { GenerationDiagnostic } from "./diagnostics";

export class GenerationContentValidationError extends Error {
  constructor(
    public readonly issues: GenerationDiagnostic["issues"],
  ) {
    super("Generated category content is invalid");
    this.name = "GenerationContentValidationError";
  }
}
