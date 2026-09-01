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
- Jurado online-first: selector de noche, comparsas de esa noche, planilla 0–5, confirmación directa contra API, inmutabilidad y cierre idempotente.
- Fiscal/Supervisión: panel operativo con selección de noche, avance por comparsa, indicadores en vivo, reportes, eventos y penalizaciones guiadas.
- Escribano: panel operativo con resultados por noche, actas, verificación SHA-256, certificación, penalizaciones y auditoría.
- Admin: CRUD de usuarios, noches, comparsas por noche, rubros/ítems y orden de pasada.

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

`test:e2e:mock` ejecuta el escenario rápido con API simulada. `test:system` delega al runner de la API, exige `carnavales2027_test` y Mailpit, y levanta temporalmente API `3100` y preview `5174`.

No colocar secretos en el cliente. Todo valor `VITE_*` queda visible en el bundle.

## Variables públicas

Copiar `.env.example` a `.env` si hace falta cambiar endpoints locales:

```text
VITE_API_BASE_URL=http://localhost:3000/api/v1
VITE_API_HEALTH_URL=http://localhost:3000/health
```

No colocar secretos en variables `VITE_*`.

## Conectividad del Jurado

El flujo operativo actual es online-first:

```text
confirmar voto -> operationId UUID -> POST /jurado/votos -> voto bloqueado al confirmar servidor
cerrar comparsa -> operationId UUID -> POST /jurado/comparsas/:id/cerrar
```

Si no hay conexión, la UI no confirma votos ni cierres: muestra un error claro y permite reintentar manualmente. IndexedDB se conserva para cache de sesión/contexto y recuperación visual, no como cola crítica activa.

`POST /jurado/sync/reconcile` y las tablas locales históricas siguen disponibles solo por compatibilidad técnica.
