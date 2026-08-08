# Betroffenheitscheck Calculation

> Status: current as of 8 August 2026. Describes the guided-wizard
> applicability check (`nis2_applicability`, release `2026-v1`, evaluator
> `nis2_scope_v3`).

## Purpose

The Betroffenheitscheck (applicability check) decides whether an organization
is affected by NIS2 in Germany and, if so, which entity categories apply. It is
the gate that unlocks the Gap-Analyse (`gap_eligible`).

The wizard is Germany-only. Germany is the only supported jurisdiction
(`SUPPORTED_JURISDICTION_CODES = ["DE"]`), and the first question covers every
German-competence case. Non-German cases end in `not_directly_in_scope` or
`clarification_required` through the equivalent evaluator facts.

## Guided wizard

The release publishes eight questions (Q1–Q6, with Q5 split into the three
size-bucket questions). The step-by-step wizard used by the guest
(`/check/applicability`) and authenticated
(`/tool/organizations/<organization-id>/applicability-check/new`) flows shows
only the questions that the route logic requires and submits immediately after
terminal END routes.

| Question | Stable key | Answer type | Mapped facts |
| --- | --- | --- | --- |
| Q1 Germany connection | `bc.germany_connection` | single choice | `eu_activity`, `jurisdiction_country`, `jurisdiction_basis`; terminal routes additionally `member_state_designation`, `nis2_entity_types`, and size facts |
| Q2 Special legal status | `bc.special_status` | single choice | `member_state_designation`; designation routes additionally representative entity and size facts |
| Q3 Area of activity | `bc.sector` | multi choice | `nis2_entity_types` (`none_of_these` / `unsure` defaults only) |
| Q4 Specific activity | `bc.activity` | multi choice, sections visible per selected sector | `nis2_entity_types` (German catalogue codes) |
| Q5 Size ranges | `bc.employee_count`, `bc.annual_revenue`, `bc.balance_sheet_total` | single choice each | the three bucket facts |
| Q6 Group aggregation | `bc.aggregation` | single choice | `sme_figures_verified` |

### Q1 route table

| Answer | Wizard route | Facts written (besides `eu_activity`/country/basis) |
| --- | --- | --- |
| Established in Germany | Q2 → Q3 → Q4 → Q5 → Q6 | default entity `de_bsig_electricity_supplier` (overwritten by Q3/Q4) |
| Critical installation in Germany | END: particularly important | `member_state_designation=de_critical_installation`, representative entity, concrete small size + verified aggregation |
| Federal administration | END: federal route | `nis2_entity_types=["de_bsig_federal_authority"]` |
| Cross-border digital provider, DE competent | Q2 → Digital Q4 → Q5 → Q6 | default entity `de_bsig_cloud_service_provider` (overwritten by Q4) |
| Public telecom service/network, DE competent | Q2 → Q5 → Q6 | telecom entities pre-selected |
| Regional administration under Land law | END: clarification required | `nis2_entity_types=["de_bsig_regional_public_administration"]` |
| None of these | END: not directly in scope | `eu_activity=no` |
| Not sure | END: clarification required | `eu_activity=unsure` |

### Q2 route table

| Answer | Wizard route | Facts written |
| --- | --- | --- |
| None | continue | `member_state_designation=none` |
| Critical installation | END: particularly important | `member_state_designation=de_critical_installation` + size facts |
| Authority essential / CER critical | END: particularly important | `member_state_designation=cer_critical` + size facts |
| Authority important | continue (important floor) | `member_state_designation=important` |
| Not sure | END: clarification required | `member_state_designation=unsure` |

### Q3 and Q4

`bc.sector` is only shown for the establishment route. `bc.activity` is shown
for the establishment route (sections filtered by the selected sectors) and
for the cross-border digital route (digital section only). The strongest
applicable route wins with evaluator precedence
(E → I → T → A1 → A2 → R; any "unsure" selection forces clarification, and any
domain-registration selection forces clarification with the §34 overlay):

- E (DNS, TLD registry, qualified trust): END particularly important.
- I only (non-qualified trust): END important.
- T / A1 / A2: continue to Q5.
- R (domain-name registration): END clarification required with the §34
  obligations overlay.
- No covered activity (only per-section "none"): not directly in scope, unless
  the Q2 important floor upgrades to important.

### Q5 and Q6

Size uses the unchanged `2003-361-v1` thresholds with paired financial tests:

```text
LARGE  = employees >= 250 OR (turnover > 50m AND balance > 43m)
MEDIUM = not LARGE AND (employees >= 50 OR (turnover > 10m AND balance > 10m))
SMALL  = otherwise
```

Q6 applies the size/skip table. When the classification is already decisive,
the wizard auto-answers the aggregation question with
`verified_de_without_it_exception`; otherwise the user answers it.

| Activity route | Small | Medium | Large |
| --- | --- | --- | --- |
| T (telecom) | Q6 | skip Q6 | skip Q6 |
| A1 (Annex 1) | Q6 | Q6 | skip Q6 |
| A2 (Annex 2) | Q6 | skip Q6 | skip Q6 |

## Fact derivation

`deriveFactsForAnswers` (`src/server/applicability-check/fact-derivation.ts`)
projects answered questions onto language-neutral decisive facts. Each
question carries `factMappings`; a mapping with `byOption` expands the selected
option value(s) through the per-option table (for example one Q4 activity to
several German entity-catalogue codes), while a mapping without `byOption`
writes the raw answer value. Terminal END routes never short-circuit the
evaluator — they write the equivalent facts and let `nis2_scope_v3` produce the
outcome and reason codes.

Q4 selections expand to the German profile's entity identities
(`nis2_entity_types`); the jurisdiction basis written by Q1 must permit them,
otherwise the evaluator reports `unresolved_profile_jurisdiction`.

## Outputs

Each submission produces an immutable applicability revision with:

- `jurisdiction_country` (always `DE` for positive German journeys),
- outcome (`essential_entity`, `important_entity`,
  `not_directly_in_scope`, `clarification_required`),
- evaluator evidence (scope bases, matched German entities, unresolved fact
  codes, obligation overlays, decisive facts),
- gap eligibility (`gap_eligible` is true only for DE
  `essential_entity`/`important_entity`),
- definition hash and input hash pinning the release and answer set.

The sector-regime overlay and the indirect supply-chain notice are no longer
produced: their facts (`sector_specific_regime`, `serves_critical_customers`,
`has_customer_security_evidence_requests`) were removed with the dropped
questions.

## Source files

- Release definition: `src/server/compliance/nis2/releases/2026-v1/release.ts`
- Wizard question content: `src/server/compliance/nis2/releases/2026-v1/release-source.ts`
- Evaluator: `src/server/applicability-check/rules.ts` (unchanged)
- Fact derivation: `src/server/applicability-check/fact-derivation.ts`
- Visibility/route model: `src/server/applicability-check/question-visibility.ts`
- Wizard UI: `components/applicability-check/applicability-wizard.tsx` and
  `components/applicability-check/wizard-flow.ts`
