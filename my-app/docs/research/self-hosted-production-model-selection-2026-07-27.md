# Self-hosted production model selection

Date: 2026-07-27

## Decision

Use **`Qwen/Qwen3.5-27B-FP8`** as the production chat and structured-generation model.

- Hugging Face revision: `97f5941bf617e31c5e237364a8602ce3f03a551a`
- License: Apache-2.0
- Precision: Qwen's first-party block-128 FP8 checkpoint
- Runtime: vLLM `0.23.0`, pinned by container digest
- Initial served name: `compliance-chat`
- Initial production context limit: 131,072 tokens
- Hardware target: one NVIDIA H100 80 GB

Provisioning must download that exact revision, create and retain a SHA-256
manifest for every artifact, and copy the verified snapshot into the offline
model store. Production must not resolve `main` or contact Hugging Face.

This is a firm initial selection, not a claim that the model is safe to release
without application-specific qualification. Failure of the acceptance gate
below blocks production and triggers the documented fallback; it does not allow
an unreviewed model substitution.

## Why this model fits this application

The application's difficult path is not free-form chat. The grounded provider
calls `generateObject` with `maxRetries: 0`, strict runtime-generated Zod
schemas, up to 9,000 output tokens, and a 120-second default timeout
([provider implementation](../../src/server/ai/grounding/providers/ai-sdk.ts)).
The Gap Analysis and Action Plan schemas contain nested required objects,
bounded arrays, enums made from the exact admitted citation IDs, and semantic
post-validation
([Gap schema](../../src/server/gap-analysis/generation-schema-v7.ts),
[Action Plan schema](../../src/server/action-plans/generation-schema.ts)).
Interactive answers must also preserve prompt-local source IDs and abstain when
context is missing
([response validator](../../lib/ai/prompts/response-validator.ts)).

Qwen3.5-27B is a dense 27B model with a native 262,144-token context window and
global coverage across 201 languages and dialects. Qwen publishes a first-party
FP8 checkpoint whose metrics it reports as nearly identical to the unquantized
model. The snapshot is 30.9 GB, leaving substantial space on an 80 GB GPU for
runtime allocations, a useful KV cache, and low-concurrency serving
([Qwen model card](https://huggingface.co/Qwen/Qwen3.5-27B-FP8),
[snapshot files](https://huggingface.co/Qwen/Qwen3.5-27B-FP8/tree/97f5941bf617e31c5e237364a8602ce3f03a551a)).

For the requirements that matter here, Qwen's common evaluation table reports
Qwen3.5-27B ahead of GPT-OSS-120B:

| Evaluation | Qwen3.5-27B | GPT-OSS-120B | Relevance |
| --- | ---: | ---: | --- |
| IFEval | 95.0 | 88.9 | instruction adherence |
| IFBench | 76.5 | 69.0 | difficult instruction adherence |
| MultiChallenge | 60.8 | 45.3 | multi-turn instruction retention |
| LongBench v2 | 60.6 | 48.2 | long retrieved context |
| MMLU-Pro | 86.1 | 80.8 | general reasoning/knowledge |
| MMMLU | 85.9 | 78.2 | multilingual knowledge |
| MMLU-ProX | 82.2 | 74.5 | multilingual reasoning |

These are vendor-published general evaluations, not German legal or citation
evaluations. They justify which model enters qualification; they do not replace
the repository's acceptance gate.

The dense 27B checkpoint is preferred over the faster 35B-A3B MoE checkpoint
because the deployment is explicitly quality-first and low-concurrency.
Qwen's same table reports the dense model ahead on IFEval (95.0 vs 91.9),
IFBench (76.5 vs 70.2), LongBench v2 (60.6 vs 59.0), MMMLU (85.9 vs 85.2),
MMLU-ProX (82.2 vs 81.0), and GPQA Diamond (85.5 vs 84.2). The 35B-A3B model
remains the throughput fallback, not the production default
([Qwen3.5-35B-A3B-FP8 model card](https://huggingface.co/Qwen/Qwen3.5-35B-A3B-FP8)).

## Candidate disposition

| Candidate | Single 80 GB assessment | Decision |
| --- | --- | --- |
| **Qwen3.5-27B-FP8** | First-party 30.9 GB FP8 snapshot; ample serving headroom; native 262K context | **Selected** |
| Qwen3.5-35B-A3B-FP8 | First-party 37.5 GB FP8 snapshot; much faster 3B-active MoE, but slightly weaker on the most relevant published evaluations | Throughput fallback |
| GPT-OSS-120B | Explicitly validated by OpenAI for one 80 GB GPU; native MXFP4 and 128K context; about 65 GB of weights | Hardware-validation fallback; not selected because OpenAI says training was mostly English, it leaves much less memory headroom, and relevant Qwen-published results are lower |
| Qwen3.5-122B-A10B | BF16/FP8 do not fit; Qwen's first-party GPTQ-Int4 recipe uses tensor parallelism across four GPUs; NVIDIA's NVFP4 checkpoint targets Blackwell | Not a clean H100 80 GB deployment |
| Mistral Small 4 119B A6B NVFP4 | Apache-2.0, German, JSON/tool support, and 256K context are attractive, but the snapshot is 70.8 GB and Mistral's official vLLM recipe uses tensor parallelism across two GPUs | Rejected for the agreed single-GPU host |
| Llama 4 Scout 109B | Meta says it can fit one H100 with on-the-fly INT4 and supports German, but it adds runtime quantization complexity and uses the custom Llama license | Rejected against the Apache-2.0 alternatives |

Primary sources:

- [OpenAI GPT-OSS announcement and architecture](https://openai.com/index/introducing-gpt-oss/)
- [OpenAI GPT-OSS model card](https://huggingface.co/openai/gpt-oss-120b)
- [Qwen3.5-122B-A10B GPTQ-Int4 model card and vLLM recipe](https://huggingface.co/Qwen/Qwen3.5-122B-A10B-GPTQ-Int4)
- [NVIDIA Qwen3.5-122B-A10B NVFP4 hardware and vLLM configuration](https://huggingface.co/nvidia/Qwen3.5-122B-A10B-NVFP4)
- [Mistral Small 4 NVFP4 model card and deployment recipe](https://huggingface.co/mistralai/Mistral-Small-4-119B-2603-NVFP4)
- [Meta Llama 4 Scout model card](https://huggingface.co/meta-llama/Llama-4-Scout-17B-16E-Instruct)

## Initial vLLM configuration

Start with a conservative single-GPU, text-only profile:

```bash
vllm serve /models/Qwen3.5-27B-FP8 \
  --served-model-name compliance-chat \
  --tensor-parallel-size 1 \
  --language-model-only \
  --max-model-len 131072 \
  --gpu-memory-utilization 0.90 \
  --max-num-seqs 2 \
  --enable-chunked-prefill \
  --reasoning-parser qwen3 \
  --enable-auto-tool-choice \
  --tool-call-parser qwen3_coder
```

The mounted model directory must be the verified pinned snapshot. Do not pass a
mutable Hub model name in production. Pin `vllm/vllm-openai:v0.23.0` by image
digest after the exact image/GPU/driver combination passes staging. vLLM
supports OpenAI-compatible JSON Schema structured output, including separation
of reasoning from the schema-constrained final response
([vLLM structured outputs](https://docs.vllm.ai/en/v0.23.0/features/structured_outputs/)).
The Qwen model card documents vLLM's `qwen3` reasoning parser,
`qwen3_coder` tool parser, and `--language-model-only` mode.

Do not begin at the model's full 262K context. The application currently admits
at most ten retrieved chunks when the capability profile is at least 64K
([prompt builder](../../lib/ai/prompts/prompt-builder.ts)), so 128K preserves
substantial headroom without spending memory on an unused maximum. Raise it
only after a workload trace demonstrates a need.

The initial `max-num-seqs` is two: one generation plus one queued/interactive
request. The LiteLLM gateway and worker queue must enforce the agreed
low-concurrency policy; vLLM memory admission is not the business queue.

## Required application configuration work

The current self-hosted defaults claim no structured-output or tool support,
only 16K context, low citation reliability, and temperature 0.1
([model capabilities](../../lib/ai/model-capabilities.ts)). After qualification,
configure:

```env
SELF_HOSTED_AI_MODEL=compliance-chat
SELF_HOSTED_AI_MAX_CONTEXT_TOKENS=131072
SELF_HOSTED_AI_SUPPORTS_STRUCTURED_OUTPUTS=true
SELF_HOSTED_AI_SUPPORTS_TOOL_CALLS=true
SELF_HOSTED_AI_SUPPORTS_STREAMING=true
SELF_HOSTED_AI_CITATION_RELIABILITY=medium
```

Keep citation reliability at `medium`: JSON-constrained citation IDs prevent
invalid identifiers, but no model card demonstrates legal-source entailment.
The application's deterministic citation and grounding validators remain
mandatory.

Qwen3.5 thinks by default and its recommended sampling values differ from the
application's current low-temperature cap. Add a model-specific adapter rather
than globally pretending OpenAI, Qwen, and local Ollama share sampling
semantics:

- Interactive streaming: begin in non-thinking mode for predictable latency,
  using vLLM's default chat-template kwargs
  `{"enable_thinking": false}`.
- Grounded Gap/Action Plan jobs: test both modes. If thinking materially
  improves the acceptance suite, enable it per request, keep the reasoning
  field out of stored/user-visible output, and increase the token/timeout budget
  explicitly.
- Keep JSON Schema constrained decoding enabled for every `generateObject`
  request. Prompt-only JSON is insufficient.
- Do not enable speculative decoding or a custom quantization on the first
  production baseline. Add one optimization at a time after result-equivalence
  testing.

Qwen documents both thinking/non-thinking modes and its recommended sampling
parameters in the [official model card](https://huggingface.co/Qwen/Qwen3.5-27B-FP8);
vLLM supports server defaults through
[`--default-chat-template-kwargs`](https://docs.vllm.ai/en/stable/features/reasoning_outputs/).

## Production acceptance gate

Run the exact pinned container, model snapshot, LiteLLM route, prompt versions,
and schemas that will ship. Qualification must include the repository's
existing AI/evaluation suite and live provider runs for both `de` and `en`.

Release is blocked unless:

1. Every Gap Analysis and Action Plan fixture returns schema-valid output on
   the first call (`maxRetries: 0` remains true).
2. Every returned citation ID is in the request's admitted enum; invented,
   missing, or cross-channel citations are zero.
3. All semantic validators pass, including atomic gap wording, uncertainty,
   action coverage, contradiction/review behavior, and refusal when support is
   insufficient.
4. A German/English domain review finds no invented obligation, deadline,
   implementation fact, or mistranslation that changes legal meaning.
5. Repeated runs are stable enough that the same evidence does not produce
   materially conflicting compliance status.
6. p95 end-to-end provider latency remains below the application's 120-second
   timeout with the largest accepted prompt and output; OOMs and truncated JSON
   are zero.
7. Adversarial source text cannot override the system prompt or make the model
   emit non-admitted citations.

At minimum, run:

```text
npm run test:ai
npm run eval:gap-action-plan-manual
npm run eval:gap-evidence-calibration
```

The deterministic unit tests are necessary but not sufficient: the manual
evaluation explicitly requires inspection of provider-produced prose. Preserve
the model revision, vLLM image digest, driver version, sampling parameters,
prompt hashes, and results as the release evidence.

If Qwen3.5-27B-FP8 fails schema correctness or latency after tuning within the
agreed 80 GB/120-second envelope, test `Qwen/Qwen3.5-35B-A3B-FP8` at revision
`9d1823d2dee688a6b25e77009dc727688c44936e`. If the Qwen/vLLM integration itself
is unreliable, use `openai/gpt-oss-120b` at revision
`b5c939de8f754692c1647ca79fbf85e8c1e70f8a` as the explicit single-H100
hardware fallback and rerun the complete acceptance gate.

## Caveats

- No primary source evaluates German NIS2/BSIG legal accuracy, grounded
  citation entailment, or this repository's nested schemas. Those are local
  release responsibilities.
- Qwen's comparative table is first-party and should be treated as directional.
- A 262K advertised context window does not prove perfect evidence retention.
  Retrieval quality, chunk ordering, and lost-in-the-middle behavior still need
  application evaluation.
- FP8 reduces memory and Qwen reports near-identical general metrics, but
  compliance behavior must be compared against the BF16 model only if a
  material failure appears.
- The model is advisory. Existing server-owned policy, provenance, validation,
  audit logging, and human review boundaries must not be delegated to it.
