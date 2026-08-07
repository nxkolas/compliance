"use client";

import { useCallback, useEffect, useState } from "react";
import { CheckCircle2, Loader2, XCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { probeLocalModel, type LocalModelProbe } from "@/src/client/local-model";
import { modelSettingsClient } from "@/src/client/model-settings";
import {
  forgetLocalModelBaseUrl,
  rememberedLocalModelBaseUrl,
  rememberLocalModelBaseUrl,
  startHostWorker,
  stopHostWorker,
  useHostWorkerRunning,
  useHostWorkerStatus,
} from "@/src/client/client-inference-host";

/**
 * Connects this browser to a model on the user's own machine. The relay
 * worker itself lives in the app shell (see `ClientInferenceRelayHost`), so
 * it keeps serving the organization while this tab stays open, even after
 * navigating away from these settings.
 *
 * Two things happen here that cannot happen anywhere else. The probe is the
 * only way to learn what a chosen model actually does -- a model that ignores a
 * JSON schema answers HTTP 200 with invented keys, so the capability has to be
 * observed rather than declared. And the worker loop is the transport: a
 * deployed function cannot reach `127.0.0.1`, so generation and embedding for
 * this organization only progress while a tab like this one is running.
 */
export function LocalModelPanel(props: {
  organizationId: string;
  initial?: {
    generationModelId: string;
    embeddingModelId: string;
    baseUrl?: string;
  } | null;
}) {
  const [baseUrl, setBaseUrl] = useState(
    props.initial?.baseUrl ?? rememberedLocalModelBaseUrl(props.organizationId),
  );
  const [generationModel, setGenerationModel] = useState(
    props.initial?.generationModelId ?? "",
  );
  const [embeddingModel, setEmbeddingModel] = useState(
    props.initial?.embeddingModelId ?? "",
  );
  const [instructionProfile, setInstructionProfile] = useState<
    "none" | "qwen3-query-v1" | "e5-query-v1"
  >("none");
  const [probe, setProbe] = useState<LocalModelProbe | null>(null);
  const [probing, setProbing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [rebuilding, setRebuilding] = useState(false);
  const connected = useHostWorkerRunning(props.organizationId);
  const status = useHostWorkerStatus(props.organizationId);

  const target = { baseUrl };
  const hasInitialSettings = props.initial !== undefined && props.initial !== null;

  // Load what this organization has already configured. The parent renders this
  // panel without `initial` (the saved settings live on the server), so without
    // this fetch every reopen would show the defaults even though the model ids
    // were saved. The base URL is not persisted server-side; it is remembered
    // in this browser after the first connect.
  useEffect(() => {
    if (hasInitialSettings) return;
    let cancelled = false;
    void modelSettingsClient
      .get(props.organizationId)
      .then((result) => {
        if (cancelled) return;
        const settings = result.data.settings;
        if (!settings) return;
        setGenerationModel(settings.generationModelId);
        setEmbeddingModel(settings.embeddingModelId);
        setInstructionProfile(
          settings.embeddingInstructionProfile as typeof instructionProfile,
        );
      })
      .catch(() => {
        // Settings are optional; leave the defaults instead of failing the
        // dialog.
      });
    return () => {
      cancelled = true;
    };
  }, [props.organizationId, hasInitialSettings]);

  const runProbe = useCallback(async () => {
    setProbing(true);
    setError(null);
    try {
      const result = await probeLocalModel({
        target,
        generationModel,
        embeddingModel,
      });
      setProbe(result);
    } finally {
      setProbing(false);
    }
  }, [baseUrl, generationModel, embeddingModel]);

  const usable =
    probe?.reachable === true &&
    probe.supportsStructuredOutputs &&
    probe.embeddingDimensions !== null;

  async function save() {
    if (!probe || !usable) return;
    setSaving(true);
    setError(null);
    try {
      const result = await modelSettingsClient.save(props.organizationId, {
        generation: {
          modelId: generationModel,
          maxContextTokens: probe.loadedContextTokens ?? 32_000,
          supportsStructuredOutputs: true,
          thinkingStyle: "ollama",
        },
        embedding: {
          modelId: embeddingModel,
          dimensions: probe.embeddingDimensions!,
          instructionProfile,
        },
      });
      setRebuilding(!result.data.embeddingChange.applied);
      rememberLocalModelBaseUrl(props.organizationId, baseUrl);
      startHostWorker(props.organizationId, baseUrl);
    } catch {
      setError("Could not save the model configuration.");
    } finally {
      setSaving(false);
    }
  }

  function stopWorker() {
    forgetLocalModelBaseUrl(props.organizationId);
    stopHostWorker(props.organizationId);
  }

  return (
    <Card>
      <CardContent className="space-y-4 pt-6">
        <div className="space-y-2">
          <Label htmlFor="local-model-url">Local model URL</Label>
          <Input
            id="local-model-url"
            value={baseUrl}
            onChange={(event) => setBaseUrl(event.target.value)}
            placeholder="http://127.0.0.1:11434/v1"
          />
          <p className="text-muted-foreground text-sm">
            Your model server must allow requests from this site. For Ollama,
            set <code>OLLAMA_ORIGINS</code> to include {origin()}.
          </p>
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-2">
            <Label htmlFor="generation-model">Generation model</Label>
            <Input
              id="generation-model"
              value={generationModel}
              onChange={(event) => setGenerationModel(event.target.value)}
              placeholder="gemma3:27b"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="embedding-model">Embedding model</Label>
            <Input
              id="embedding-model"
              value={embeddingModel}
              onChange={(event) => setEmbeddingModel(event.target.value)}
              placeholder="embeddinggemma"
            />
          </div>
        </div>

        <div className="space-y-2">
          <Label htmlFor="instruction-profile">Query instruction</Label>
          <Select
            value={instructionProfile}
            onValueChange={(value) =>
              setInstructionProfile(value as typeof instructionProfile)
            }
          >
            <SelectTrigger id="instruction-profile">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="none">None</SelectItem>
              <SelectItem value="qwen3-query-v1">Qwen3-Embedding</SelectItem>
              <SelectItem value="e5-query-v1">E5 family</SelectItem>
            </SelectContent>
          </Select>
          <p className="text-muted-foreground text-sm">
            Some embedding models expect an instruction prefix on queries.
            Changing this rebuilds your document index.
          </p>
        </div>

        <div className="flex gap-2">
          <Button
            type="button"
            variant="outline"
            onClick={runProbe}
            disabled={probing || !generationModel || !embeddingModel}
          >
            {probing ? <Loader2 className="animate-spin" /> : null}
            Test connection
          </Button>
          <Button type="button" onClick={save} disabled={!usable || saving}>
            {saving ? <Loader2 className="animate-spin" /> : null}
            Save and connect
          </Button>
          {connected ? (
            <Button type="button" variant="ghost" onClick={stopWorker}>
              Disconnect
            </Button>
          ) : null}
        </div>

        {probe ? <ProbeReport probe={probe} /> : null}
        {error ? <p className="text-destructive text-sm">{error}</p> : null}

        {connected ? (
          <div className="space-y-2 text-sm">
            <p className="text-muted-foreground">
              {status.state === "working"
                ? `Running a ${status.kind} request…`
                : status.state === "error"
                  ? `Last attempt failed: ${status.message}`
                  : "Connected and waiting for work."}{" "}
              Keep this tab open — analysis for your organization only runs while
              it is.
            </p>
            {rebuilding ? (
              <p>
                Your embedding model changed, so every document is being
                re-indexed through this browser. Existing search results keep
                working until it finishes; leaving the page pauses it.
              </p>
            ) : null}
          </div>
        ) : null}
      </CardContent>
    </Card>
  );
}

function ProbeReport({ probe }: { probe: LocalModelProbe }) {
  // The two connection failures need opposite fixes, so they are never reported
  // as one "could not connect". A blocked origin means the server is running
  // and refusing this page; an unreachable port means nothing is there.
  if (probe.reachability === "cors_blocked") {
    return (
      <div className="text-destructive space-y-2 text-sm">
        <p>
          Your model server is running but is not allowing requests from{" "}
          {origin()}. Add it to the server&apos;s allowed origins, then restart
          the server from a new terminal — it only reads the setting at startup.
        </p>
        <pre className="text-foreground bg-muted overflow-x-auto rounded p-2 text-xs">
          {`# Ollama, installed normally\nsetx OLLAMA_ORIGINS "${origin()}"\n\n# Ollama in Docker\ndocker run -d -e OLLAMA_ORIGINS="${origin()}" \\\n  -p 127.0.0.1:11434:11434 ollama/ollama`}
        </pre>
      </div>
    );
  }

  if (probe.reachability === "unreachable") {
    return (
      <p className="text-destructive text-sm">
        Nothing is listening at that address. Check the model server is running
        and that the URL and port are right.
      </p>
    );
  }

  if (!probe.reachable) {
    return (
      <p className="text-destructive text-sm">
        The server answered, but a model call failed. {probe.failure}
      </p>
    );
  }
  return (
    <ul className="space-y-1 text-sm">
      <ProbeLine ok label="Server reachable" />
      <ProbeLine
        ok={probe.supportsStructuredOutputs}
        label={
          probe.supportsStructuredOutputs
            ? "Honours JSON schemas"
            : "Ignores JSON schemas — this model cannot be used for analysis"
        }
      />
      <ProbeLine
        ok={probe.embeddingDimensions !== null}
        label={
          probe.embeddingDimensions !== null
            ? `Embeddings are ${probe.embeddingDimensions} dimensions`
            : "The embedding model did not respond"
        }
      />
      <ProbeLine
        ok
        label={
          probe.loadedContextTokens
            ? `Loaded context window: ${probe.loadedContextTokens} tokens`
            : "Context window unknown; assuming a conservative default"
        }
      />
    </ul>
  );
}

function ProbeLine({ ok, label }: { ok: boolean; label: string }) {
  return (
    <li className="flex items-center gap-2">
      {ok ? (
        <CheckCircle2 className="size-4 text-emerald-600" />
      ) : (
        <XCircle className="text-destructive size-4" />
      )}
      <span>{label}</span>
    </li>
  );
}

function origin() {
  return typeof window === "undefined" ? "this site" : window.location.origin;
}
