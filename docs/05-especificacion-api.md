# 05 — Especificación de API

**Estado:** Base de contrato  
**Versión:** 1.0

## 1. Convenciones
- Base: `/api/v1`.
- JSON UTF-8.
- HTTPS obligatorio en producción.
- Cada request incluye/genera `request_id`.
- Escrituras críticas aceptan `operationUuid`.
- Errores: `{ code, message, requestId, details? }`.

## 2. Auth
- `POST /auth/login`
- `POST /auth/otp/request`
- `POST /auth/otp/verify`
- `POST /auth/logout`
- `GET /auth/me`

## 3. Jurado
- `GET /jurado/contexto` — noche asignada, comparsas, ítems, progreso y estado.
- `POST /jurado/votos` — crea voto idempotente.
- `GET /jurado/votos` — reconciliación del dispositivo.
- `POST /jurado/comparsas/:id/cerrar` — cierre idempotente.
- `POST /jurado/sync/reconcile` — compara operaciones locales/servidor.

### Crear voto
Request mínimo:
```json
{
  "operationUuid": "uuid",
  "comparsaId": 1,
  "itemId": 10,
  "valor": 4,
  "clientCreatedAt": "2026-08-26T22:00:00-03:00"
}
```
Respuesta exitosa: `201` la primera vez; un reintento idéntico puede responder `200` con el mismo recurso.

## 4. Fiscal/Escribano
- `GET /supervision/noches/:id/estado`
- `GET /supervision/eventos?after=<cursor>`
- `GET /reportes/jurado/:juradoId/noche/:nocheId`
- `GET /reportes/noche/:nocheId`
- `GET /reportes/general`
- `POST /penalizaciones`
- `POST /penalizaciones/:id/anular`

## 5. Actas
- `POST /actas/noche/:nocheId/generar`
- `GET /actas/:id`
- `POST /actas/:id/certificar`
- `GET /actas/:id/verificar`

## 6. Admin
CRUD versionado para:
- `/admin/users`
- `/admin/noches`
- `/admin/comparsas`
- `/admin/items`
- `/admin/asignaciones`

Operaciones críticas:
- `POST /admin/noches/:id/abrir`
- `POST /admin/noches/:id/cerrar`
- `POST /admin/asignaciones/:id/reemplazar`

## 7. Códigos de error de negocio
- `AUTH_REQUIRED`
- `ROLE_FORBIDDEN`
- `ASSIGNMENT_NOT_FOUND`
- `NIGHT_CLOSED`
- `VOTE_ALREADY_EXISTS`
- `INVALID_ITEM`
- `COMPARSA_INCOMPLETE`
- `OPERATION_CONFLICT`
- `SYNC_REVIEW_REQUIRED`
- `RATE_LIMITED`

## 8. Idempotencia
Si el mismo `operationUuid` llega nuevamente:
- mismo payload → devolver resultado original;
- payload diferente → `409 OPERATION_CONFLICT`.
