# Betroffenheitscheck Redesign — Guided Wizard (Q1–Q6)

Status: pending — new plan replacing the completed tooltips plan on 2026-08-08. No code, release, or database changes have been applied by this plan.

## Outcome

After this work:

1. the Betroffenheitscheck asks a guided 2–6-question wizard (Q1 Germany connection, Q2 special status, Q3 sector, Q4 specific activity, Q5 size ranges, Q6 group aggregation) instead of the current flat twelve-question form;
2. the wizard is Germany-only: DE remains the only supported profile and Q1 covers every German-competence case;
3. the existing `nis2_scope_v3` evaluator, thresholds, German entity catalogue, legal instruments, and result/evidence model are reused unchanged — wizard answers map onto the existing facts;
4. the `nis2/2026-v1` release is modified in place (question set replaced, then republished after the approved disposable-dev-DB clear and reseed); no new release label is introduced;
5. the step-by-step wizard UI replaces the flat form in both guest and authenticated flows;
6. `bc.sector_specific_regime`, `bc.critical_customers`, and `bc.security_evidence_requested` are removed; sector-regime overlays and the indirect supply-chain notice are no longer produced; and
7. the placeholder applicability calculation document is filled in during implementation.

## Confirmed decisions

- Germany-only redesign. Non-DE organizations follow Q1's routes: no German connection → not directly in scope; unsure → clarification required.
- Modify `nis2/2026-v1` in place; do not introduce a new release label. Republishing follows the approved disposable-dev-DB clear and reseed.
- Reuse the existing evaluator, thresholds, German entity catalogue, legal instruments, and result/evidence model unchanged. Terminal END routes are implemented by writing the equivalent facts and letting the evaluator produce the outcome — never by short-circuiting the evaluator.
- Q4 activity options map to German entity-catalogue codes; one option may select several codes. Q3 determines which Q4 sections are visible. Q6 applies the size/skip table from the draft. The strongest applicable route wins (E → I → T → A1 → A2 → R).
- The wizard is a step-by-step flow (one question per screen, progress indicator, back/next navigation, conditional skips) for both guest (`/check/applicability`) and authenticated flows.
- The detailed Q1–Q6 draft below is preserved verbatim and is the authoritative design reference wherever it does not conflict with this summary.

## Non-goals

- No changes to evaluator rules, thresholds, the German entity catalogue, legal instruments, corpus, or the result/evidence model.
- No new compliance release label (`2026-v2` remains the legal-catalogue successor; the modified release stays `2026-v1`).
- No full-EU redesign and no new wizard for other countries.
- No sector-regime or supply-chain questions in the redesigned check.
- No changes to Gap-Analyse or other modules.
- No data migration: the disposable development database is cleared and rebuilt per the runbook.

## Current state

`nis2/2026-v1` publishes twelve questions with the `nis2_scope_v3` evaluator, the German profile (`de-bsig-2025-amended-2026-03`), the reviewed German entity catalogue, and the `2003-361-v1` thresholds. The evaluator already implements the wizard's precedence classes (`always_particularly_important`, `always_important`, `telecom`, `annex_1_standard`, `annex_2_standard`, `domain_registration_obligations`, `federal_administration`, `requires_land_law`), the size matrix, and the German aggregation-verification codes.

## Implementation changes

### Release and question set

- Replace the twelve `nis2/2026-v1` questions with the wizard question set using new stable keys: `bc.germany_connection` (single choice, terminal routes), `bc.special_status` (single choice), `bc.sector` (multi choice), `bc.activity` (multi choice, sections visible per selected sector), the existing three size-bucket questions, and `bc.aggregation` (single choice including `verified_de_without_it_exception` and `verified_de_with_it_exception`).
- Model route logic through question visibility conditions and fact defaults per the draft's route table; keep release validation intact.
- Remove `bc.sector_specific_regime`, `bc.critical_customers`, and `bc.security_evidence_requested` together with their fact definitions and related reason/overlay content.

### Fact mapping

- Map Q1 to `eu_activity`, `jurisdiction_country` (DE), and `jurisdiction_basis` (existing German basis codes); Q2 to `member_state_designation`; Q4 selections to `nis2_entity_types` (German catalogue codes); Q5 to the three bucket facts; Q6 to `sme_figures_verified` including the German verification codes.
- Terminal END routes (critical installation, federal administration, regional administration, none, unsure) write the equivalent facts so the evaluator returns the matching outcome and reason codes.
- Q4 options are reviewed localized release content that map to the catalogue codes they stand for.

### UI

- Build a step-by-step wizard component for the applicability check used by the guest (`/check/applicability`) and authenticated (`/tool/organizations/<organization-id>/applicability-check/new`) flows, keeping the existing help and tooltip presentation.

### Documentation

- Fill in `docs/backend-architecture/calculations/applicability-check.md` (currently a placeholder) with the implemented wizard, inputs, fact mapping, and outputs.

## Verification

- Release compiler tests: the new question set compiles, stable keys are unique, and questionnaire and aggregate hashes change while the evaluator artifact stays unchanged.
- Existing evaluator tests remain unchanged and pass.
- Wizard journey tests: critical installation → particularly important; Q2 important floor; A1 medium/large; A2; telecom small/medium; domain registration (R) → clarification with the §34 overlay; none → not directly in scope; unsure → clarification required.
- Guest and authenticated submissions produce identical classifications; DE and EN localization verified.
- Gap eligibility (DE `essential_entity` or `important_entity`) unchanged.
- Database rollout: all gates from `development-database-reset-and-bootstrap.md` after the clear and republish, including schema drift, corpus, release, applicability, Gap, and build checks.

## Completion criteria

- The wizard replaces the flat form in both flows and produces the same outcomes as the current evaluator for every journey above.
- The modified `2026-v1` is republished and active with a changed aggregate hash.
- No evaluator, threshold, catalogue, or result-model change is present.
- Dropped questions, overlays, and the supply-chain notice are gone from the release and UI.
- Active documentation (calculation doc and product ruleset) describes the new flow.
- All automated and manual gates pass with no schema drift.

## Assumptions

- Germany is the only supported profile; other countries are handled by Q1's routes.
- The detailed draft below is preserved verbatim and is the authoritative design reference.
- Modifying `2026-v1` in place follows the repo precedent of clearing the disposable development database before republishing.

---

## Detailed Design (Draft, Preserved Verbatim)

Yep. **No separate activity-clarification question.** Any qualifier we need goes directly into the wording of the Q4 option.

Here’s the version I’d actually ship. It keeps the legal complexity in your backend while making the user journey roughly **2–6 questions**. It also maps cleanly onto the precedence classes you already have: always particularly important → always important → telecom → Annex 1 → Annex 2 → domain-registration/regional special cases. 

For the mappings below:

| Code | Meaning                                  |
| ---- | ---------------------------------------- |
| `E`  | Particularly important, size-independent |
| `I`  | Important, size-independent              |
| `T`  | Telecom special size rule                |
| `A1` | Annex 1 standard size rule               |
| `A2` | Annex 2 standard size rule               |
| `R`  | Special/clarification route              |
| `NO` | No relevant activity from that selection |

The A1/A2 catalogue below is based on the current German BSIG Annex 1 and Annex 2. ([Gesetze im Internet][1])

---

# Q1 — Connection to Germany

> **Which statement applies to the organisation being assessed?**

| Answer                                                                                 | Route                                                                 |
| -------------------------------------------------------------------------------------- | --------------------------------------------------------------------- |
| The organisation is established in Germany                                             | → Q2                                                                  |
| It is not established in Germany, but operates a critical installation in Germany      | → **END: Particularly important**                                     |
| It is part of the German federal administration                                        | → **END: Federal-administration route**                               |
| It is a cross-border digital provider for which Germany is the competent country       | → Q2, then skip Q3 and show only **Digital Q4**                       |
| It provides a public telecommunications service/network for which Germany is competent | → Q2, then skip Q3/Q4 and go to **Q5 Size** with `T` already selected |
| It is regional/state administration subject to German Land law                         | → **END: Clarification required**                                     |
| None of these                                                                          | → **END: Not directly in German scope**                               |
| I’m not sure                                                                           | → **END: Clarification required**                                     |

This essentially turns the much more technical jurisdiction-basis logic in your existing profile into one user-facing question. 

---

# Q2 — Special legal status

> **Does any of the following already apply to the organisation?**

| Answer                                                                        | Route                                   |
| ----------------------------------------------------------------------------- | --------------------------------------- |
| We operate a critical installation                                            | → **END: Particularly important**       |
| An authority has classified us as particularly important / critical under CER | → **END: Particularly important**       |
| An authority has formally classified us as important                          | Set `important_floor = true` → continue |
| None of these                                                                 | → continue                              |
| I’m not sure                                                                  | → **Clarification required**            |

The “authority says important” option does **not** immediately end the check because another rule could still make the entity particularly important. That follows the override structure already in your evaluator. 

Normal German company:

**Q1 → Q2 → Q3**

Cross-border digital provider:

**Q1 → Q2 → Digital Q4**

Telecom provider identified in Q1:

**Q1 → Q2 → Q5**

---

# Q3 — Area of activity

> **In which areas does your organisation itself operate?**
> Select all that apply.

| User-facing choice                                                |
| ----------------------------------------------------------------- |
| Energy                                                            |
| Transport, traffic, postal or courier services                    |
| Banking or financial-market infrastructure                        |
| Healthcare, pharmaceuticals or medical devices                    |
| Drinking water or wastewater                                      |
| Digital infrastructure, IT, telecommunications or online services |
| Space or satellite services                                       |
| Waste management                                                  |
| Chemicals                                                         |
| Food                                                              |
| Manufacturing                                                     |
| Research                                                          |
| None of these                                                     |
| I’m not sure                                                      |

`None` → **END: Not directly in scope**, unless `important_floor = true`.

`I'm not sure` → **Clarification required**.

Anything else → **Q4**, displaying only the selected sections.

---

# Q4 — Specific activity

One heading:

> **Which of these activities does your organisation itself perform?**
> Select all that apply. Do not select something simply because your organisation purchases or uses it.

## Energy

| User sees                                                                                                                                              |           Map |
| ------------------------------------------------------------------------------------------------------------------------------------------------------ | ------------: |
| We supply electricity or operate electricity networks                                                                                                  |          `A1` |
| We generate or store electricity, aggregate electricity, operate electricity markets, provide balancing services or operate EV charging infrastructure |          `A1` |
| We operate district heating or cooling                                                                                                                 |          `A1` |
| We produce, refine, store or transport oil or petroleum products                                                                                       |          `A1` |
| We supply, produce, process, store or transport natural gas / operate gas or LNG infrastructure                                                        |          `A1` |
| We produce, store or transport hydrogen                                                                                                                |          `A1` |
| None of these                                                                                                                                          |          `NO` |
| I’m not sure                                                                                                                                           | clarification |

These activities fall within the energy categories of Annex 1. ([Gesetze im Internet][1])

## Transport, traffic, postal & courier

| User sees                                                                              |           Map |
| -------------------------------------------------------------------------------------- | ------------: |
| We operate commercial air transport, an airport or air-traffic/air-navigation services |          `A1` |
| We operate railway infrastructure, railway services or railway service facilities      |          `A1` |
| We transport passengers/freight by water or operate ports/port infrastructure          |          `A1` |
| We operate road-traffic management or intelligent transport systems                    |          `A1` |
| We provide postal or courier services                                                  |          `A2` |
| We only provide ordinary road haulage, freight forwarding or logistics                 |          `NO` |
| None of these                                                                          |          `NO` |
| I’m not sure                                                                           | clarification |

Postal/courier sits in Annex 2; the relevant transport infrastructure/operators are in Annex 1. ([Gesetze im Internet][1])

## Banking / financial-market infrastructure

| User sees                                |           Map |
| ---------------------------------------- | ------------: |
| We are a credit institution / bank       |          `A1` |
| We operate a trading venue               |          `A1` |
| We are a central counterparty (CCP)      |          `A1` |
| We provide other financial services only |          `NO` |
| None of these                            |          `NO` |
| I’m not sure                             | clarification |

This avoids the false positive of treating every insurance, accounting, fintech or financial-services company as automatically covered through this sector. The statutory Annex 1 categories are narrower. ([Gesetze im Internet][1])

## Healthcare, pharma & medical devices

| User sees                                                                              |           Map |
| -------------------------------------------------------------------------------------- | ------------: |
| We provide healthcare services to patients                                             |          `A1` |
| We operate an EU reference laboratory                                                  |          `A1` |
| We research or develop pharmaceutical products                                         |          `A1` |
| We manufacture pharmaceutical products                                                 |          `A1` |
| We manufacture medical devices classified as critical during a public-health emergency |          `A1` |
| We manufacture other medical devices or in-vitro diagnostic devices                    |          `A2` |
| None of these                                                                          |          `NO` |
| I’m not sure                                                                           | clarification |

This distinction matters because health activities appear in Annex 1 while specified medical-device manufacturing also appears in Annex 2. ([Gesetze im Internet][1])

## Drinking water / wastewater

| User sees                                  |           Map |
| ------------------------------------------ | ------------: |
| We supply drinking water                   |          `A1` |
| We collect, treat or dispose of wastewater |          `A1` |
| None of these                              |          `NO` |
| I’m not sure                               | clarification |

([Gesetze im Internet][1])

## Digital / IT / telecom / online services

This is probably your most important Q4 section.

| User sees                                                                                                |           Map |
| -------------------------------------------------------------------------------------------------------- | ------------: |
| We operate an Internet Exchange Point (IXP)                                                              |          `A1` |
| We provide cloud-computing services                                                                      |          `A1` |
| We provide data-centre services                                                                          |          `A1` |
| We operate a Content Delivery Network (CDN)                                                              |          `A1` |
| We continuously manage or operate customers' IT systems                                                  |    `A1` — MSP |
| We continuously manage or operate cybersecurity services for customers                                   |   `A1` — MSSP |
| We provide DNS services                                                                                  |           `E` |
| We operate a top-level-domain registry                                                                   |           `E` |
| We provide qualified trust services                                                                      |           `E` |
| We provide other/non-qualified trust services                                                            |           `I` |
| We operate a public telecommunications network or provide publicly available telecommunications services |           `T` |
| We operate an online marketplace                                                                         |          `A2` |
| We operate an online search engine                                                                       |          `A2` |
| We operate a social-network platform                                                                     |          `A2` |
| We provide domain-name registration services                                                             |           `R` |
| We only develop software, provide IT consulting or operate our own internal IT                           |          `NO` |
| None of these                                                                                            |          `NO` |
| I’m not sure                                                                                             | clarification |

Cloud, data-centre, MSP/MSSP and the other digital-infrastructure categories are expressly represented in Annex 1; online marketplaces, search engines and social-network platforms sit in Annex 2. ([Gesetze im Internet][1])

For the MSP label, add helper text rather than another question:

> **Managed IT services:** ongoing management or operation of customers' ICT systems. One-off consulting or software development alone does not count for this option.

Same principle for MSSP.

Domain-name registration remains your existing `clarification + §34 overlay` route rather than independently producing important/particularly-important status. 

## Space

| User sees                                                        |                    Map |
| ---------------------------------------------------------------- | ---------------------: |
| We operate ground infrastructure supporting space-based services |                   `A1` |
| We manufacture satellites, spacecraft or related equipment       | `A2` via Manufacturing |
| None of these                                                    |                   `NO` |
| I’m not sure                                                     |          clarification |

([Gesetze im Internet][1])

## Waste

Build the legal qualifier directly into the option:

| User sees                                               |           Map |
| ------------------------------------------------------- | ------------: |
| Waste management is one of our main business activities |          `A2` |
| We only handle waste generated by our own organisation  |          `NO` |
| None of these                                           |          `NO` |
| I’m not sure                                            | clarification |

Annex 2 excludes entities for which waste management is not the main economic activity. ([Gesetze im Internet][2])

## Chemicals

Again, put the qualifier in the answer rather than creating Q4.1:

| User sees                                                                                                                   |           Map |
| --------------------------------------------------------------------------------------------------------------------------- | ------------: |
| We manufacture or import covered chemical substances or mixtures under the relevant REACH / chemical-manufacturing category |          `A2` |
| We only use chemical products purchased from other companies                                                                |          `NO` |
| None of these                                                                                                               |          `NO` |
| I’m not sure whether our chemicals activity meets this definition                                                           | clarification |

Because this category is fairly technical, I'd put **“Show definition”** beside it rather than create another wizard question. The German Annex 2 category is tied to specified chemical manufacturers/importers and REACH concepts. ([UMCO][3])

## Food

| User sees                                        |           Map |
| ------------------------------------------------ | ------------: |
| We wholesale food products                       |          `A2` |
| We industrially produce or process food products |          `A2` |
| We only operate retail, restaurants or catering  |          `NO` |
| None of these                                    |          `NO` |
| I’m not sure                                     | clarification |

The current Annex 2 wording targets wholesale and industrial production/processing. ([Gesetze im Internet][2])

## Manufacturing

| User sees                                                     |           Map |
| ------------------------------------------------------------- | ------------: |
| We manufacture medical devices or in-vitro diagnostic devices |          `A2` |
| We manufacture computers, electronic or optical products      |          `A2` |
| We manufacture electrical equipment                           |          `A2` |
| We manufacture machinery                                      |          `A2` |
| We manufacture motor vehicles or motor-vehicle parts          |          `A2` |
| We manufacture other transport equipment                      |          `A2` |
| We manufacture other products only                            |          `NO` |
| None of these                                                 |          `NO` |
| I’m not sure                                                  | clarification |

Those manufacturing categories correspond to the specified manufacturing groups in Annex 2; e.g. the Annex expressly includes computer, electronic and optical products. ([Gesetze im Internet][2])

An optional **WZ/NACE code field** here could improve confidence without becoming another question.

## Research

| User sees                                                                                                |           Map |
| -------------------------------------------------------------------------------------------------------- | ------------: |
| Our primary purpose is applied research or experimental development intended for commercial exploitation |          `A2` |
| We are primarily an educational institution                                                              |          `NO` |
| None of these                                                                                            |          `NO` |
| I’m not sure                                                                                             | clarification |

The BSIG definition is aimed at research organisations whose primary objective is applied research or experimental development for commercial use; educational institutions are excluded. ([openkritis.de][4])

---

# What happens after Q4?

This is important because **not everybody goes to size**.

```text
Any E activity
    ↓
END
Particularly important


Only I activity
    ↓
END
Important


Any T / A1 / A2 activity
    ↓
Q5 SIZE


Only R activity
    ↓
END
Clarification required
+ applicable special obligation note


No matching activity
    ↓
important_floor?
   /             \
 YES              NO
  ↓                ↓
Important      Not directly
               in scope
```

If the user selected multiple activities, use the **strongest applicable route**, matching the precedence approach already built into your evaluator. 

---

# Q5 — Size

No exact data.

> **Select the ranges that apply to the organisation. Exact figures are not required.**

### Employees

| Answer        |
| ------------- |
| Fewer than 50 |
| 50–249        |
| 250 or more   |
| I’m not sure  |

### Annual turnover

| Answer                                   |
| ---------------------------------------- |
| €10 million or less                      |
| More than €10 million, up to €50 million |
| More than €50 million                    |
| I’m not sure                             |

### Balance-sheet total

| Answer                                   |
| ---------------------------------------- |
| €10 million or less                      |
| More than €10 million, up to €43 million |
| More than €43 million                    |
| I’m not sure                             |

Internally:

```text
LARGE =
    employees >= 250
    OR
    (turnover > 50m AND balance > 43m)

MEDIUM =
    not LARGE
    AND (
        employees >= 50
        OR
        (turnover > 10m AND balance > 10m)
    )

SMALL =
    otherwise
```

Those are the current §28 BSIG thresholds. In particular, the turnover and balance-sheet thresholds are **paired**; exceeding only one financial figure does not satisfy that financial test. ([Gesetze im Internet][5])

---

# Q6 — Group aggregation

This should be **conditional**, not shown automatically.

> **Do the size ranges above already take relevant partner and linked companies into account?**

| Answer                                                      | Meaning                |
| ----------------------------------------------------------- | ---------------------- |
| Yes                                                         | use Q5 result          |
| We have no relevant partner or linked companies             | use Q5 result          |
| Yes, taking the BSIG IT-independence exception into account | use Q5 result          |
| No                                                          | clarification required |
| I’m not sure                                                | clarification required |

That preserves the aggregation requirement from your current evaluator without making everyone fill out ownership percentages and group structures. Your current ruleset already treats unverified aggregation as `clarification_required`. 

But you can make Q6 even smarter.

### Skip Q6 when group aggregation cannot change the classification

For `A1`:

| Q5 result | Next                                              |
| --------- | ------------------------------------------------- |
| Large     | **END → Particularly important**                  |
| Medium    | Q6, because group aggregation could make it Large |
| Small     | Q6, because it could become Medium or Large       |

For `A2`:

| Q5 result       | Next                |
| --------------- | ------------------- |
| Medium or Large | **END → Important** |
| Small           | Q6                  |

For `T`:

| Q5 result       | Next                             |
| --------------- | -------------------------------- |
| Medium or Large | **END → Particularly important** |
| Small           | Q6                               |

That makes the questionnaire even shorter while preserving the result.

---

# Final classification engine

The whole thing boils down to:

```text
START
  │
  ▼
Q1 Germany connection
  │
  ├── no German basis ──────────────→ NOT IN SCOPE
  ├── critical installation ────────→ PARTICULARLY IMPORTANT
  ├── federal administration ───────→ FEDERAL ROUTE
  ├── regional administration ──────→ CLARIFICATION
  │
  ▼
Q2 Special status
  │
  ├── critical / authority essential → PARTICULARLY IMPORTANT
  ├── authority important ───────────→ remember IMPORTANT FLOOR
  │
  ▼
Q3 Sector
  │
  ▼
Q4 Actual activity
  │
  ├── E ─────────────────────────────→ PARTICULARLY IMPORTANT
  ├── I only ────────────────────────→ IMPORTANT
  ├── R only ────────────────────────→ CLARIFICATION
  ├── no match ──────────────────────→ NOT IN SCOPE*
  │
  └── A1 / A2 / T
          │
          ▼
        Q5 Size ranges
          │
          ├── decisive already ──────→ RESULT
          │
          ▼
        Q6 Group aggregation
          │
          ▼
        RESULT
```

`*` Unless the formal **important** authority designation from Q2 created an `important_floor`.

And the classification matrix at the end is simply:

| Activity route |                  Small |                 Medium |                  Large |
| -------------- | ---------------------: | ---------------------: | ---------------------: |
| `E`            | Particularly important | Particularly important | Particularly important |
| `I`            |              Important |              Important |              Important |
| `T`            |              Important | Particularly important | Particularly important |
| `A1`           |  Not directly in scope |              Important | Particularly important |
| `A2`           |  Not directly in scope |              Important |              Important |

That is essentially the same matrix already contained in your current rule set, just with a drastically simpler front end. 

**So the final design is six possible core questions, but most users will not see all six.** The key architectural change is that Q3/Q4 are now a friendly UI over your existing entity catalogue rather than exposing the catalogue itself.

[1]: https://www.gesetze-im-internet.de/bsig_2025/anlage_1.html?utm_source=chatgpt.com "Anlage 1 BSIG - Einzelnorm"
[2]: https://www.gesetze-im-internet.de/bsig_2025/anlage_2.html?utm_source=chatgpt.com "BSIG) Anlage 2 Sektoren wichtiger Einrichtungen"
[3]: https://www.umco.de/blog/reach/auswirkungen-des-neuen-cybersecurity-gesetzes-nis2umsucg-auf-reach-registranten.html?utm_source=chatgpt.com "Auswirkungen des neuen Cybersecurity-Gesetzes (NIS-2 ..."
[4]: https://www.openkritis.de/it-sicherheitsgesetz/sektor_forschung.html?utm_source=chatgpt.com "Forschungseinrichtungen in NIS2"
[5]: https://www.gesetze-im-internet.de/bsig_2025/__28.html?utm_source=chatgpt.com "§ 28 BSIG - Einzelnorm"
