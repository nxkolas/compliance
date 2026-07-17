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
