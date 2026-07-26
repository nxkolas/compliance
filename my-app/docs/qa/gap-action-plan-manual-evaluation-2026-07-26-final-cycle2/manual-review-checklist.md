# Atomic Gap and Action Plan manual review

Run: `2026-07-26T21-17-04Z`

Inspect the provider-produced prose in every case JSON file. Automated schema checks are necessary but do not constitute content approval.

For each English and German case, record concrete excerpts and mark every item only after inspection:

- [x] Atomic gaps are short, standalone, and non-overlapping.
- [x] Missing, partial, and uncertain wording is truthful.
- [x] Partial answers contain no invented sub-control deficiency.
- [x] Gap prose contains no recommendation or remediation instruction.
- [x] Review notices describe contradictions without action advice.
- [x] Actions combine or split gaps sensibly within one category.
- [x] Uncertain work verifies first and makes remediation conditional.
- [x] Results are clear and recommended evidence names are concrete.
- [x] Removed objective/deliverable/acceptance-criteria prose is absent.
- [x] Both locales are readable and match the pinned result language.

## Cases

### 1. mature-baseline-en

Automated checks: PASS

- Human judgment: PASS
- Gap excerpt: None.
- Action excerpt: None.
- Notes: All 10 categories are fulfilled. The expected deterministic empty state contains zero gaps and zero actions.

### 2. absent-controls-en

Automated checks: PASS

- Human judgment: PASS
- Gap excerpt: "No multi-factor authentication is used for critical, admin, or remote access."
- Action excerpt: "Introduce multi-factor authentication for critical and remote access" — "Multi-factor authentication is mandatory for important, administrative, and remote accounts."
- Notes: All 31 missing-control gaps and 31 actions were inspected. Every gap has one concrete same-category action; evidence names are specific and the prose contains no legal analysis.

### 3. mixed-maturity-en

Automated checks: PASS

- Human judgment: PASS
- Gap excerpt: "Management approval and oversight of important IT security measures is only partially implemented."
- Action excerpt: "Verify that risk analysis is updated after changes or incidents" — "The organization has verified whether the risk analysis is regularly updated and updated after major changes or security incidents; any identified deficiency will be addressed."
- Notes: The four mixed-maturity gaps stay within their questionnaire states. Partial answers do not invent sub-control deficiencies, and the uncertain action verifies before conditional remediation.

### 4. uncertain-evidence-de

Automated checks: PASS

- Human judgment: PASS
- Gap excerpt: "Es ist unklar, ob eine klar benannte Person oder ein Team für IT-Sicherheit verantwortlich ist."
- Action excerpt: "Verantwortlichkeit für IT-Sicherheit prüfen" — "Es ist festgestellt, ob eine klar benannte Person oder ein Team für IT-Sicherheit verantwortlich ist. Falls eine Lücke festgestellt wird, ist die Benennung und Dokumentation vorzunehmen."
- Notes: All 31 uncertainty gaps and 31 German actions were inspected. Each action verifies the unknown condition first, makes remediation conditional on an identified deficiency, and names concrete evidence.

### 5. contradictory-backup-evidence-en

Automated checks: PASS

- Human judgment: PASS
- Gap excerpt: "No restoration test has ever been performed for any production system."
- Action excerpt: "Verify current restore capability and complete a documented restore test" — "A documented restoration test is conducted for at least one production system, verifying and evidencing the ability to recover from backups. Further remediation depends on the identification of deficiencies in restore capability."
- Notes: The initial notice says, "A significant contradiction exists: backup restoration is not tested despite the asserted full implementation in the questionnaire." It is factual and contains no action advice. Finalization is blocked with `GAP_REVIEW_UNRESOLVED`; the corrected immutable revision has three non-overlapping gaps covered by two actions.

## Cross-case audit

- Exact release: `e16dc62a-53a8-4ebc-8336-1915a231c860` (`nis2-gap/guided-v6`) in every case.
- Final counts: case 1 `0/0`, case 2 `31/31`, case 3 `4/4`, case 4 `31/31`, case 5 `3/2` gaps/actions.
- Every automatic check passes in every final case artifact, and every final gap is covered by a same-category action.
- No visible action prose contains raw identifiers, legal-analysis phrases, or vague German qualifiers such as `falls nötig`, `bei Bedarf`, or `ggf.`.
