# Docker deployment acceptance evidence

- Git revision: `0295b2b9e6e9e69bf2d6a8bb32471d6af790db88`
- Compose project: `compliancetool-test`
- Started (UTC): `2026-07-27T18:37:23.1667044Z`
- Updated (UTC): `2026-07-27T18:47:03.1706846Z`
- Duration: 9.7 minutes
- Optional profiles: admin=False, docling=True, observability=False
- Constrained-memory mode: True

## Gate results

| Gate | Status | Duration/detail |
| --- | --- | --- |
| preflight | passed | Linux containers; 15.6 GB Docker memory; constrained=True; disk gate passed |
| npm ci | passed | 36.2s |
| npm run verify | passed | 24.2s |
| npm run test:worker | passed | 1.4s |
| npm run test:routes | passed | 1.4s |
| npm run test:ai | passed | 1.2s |
| npm run build | passed | 27.8s |
| web image build 1 | passed | 31.7s |
| worker image build 1 | passed | 1.7s |
| web image build 2 | passed | 1.6s |
| worker image build 2 | passed | 1.1s |
| hardened Storage image build | passed | 1.8s |
| WAL-G-enabled database image build | passed | 2.1s |
| hardened Studio image build | passed | 1.8s |
| hardened postgres-meta image build | passed | 1.9s |
| web image reproducibility | passed | sha256:b1fac4f2ec6e5dc9414a741470460084de900def8f7af778b26b3d5bd9035df2 |
| worker image reproducibility | passed | sha256:09c982cbb92614ef4e0d21eaa1d7e55e15d194a83b5fdef469264111fc318b72 |
| critical scan (compliancetool-web:acceptance-1) | passed | 13.9s |
| SBOM generation (compliancetool-web:acceptance-1) | passed | 3.9s |
| critical scan (compliancetool-worker:acceptance-1) | passed | 25.1s |
| SBOM generation (compliancetool-worker:acceptance-1) | passed | 11.1s |
| critical scan (compliancetool/database:local) | passed | 24s |
| SBOM generation (compliancetool/database:local) | passed | 14.7s |
| critical scan (compliancetool/studio:local) | passed | 20.2s |
| SBOM generation (compliancetool/studio:local) | passed | 10s |
| critical scan (compliancetool/postgres-meta:local) | passed | 15.3s |
| SBOM generation (compliancetool/postgres-meta:local) | passed | 3.8s |
| critical scan (compliancetool/storage:local) | passed | 17.3s |
| SBOM generation (compliancetool/storage:local) | passed | 8s |
| Compose config () | passed | 0.1s |
| Compose config (infra/compose/local/compose.infra.yml) | passed | 0.1s |
| Compose config (infra/compose/local/compose.studio.yml) | passed | 0.1s |
| Compose config (infra/compose/local/compose.docling.yml) | passed | 0.1s |
| Compose config (infra/compose/local/compose.observability.yml) | passed | 0.1s |
| Compose config (infra/compose/local/compose.constrained-memory.yml) | passed | 0.1s |
| Compose config (infra/compose/local/compose.docling.yml, infra/compose/local/compose.constrained-memory.yml) | passed | 0.1s |
| Compose config (infra/compose/local/compose.studio.yml, infra/compose/local/compose.docling.yml, infra/compose/local/compose.observability.yml) | passed | 0.1s |
| local Compose Caddy security policy | passed | 0.2s |
| isolated stack bootstrap | passed | 274s |
| web liveness | passed | 0s |
| web readiness | passed | 0s |
| Supabase Auth through Caddy | failed | 0s |
| acceptance | failed | Der Remoteserver hat einen Fehler zurückgegeben: (401) Nicht autorisiert. |

This report intentionally omits secrets, cookies, signed URLs, prompts, document contents, and personal data.
