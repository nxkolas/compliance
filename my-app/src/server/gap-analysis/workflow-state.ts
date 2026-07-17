export function selectGapWorkflowRevisions<T extends { id: string }>(input: {
  current: T | null;
  accepted: T | null;
}) {
  return {
    accepted: input.accepted,
    candidate:
      input.current && input.current.id !== input.accepted?.id
        ? input.current
        : null,
  };
}
