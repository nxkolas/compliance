# Betroffenheitscheck Calculation

> Status: current as of 7 August 2026.
> This document is intentionally a placeholder: the calculation is being
> redefined and will be documented here once it is fixed.

## Purpose

The Betroffenheitscheck (applicability check) decides whether an organization
is affected by NIS2 in its jurisdiction and, if so, which entity categories
apply. It is the gate that unlocks the Gap-Analyse (`gap_eligible`).

## Calculation

*To be written. The current deterministic rule evaluation, question
visibility, entity catalog, and jurisdiction support live in
`src/server/applicability-check/` and `src/server/definitions/applicability.ts`;
the new calculation will replace this section.*

## Inputs

*To be written.*

## Output

*To be written — an immutable applicability revision with jurisdiction code,
outcome, and gap eligibility.*

