# Compliance Applicability

This context models versioned legal applicability checks whose results must remain reproducible after the governing legal content changes.

## Language

**Compliance Release**:
An immutable, published combination of questionnaire, EU scope model, national profiles, thresholds, evaluator contract, and localized legal content used by one applicability check.
_Avoid_: Rules version, questionnaire version, release bundle

**EU Application Identity**:
A stable product identity used to represent an EU-core NIS2 entity category across releases; it may split or combine statutory categories and therefore is not itself a legal count.
_Avoid_: NIS2 entity type, statutory row, canonical entity

**National Entity Identity**:
A stable selectable identity defined by a national implementation profile, independently versioned from EU application identities. It may split or combine statutory categories when a decisive classification fact requires it.
_Avoid_: Override, German option, national alias

**Statutory Category**:
A category or row as it appears in an official legal instrument. Several selectable identities may share one statutory category and preserve that relationship through common legal-provision provenance.
_Avoid_: Application identity, option, canonical entity

**National Mapping**:
Versioned provenance connecting a national entity identity to zero, one, or more EU application identities without asserting that their legal meanings are identical.
_Avoid_: Override, replacement, one-to-one mapping

**Jurisdiction Profile**:
An immutable national legal model containing its entity catalog, classifications, threshold policy, jurisdiction rules, designations, legal provisions, and national mappings.
_Avoid_: Country config, entity overrides, locale profile

**Decisive Fact**:
A language-neutral answer-derived fact that can change an applicability outcome under the pinned compliance release.
_Avoid_: Form value, UI state, metadata

**Clarification Required**:
An outcome stating that the pinned release lacks a reliable decisive fact or supported legal path and therefore cannot make a positive or negative classification.
_Avoid_: Unknown, error, unsupported

**Authoritative Legal Corpus**:
A centrally curated, versioned collection of legal and regulatory sources shared across organizations and used to support compliance claims.
_Avoid_: Reference documents, global documents, AI knowledge

**Legal Corpus Release**:
An immutable, published selection of authoritative legal-source versions that can be pinned by a compliance workflow and reproduced later.
_Avoid_: Latest sources, active documents, corpus snapshot

**Corpus Family**:
A framework-and-jurisdiction boundary within the Authoritative Legal Corpus whose releases can be composed by a compliance workflow.
_Avoid_: Folder, bucket, global corpus

**Authority Tier**:
The declared legal weight of a corpus source: primary authority, official guidance, or curated secondary material. The tier expresses provenance and binding force rather than retrieval relevance.
_Avoid_: Source score, priority, trust score

**Language Rendition**:
A language-specific expression of a legal source labeled as official, reviewed internal, or machine-assisted and linked to its authoritative-language source when it is not official.
_Avoid_: Copy, locale, translated document

**Platform Administrator**:
An internal operator authorized to curate, publish, and activate shared legal-corpus content independently of any organization membership.
_Avoid_: Organization owner, corpus user, super admin

**Organization Evidence**:
Private, organization-scoped material supplied to demonstrate or assess that organization's compliance state.
_Avoid_: Legal corpus, uploaded context, customer knowledge

**Grounded Synthesis**:
AI-generated comparison, explanation, or recommendation whose material claims are supported by explicitly supplied and validated corpus or organization-evidence citations.
_Avoid_: Model knowledge, unsourced answer, extractive answer

**Gap Analysis Revision**:
An immutable organization-specific Gap Analysis result for one pinned set of questionnaire, applicability, Organization Evidence, and Gap Release inputs.
_Avoid_: Gap report, reassessment result, mutable analysis

**Gap Finding**:
The deterministic category assessment of one applicable requirement within one Gap Analysis Revision.
_Avoid_: Issue, recommendation, requirement

**Atomic Gap**:
One immutable, short missing, partial, or uncertain fact derived from exactly one triggering questionnaire answer and owned by a Gap Finding.
_Avoid_: Recommendation, action, evidence request

**Action Plan**:
An organization's category-grouped set of independently AI-generated actions linked to the finalized Atomic Gaps.
_Avoid_: Gap Analysis, remediation report, plan revision
