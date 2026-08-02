export const DEFAULT_AI_CATEGORY_CONCURRENCY = 3;
export const MAX_AI_CATEGORY_CONCURRENCY = 5;
export const DEFAULT_AI_PROVIDER_MAX_CONCURRENCY = 3;
export const MAX_AI_PROVIDER_MAX_CONCURRENCY = 100;

type AiConcurrencyEnvironment = Readonly<
  Record<string, string | undefined>
>;

/**
 * Resolves the number of category workers used by Gap and Action Plan
 * generation. Values outside the supported benchmark range fail explicitly
 * instead of being silently reduced to a different setting.
 */
export function configuredCategoryConcurrency(
  environment: AiConcurrencyEnvironment = process.env,
) {
  return boundedEnvironmentInteger({
    environment,
    name: "AI_CATEGORY_CONCURRENCY",
    fallback: DEFAULT_AI_CATEGORY_CONCURRENCY,
    maximum: MAX_AI_CATEGORY_CONCURRENCY,
  });
}

/** Resolves the per-process shared provider-attempt permit count. */
export function configuredProviderMaxConcurrency(
  environment: AiConcurrencyEnvironment = process.env,
) {
  return boundedEnvironmentInteger({
    environment,
    name: "AI_PROVIDER_MAX_CONCURRENCY",
    fallback: DEFAULT_AI_PROVIDER_MAX_CONCURRENCY,
    maximum: MAX_AI_PROVIDER_MAX_CONCURRENCY,
  });
}

function boundedEnvironmentInteger(input: {
  environment: AiConcurrencyEnvironment;
  name: "AI_CATEGORY_CONCURRENCY" | "AI_PROVIDER_MAX_CONCURRENCY";
  fallback: number;
  maximum: number;
}) {
  const raw = input.environment[input.name];
  if (raw === undefined) return input.fallback;
  const value = Number(raw);
  if (!Number.isInteger(value) || value < 1 || value > input.maximum) {
    throw new Error(
      `${input.name} must be an integer between 1 and ${input.maximum}`,
    );
  }
  return value;
}
