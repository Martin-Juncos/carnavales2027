---
name: carnavales-orchestrator
description: Seleccionar la mínima combinación de skills locales para tareas de dominio, API, PWA, migraciones, seguridad, sincronización y pruebas de Carnavales 2027.
---

# Carnavales 2027 — Skill Orchestrator

## Purpose

Route development tasks to the minimum set of project skills required
to complete the requested work.

The orchestrator does not implement domain logic itself.

## Core rule

Use the smallest possible number of skills.

Default:

- 1 primary skill
- 0-2 supporting skills

Never load unrelated skills.

Maximum skills per task: 4.

If more than 4 appear necessary, reduce the task scope or execute
the work in independent phases.

## No recursive routing

Only this orchestrator may select project skills.

Specialized skills must not invoke or route to other project skills.

Never create chains such as:

skill A → skill B → skill C → skill A.

## Routing

### Domain rules

Use:

`carnavales-domain-rules`

When the task involves:

- jurors
- nights
- comparsas
- voting rules
- scoring
- penalties
- contest state

### PostgreSQL

Use:

`postgres-schema-migrations`

For:

- schema
- migrations
- indexes
- constraints
- transactions
- database concurrency

### Vote writes

Use:

`vote-integrity`

For:

- vote creation
- immutability
- idempotency
- duplicate prevention
- transactional vote handling

Combine with `backend-api` when permissions or endpoint contracts are involved.

### REST API

Use:

`backend-api`

For:

- routes
- controllers
- request/response DTOs
- HTTP errors
- endpoint contracts

### Authentication

Use:

`auth-security`

For:

- login
- OTP
- sessions
- expiration
- rate limiting

### Authorization

Use:

`backend-api`

For:

- Jurado
- Fiscal
- Escribano
- Admin
- ownership/context authorization

### Offline synchronization

Use:

`offline-sync`

For:

- IndexedDB
- operationId
- retry queues
- reconnection
- reconciliation

### Juror UI

Use:

`frontend-pwa`

For the juror PWA and voting UX.

### Administrative UI

Use:

`frontend-pwa`

for Admin, Fiscal and Escribano interfaces.

### Auditing

Use:

`backend-api`

for immutable activity records and traceability.

### Scoring

Use:

`backend-api`

for totals, item aggregation and penalties.

### Testing

Use:

`testing-carnavales`

only when:

- tests are explicitly requested,
- implementing a critical path requiring tests,
- validating a completed feature.

Do not automatically load it for every small task.

### Documents

Use:

`backend-api`

for:

- PDF
- CSV
- acts
- SHA-256
- document verification

### Review

Use:

`auth-security`

when explicitly reviewing existing code or a completed implementation.

Do not use it while initially implementing a feature unless requested.

## Stop condition

After the requested task is completed:

STOP.

Do not automatically run:

- another skill,
- security review,
- refactoring,
- documentation generation,
- additional tests,

unless required by the original task.

## Context efficiency

Do not load complete project documentation unless necessary.

Prefer:

1. current task
2. applicable AGENTS.md
3. selected skill
4. exact relevant project document/section

Do not read unrelated documents.

## Examples

Task:

"Create POST /votes"

Load:

1. vote-integrity
2. backend-api

Do not load anything else.

Task:

"Create IndexedDB retry queue"

Load:

1. offline-sync

Optionally:

2. vote-integrity

Task:

"Create login OTP endpoint"

Load:

1. auth-security
2. backend-api

Task:

"Create PostgreSQL constraint preventing duplicate votes"

Load:

1. postgres-schema-migrations
2. vote-integrity

Task:

"Review vote endpoint security"

Load:

1. auth-security
2. vote-integrity
