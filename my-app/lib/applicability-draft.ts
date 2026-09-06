const eventName = "applicability-draft-change";
const storageKey = (key: string) => `complyx:applicability-draft:${key}`;

export function readApplicabilityDraft(key: string): string | null {
  try { return window.sessionStorage.getItem(storageKey(key)); } catch { return null; }
}

export function writeApplicabilityDraft(key: string, value: string | null) {
  try {
    if (value === null) window.sessionStorage.removeItem(storageKey(key));
    else window.sessionStorage.setItem(storageKey(key), value);
    window.dispatchEvent(new Event(eventName));
  } catch { /* The questionnaire also works when browser storage is disabled. */ }
}

export function subscribeApplicabilityDraft(callback: () => void) {
  window.addEventListener(eventName, callback);
  return () => window.removeEventListener(eventName, callback);
}
