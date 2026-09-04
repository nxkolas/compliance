export function throwIfJobExecutionAborted(signal?: AbortSignal) {
  if (!signal?.aborted) return;
  const error = new Error("Portable job execution was interrupted");
  error.name = "AbortError";
  throw error;
}
