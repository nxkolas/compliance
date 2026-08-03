# Coordinated Docker upgrade

Use a monthly maintenance window, or an abbreviated protected staging gate for
a critical security fix.

1. Open a review that changes exact tags and digests in `infra/versions.env`.
2. Update the coordinated Supabase bundle from one upstream commit as a unit;
   do not mix independently selected database/Auth/REST/Storage versions.
3. Review migrations, configuration changes, deprecations, CVEs, licenses, and
   rollback compatibility.
4. Build the web, worker, and hardened platform targets from one revision. Run
   tests, every Compose configuration, template validation, SBOM generation,
   vulnerability scans, and signing.
5. Recreate two empty disposable test databases from the vector bootstrap,
   current Drizzle schema, append-only audit bootstrap, and storage bootstrap;
   compare deployment history/schema evidence.
6. Deploy staging by digest, run isolated acceptance and backup/restore, and
   observe metrics.
7. Promote the same digests to production after protected approval.

Model changes additionally require exact Hub revision hashes, artifact
SHA-256 manifests, malware scanning, offline loading, full German/English AI
qualification, and re-embedding if model revision, quantization, dimensions,
or retrieval instruction changes.

Never deploy a mutable tag without a digest, production source build, automatic
database downgrade, or an untested coordinated-service combination. When no
patched stable upstream artifact exists, record the exact pre-release digest,
reported version, scan result, and staging qualification before promotion.
