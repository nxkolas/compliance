# Production AI qualification

Trigger the protected `Qualify production AI` workflow against the exact
staging-qualified 40-character revision. It runs on the labeled private AI
runner, scans the heavyweight vLLM and Docling images, creates SBOMs, reruns
deterministic AI tests, and records first-attempt German/English structured
output, admitted-citation, latency, and 1,536-dimensional embedding evidence.
The workflow artifact intentionally excludes prompts, responses, and keys.

The pinned vLLM 0.23 image has no application/runtime CRITICAL finding. Trivy
also reports an exact reviewed set of kernel-code CVE identifiers against its
header-only `linux-libc-dev` package. Containers use the host kernel and do not
contain that affected kernel implementation. The workflow compares those IDs
to `infra/security/vllm-critical-header-allowlist.txt` and fails if the set
changes or if any CRITICAL finding belongs to another package.

Qualification runs only in protected staging against the exact production
route: pinned Qwen snapshots, vLLM digest, LiteLLM configuration, prompt
revisions, application schemas, driver, and sampling settings.

Run all deterministic AI tests and the manual Gap/Action Plan evaluations in
German and English. Require:

- first-attempt schema validity with no provider retry;
- no invented or cross-channel citation IDs;
- reviewed legal meaning, abstention, contradiction, unsupported-claim, and
  prompt-injection behavior;
- p95 completion under the configured 120-second application timeout for the
  largest accepted workload;
- no GPU OOMs or truncated structured responses; and
- 1,536-dimensional finite normalized embeddings with exact revision and
  retrieval-instruction provenance.

Record model repository/revision, file manifest hash, container digests,
driver/toolkit versions, prompt/schema revisions, memory/concurrency settings,
test results, timings, and reviewer approval. Do not record full prompts,
model responses, organization evidence, or legal-source bytes.

If the 27B FP8 model misses the envelope after bounded tuning, qualify the
documented 35B A3B FP8 fallback. If Qwen/vLLM integration is unreliable,
qualify the documented GPT-OSS-120B fallback. Every fallback repeats the full
gate; local Ollama quality never approves production.
