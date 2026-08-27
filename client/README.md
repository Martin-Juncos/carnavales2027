# Client ? Carnavales 2027

PWA React/TypeScript para el sistema de votaci?n digital.

## Stack

- React + TypeScript + Vite
- React Router
- Tailwind CSS
- TanStack Query
- IndexedDB con Dexie
- Vitest + React Testing Library
- Playwright para E2E

## Comandos

```bash
npm install
npm run dev
npm run lint
npm run typecheck
npm test
npm run test:e2e
npm run build
```

## Variables p?blicas

Copiar `.env.example` a `.env` si hace falta cambiar endpoints locales:

```text
VITE_API_BASE_URL=http://localhost:3000/api/v1
VITE_API_HEALTH_URL=http://localhost:3000/health
```

No colocar secretos en variables `VITE_*`.

## Arquitectura offline

El flujo del jurado persiste primero en IndexedDB y despu?s intenta sincronizar:

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

La UI nunca presenta ?guardado localmente? como ?confirmado por servidor?.
