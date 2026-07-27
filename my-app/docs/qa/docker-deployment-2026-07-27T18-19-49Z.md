# Docker deployment acceptance evidence

- Git revision: `0295b2b9e6e9e69bf2d6a8bb32471d6af790db88`
- Compose project: `compliancetool-test`
- Started (UTC): `2026-07-27T18:19:49.8095808Z`
- Updated (UTC): `2026-07-27T18:33:00.0813393Z`
- Duration: 13.2 minutes
- Optional profiles: admin=False, docling=True, observability=False
- Constrained-memory mode: True

## Gate results

| Gate | Status | Duration/detail |
| --- | --- | --- |
| preflight | passed | Linux containers; 15.6 GB Docker memory; constrained=True; disk gate passed |
| npm ci | passed | 37s |
| npm run verify | passed | 25.1s |
| npm run test:worker | passed | 1.4s |
| npm run test:routes | passed | 1.4s |
| npm run test:ai | passed | 1.2s |
| npm run build | passed | 27.2s |
| web image build 1 | passed | 33.6s |
| worker image build 1 | passed | 1.5s |
| web image build 2 | passed | 1.6s |
| worker image build 2 | passed | 1.2s |
| hardened Storage image build | passed | 2.9s |
| WAL-G-enabled database image build | passed | 2.1s |
| hardened Studio image build | passed | 2.9s |
| hardened postgres-meta image build | passed | 6.2s |
| web image reproducibility | passed | sha256:c56157a6696f28d2a5bf7ba7871c91e4dbc8ad7944633c89f8e27a0f501e7722 |
| worker image reproducibility | passed | sha256:09c982cbb92614ef4e0d21eaa1d7e55e15d194a83b5fdef469264111fc318b72 |
| critical scan (compliancetool-web:acceptance-1) | passed | 15.5s |
| SBOM generation (compliancetool-web:acceptance-1) | passed | 4s |
| critical scan (compliancetool-worker:acceptance-1) | passed | 22s |
| SBOM generation (compliancetool-worker:acceptance-1) | passed | 11s |
| critical scan (compliancetool/database:local) | passed | 24.2s |
| SBOM generation (compliancetool/database:local) | passed | 14.7s |
| critical scan (compliancetool/studio:local) | passed | 20.4s |
| SBOM generation (compliancetool/studio:local) | passed | 9.9s |
| critical scan (compliancetool/postgres-meta:local) | passed | 14.6s |
| SBOM generation (compliancetool/postgres-meta:local) | passed | 3.8s |
| critical scan (compliancetool/storage:local) | passed | 19.2s |
| SBOM generation (compliancetool/storage:local) | passed | 8s |
| Compose config () | passed | 0.1s |
| Compose config (infra/compose/local/compose.infra.yml) | passed | 0.1s |
| Compose config (infra/compose/local/compose.studio.yml) | passed | 0.1s |
| Compose config (infra/compose/local/compose.docling.yml) | passed | 0.1s |
| Compose config (infra/compose/local/compose.observability.yml) | passed | 0.1s |
| Compose config (infra/compose/local/compose.constrained-memory.yml) | passed | 0.1s |
| Compose config (infra/compose/local/compose.docling.yml, infra/compose/local/compose.constrained-memory.yml) | passed | 0.1s |
| Compose config (infra/compose/local/compose.studio.yml, infra/compose/local/compose.docling.yml, infra/compose/local/compose.observability.yml) | passed | 0.1s |
| isolated stack bootstrap | passed | 473.5s |
| web liveness | failed | 1.7s |
| acceptance | failed | Die zugrunde liegende Verbindung wurde geschlossen: Die Verbindung wurde unerwartet getrennt.. |

This report intentionally omits secrets, cookies, signed URLs, prompts, document contents, and personal data.
