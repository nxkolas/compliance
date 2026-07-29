# AI generation contract versions

Gap and Action Plan prompt text, response schema, normalization, and objective
validation are code-defined immutable release inputs. Published releases keep
their original hashes and continue to load historically.

| Release          | Gap contract | Action contract | Qualification state                            |
| ---------------- | ------------ | --------------- | ---------------------------------------------- |
| `reliability-v1` | v8           | v2              | Active                                         |
| `reliability-v2` | v9           | v3              | Inactive; qualification failed                 |
| `reliability-v3` | v10          | v3              | Inactive; qualification failed                 |
| `reliability-v4` | v10          | v4              | Inactive; offline content qualification failed |
| `reliability-v5` | v11          | v4              | Inactive; offline content qualification failed |
| `reliability-v6` | v11          | v5              | Inactive; offline content qualification failed |
| `reliability-v7` | v11          | v6              | Inactive; qualification in progress            |

Gap v9 removed lexical Gap-kind inference from live validation. Gap v10 is its
immutable successor and adds targeted URL and raw-identifier issue codes and
repair guidance. Action Plan v3 removed lexical style and semantic gates.
Action Plan v4 is its immutable successor and explicitly prevents URLs, UUIDs,
database keys, and citation IDs in customer-visible prose and explains the
objective `action_raw_identifier` repair code.

Gap v11 is the immutable prompt-only successor to v10. It retains v10's
objective validator and explicitly requires each Gap statement to be one
standalone sentence of at most 20 words, state the control fact directly, and
omit law, directive, article, section, obligation, citation, and source-framing
prose. These remain offline writing constraints rather than live lexical
rejection gates.

Action Plan v5 is the immutable prompt-only successor to v4. It retains v4's
objective validator and explicitly limits titles to 12 words, results to one
or two sentences and 40 words, and evidence names to 12 words. It also requires
operational-only prose without named laws, directives, statutes, articles,
sections, obligations, regulators, or citations. These remain offline writing
constraints rather than runtime regex gates.

Action Plan v6 is the immutable prompt-only successor to v5. A bilingual
uncertainty qualification found that v5 could place a conditional lead-in in
the model-authored verification result before the server added its own
localized condition. V6 makes the two field responsibilities explicit:
`verificationResult` contains only verification work and its documented
outcome, while `conditionalRemediation` contains only remediation work. It
also budgets those fields at 18 and 16 words respectively. The objective
runtime validator remains unchanged.

The server continues to own Gap kind, Action mode, category identity, Gap
coverage, priority, ordering, mandatory citations, locale, and persistence
metadata. Runtime validation remains hard for structured correctness,
grounding, authorization, citations, locale, URLs, and internal identifiers.
Concision, preferred sentence shape, imperative titles, legal exposition, and
verification-first language are prompt and offline qualification dimensions,
not live lexical rejection gates.

The compatibility tests snapshot the active v8/v2 hashes. Do not route old
artifacts through a successor validator or repin existing assessments.
