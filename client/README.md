# Client — Carnavales 2027

PWA React/TypeScript para el sistema de votación digital.

## Stack

- React + TypeScript + Vite
- React Router
- Tailwind CSS
- TanStack Query
- IndexedDB con Dexie
- Vitest + React Testing Library
- Playwright para E2E

## Flujos implementados

- Login con `nombre + email + DNI` y verificación OTP.
- Jurado offline-first: selector de noche, comparsas de esa noche, planilla 0–5, confirmación inmutable, cierre y reconciliación.
- Fiscal/Supervisión: avance por noche, eventos, reportes y penalizaciones.
- Escribano: actas, certificación, verificación de hash, auditoría y anulaciones.
- Admin: CRUD de usuarios, noches, comparsas por noche, rubros/ítems, asignaciones/reemplazos y orden de pasada.

Las comparsas ya no son catálogo fijo: Administración las crea, modifica, ordena y borra por noche según el programa del evento. Los borrados y cambios sensibles se confirman con modal; si hay historial asociado, el backend bloquea el borrado.

## Comandos

```bash
npm install
npm run dev
npm run lint
npm run typecheck
npm test
npm run test:e2e:mock
npm run test:system
```

`test:e2e:mock` ejecuta el escenario offline rápido con API simulada. `test:system` delega al runner de la API, exige `carnavales2027_test` y Mailpit, y levanta temporalmente API `3100` y preview `5174`.

No colocar secretos en el cliente. Todo valor `VITE_*` queda visible en el bundle.

## Variables públicas

Copiar `.env.example` a `.env` si hace falta cambiar endpoints locales:

```text
VITE_API_BASE_URL=http://localhost:3000/api/v1
VITE_API_HEALTH_URL=http://localhost:3000/health
```

No colocar secretos en variables `VITE_*`.

## Arquitectura offline

El flujo del jurado persiste primero en IndexedDB y después intenta sincronizar:

```text
confirmar voto -> operationId UUID -> IndexedDB -> UI bloqueada -> /jurado/sync/reconcile -> SYNCED/CONFLICT/REJECTED
```

Tablas locales principales:

- `sessionSnapshots`
- `referenceData`
- `voteDrafts`
- `comparsaCloseDrafts`
- `syncOperations`
- `syncMetadata`
- `device`

Estados visibles: `LOCAL`, `PENDING`, `SYNCING`, `SYNCED`, `CONFLICT`, `REJECTED`.

La UI nunca presenta «guardado localmente» como «confirmado por servidor».
