export const NIS2_CORPUS_BOOTSTRAP_NOTICE =
  "Operational bootstrap only. This fixture is not a claim of legal completeness or legal advice; every imported version must be processed, reviewed, assembled, evaluated, published, and activated explicitly.";

export const NIS2_CORPUS_BOOTSTRAP_FIXTURE = [
  {
    family: {
      code: "nis2-eu-primary",
      frameworkCode: "nis2",
      jurisdictionCode: "EU",
      title: "NIS2 — European Union primary law",
    },
    source: {
      stableCode: "directive-eu-2022-2555-oj-en",
      title: "Directive (EU) 2022/2555 (NIS 2 Directive)",
      sourceKind: "directive",
      authorityTier: "primary_authority" as const,
      canonicalPublisher: "Publications Office of the European Union (EUR-Lex)",
    },
    import: {
      exactUrl: "https://eur-lex.europa.eu/legal-content/EN/TXT/PDF/?uri=CELEX:32022L2555",
      versionLabel: "OJ-L-333-2022-12-27-en",
      officialIdentifier: "CELEX:32022L2555",
      effectiveFrom: "2023-01-16",
      language: "en",
    },
  },
  {
    family: {
      code: "nis2-de-primary",
      frameworkCode: "nis2",
      jurisdictionCode: "DE",
      title: "NIS2 — German primary law",
    },
    source: {
      stableCode: "bsig-2025-current-de",
      title: "Gesetz über das Bundesamt für Sicherheit in der Informationstechnik (BSIG)",
      sourceKind: "statute",
      authorityTier: "primary_authority" as const,
      canonicalPublisher: "Bundesministerium der Justiz — Gesetze im Internet",
    },
    import: {
      exactUrl: "https://www.gesetze-im-internet.de/bsig_2025/BSIG.pdf",
      versionLabel: "current-at-import-de",
      officialIdentifier: "BSIG, BGBl. 2025 I Nr. 301",
      effectiveFrom: "2025-12-06",
      language: "de",
    },
  },
] as const;
