# PROJECT_ISOLATION

## Isolation Requirement
This repository is isolated to Nivran only.

## Project Boundaries
- Nivran: fragrance brand storefront, catalog, checkout, payment, packaging/labeling, branding, and related operations.
- Zomorod Medical Supplies: separate project and separate domain; no shared implementation scope in this repo.
- QuickAIBuy: separate project and separate domain; no shared implementation scope in this repo.

## Non-Transfer Rules
Agents must never mix across these projects:
- tasks
- requirements
- terminology
- code
- architecture
- data models
- deployment assumptions
- documentation

## Enforcement
If another project appears in instructions, files, naming, or requested architecture, halt and report:

`PROJECT MISMATCH DETECTED`
