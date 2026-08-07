"use client";

import { useEffect, useRef } from "react";
import {
  connectedOrganizationIds,
  rememberedLocalModelBaseUrl,
  startHostWorker,
  stopAllHostWorkers,
  stopHostWorker,
} from "@/src/client/client-inference-host";

/**
 * Keeps the browser relaying local model work for every organization this
 * browser was connected to, while the app is open.
 *
 * The worker must not live inside the settings dialog: starting an analysis
 * navigates away and unmounts it, which silently stops the relay. Mounted in
 * the authenticated app shell, this host survives route changes and re-reads
 * the remembered connections after a full reload, so refreshing the page
 * after clicking start re-establishes the relay.
 */
export function ClientInferenceRelayHost({
  children,
}: {
  children: React.ReactNode;
}) {
  const started = useRef(new Map<string, string>());

  useEffect(() => {
    const startedMap = started.current;

    function sync() {
      const next = new Map<string, string>();
      for (const organizationId of connectedOrganizationIds()) {
        next.set(organizationId, rememberedLocalModelBaseUrl(organizationId));
      }
      for (const [organizationId, baseUrl] of next) {
        if (startedMap.get(organizationId) !== baseUrl) {
          startHostWorker(organizationId, baseUrl);
          startedMap.set(organizationId, baseUrl);
        }
      }
      for (const [organizationId] of startedMap) {
        if (!next.has(organizationId)) {
          stopHostWorker(organizationId);
          startedMap.delete(organizationId);
        }
      }
    }

    sync();
    window.addEventListener("storage", sync);
    return () => {
      window.removeEventListener("storage", sync);
      // A reload re-establishes everything from localStorage on the next
      // mount; leaving the authenticated app unmounts the relay.
      stopAllHostWorkers();
      startedMap.clear();
    };
  }, []);

  return <>{children}</>;
}
