import { useSyncExternalStore } from "react";
import {
  runClientInferenceWorker,
  type WorkerStatus,
} from "./client-inference-worker";
import type { LocalModelTarget } from "./local-model";

/**
 * Owns the browser-side relay workers for this tab.
 *
 * The workers must survive navigation: a relay hosted inside the settings
 * dialog dies the moment the user leaves that page, which silently stops the
 * analysis. This store is driven by the app-shell host component, so workers
 * keep running across route changes, and the remembered base URLs are read
 * back from localStorage on a full reload.
 */

export const DEFAULT_LOCAL_MODEL_BASE_URL = "http://127.0.0.1:11434/v1";
const STORAGE_PREFIX = "compliancetool.localModelBaseUrl.";

type HostEntry = {
  organizationId: string;
  target: LocalModelTarget;
  abort: AbortController;
  status: WorkerStatus;
};

const entries = new Map<string, HostEntry>();
const listeners = new Set<() => void>();
const IDLE_STATUS: WorkerStatus = { state: "idle" };

export function localModelBaseUrlKey(organizationId: string) {
  return `${STORAGE_PREFIX}${organizationId}`;
}

export function rememberedLocalModelBaseUrl(organizationId: string) {
  if (typeof window === "undefined") return DEFAULT_LOCAL_MODEL_BASE_URL;
  return (
    window.localStorage.getItem(localModelBaseUrlKey(organizationId)) ??
    DEFAULT_LOCAL_MODEL_BASE_URL
  );
}

export function rememberLocalModelBaseUrl(
  organizationId: string,
  baseUrl: string,
) {
  window.localStorage.setItem(
    localModelBaseUrlKey(organizationId),
    baseUrl.replace(/\/$/, ""),
  );
}

export function forgetLocalModelBaseUrl(organizationId: string) {
  window.localStorage.removeItem(localModelBaseUrlKey(organizationId));
}

export function connectedOrganizationIds() {
  const ids: string[] = [];
  for (let index = 0; index < window.localStorage.length; index += 1) {
    const key = window.localStorage.key(index);
    if (key?.startsWith(STORAGE_PREFIX)) {
      ids.push(key.slice(STORAGE_PREFIX.length));
    }
  }
  return ids;
}

function emit() {
  for (const listener of listeners) listener();
}

/** Starts (or restarts) the relay worker for one organization. */
export function startHostWorker(organizationId: string, baseUrl: string) {
  const normalized = baseUrl.replace(/\/$/, "");
  const existing = entries.get(organizationId);
  if (existing?.target.baseUrl === normalized) return;
  if (existing) existing.abort.abort();

  const controller = new AbortController();
  const target = { baseUrl: normalized };
  const entry: HostEntry = {
    organizationId,
    target,
    abort: controller,
    status: IDLE_STATUS,
  };
  entries.set(organizationId, entry);
  void runClientInferenceWorker({
    organizationId,
    target,
    signal: controller.signal,
    onStatus: (status) => {
      entry.status = status;
      emit();
    },
    onOrganizationUnavailable: () => {
      // Development reseeding and membership removal can leave an old
      // connection in localStorage. It cannot become usable by retrying, and
      // keeping it would restart the polling loop after every page reload.
      forgetLocalModelBaseUrl(organizationId);
      if (entries.get(organizationId) === entry) {
        entries.delete(organizationId);
        emit();
      }
    },
  }).catch(() => undefined);
  emit();
}

export function stopHostWorker(organizationId: string) {
  const entry = entries.get(organizationId);
  if (!entry) return;
  entry.abort.abort();
  entries.delete(organizationId);
  emit();
}

export function stopAllHostWorkers() {
  for (const organizationId of [...entries.keys()]) {
    stopHostWorker(organizationId);
  }
}

export function isHostWorkerRunning(organizationId: string) {
  return entries.has(organizationId);
}

export function getHostWorkerStatus(organizationId: string): WorkerStatus {
  return entries.get(organizationId)?.status ?? IDLE_STATUS;
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

export function useHostWorkerStatus(organizationId: string): WorkerStatus {
  return useSyncExternalStore(
    subscribe,
    () => getHostWorkerStatus(organizationId),
    () => IDLE_STATUS,
  );
}

export function useHostWorkerRunning(organizationId: string): boolean {
  return useSyncExternalStore(
    subscribe,
    () => isHostWorkerRunning(organizationId),
    () => false,
  );
}
