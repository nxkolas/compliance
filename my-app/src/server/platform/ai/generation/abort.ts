export function combineAbortSignals(
  signals: Array<AbortSignal | undefined>,
): AbortSignal {
  const active = signals.filter(
    (signal): signal is AbortSignal => signal !== undefined,
  );
  if (active.length === 0) return new AbortController().signal;
  if (active.length === 1) return active[0]!;
  if ("any" in AbortSignal) return AbortSignal.any(active);

  const controller = new AbortController();
  const abort = (event: Event) => {
    const signal = event.target as AbortSignal;
    controller.abort(signal.reason);
  };
  for (const signal of active) {
    if (signal.aborted) {
      controller.abort(signal.reason);
      break;
    }
    signal.addEventListener("abort", abort, { once: true });
  }
  return controller.signal;
}

export function throwIfGenerationCancelled(signal?: AbortSignal): void {
  if (!signal?.aborted) return;
  const error = new Error("Generation was cancelled");
  error.name = "JobCancellationError";
  throw error;
}
