# 05 — Especificación de API

**Estado:** Contrato implementado
**Versión:** 1.1

## 1. Convenciones
- Base: `/api/v1`.
- JSON UTF-8.
- HTTPS obligatorio en producción.
- Cada request incluye/genera `request_id`.
- Escrituras críticas aceptan `operationUuid`.
- Éxito: `{ "data": ..., "meta": { ... } }`.
- Error: `{ "error": { "code", "message", "requestId", "retryable", "details"? } }`.
- La autenticación usa una sesión opaca persistida por el servidor y una cookie `HttpOnly`.

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
Operaciones implementadas:
- `GET|POST /admin/users` y `PATCH /admin/users/:id`
- `GET|POST /admin/noches` y `PATCH /admin/noches/:id`
- `GET|POST /admin/comparsas` y `PATCH /admin/comparsas/:id`
- `GET|POST /admin/items` y `PATCH /admin/items/:id`
- `GET|POST /admin/asignaciones`

Operaciones críticas:
- `POST /admin/noches/:id/abrir`
- `POST /admin/noches/:id/cerrar`
- `POST /admin/asignaciones/:id/reemplazar`

## 7. Códigos de error de negocio
- `AUTH_REQUIRED`
- `FORBIDDEN`
- `RESOURCE_NOT_FOUND`
- `JUROR_NOT_ASSIGNED`
- `ASSIGNMENT_INACTIVE`
- `JUDGE_CAPACITY_EXCEEDED`
- `NIGHT_CLOSED`
- `COMPARSA_CLOSED`
- `ITEM_NOT_SCORABLE`
- `INVALID_SCORE`
- `VOTE_ALREADY_CONFIRMED`
- `COMPARSA_INCOMPLETE`
- `IDEMPOTENCY_CONFLICT`
- `SYNC_REVIEW_REQUIRED`
- `RATE_LIMITED`
- `OTP_DELIVERY_UNAVAILABLE` (503 reintentable cuando el canal OTP no responde)

## 8. Idempotencia
Si el mismo `operationUuid` llega nuevamente:
- mismo payload → devolver resultado original;
- payload diferente → `409 IDEMPOTENCY_CONFLICT`, preservando evidencia auditable.

`POST /jurado/sync/reconcile` responde por operación con `APPLIED`, `ALREADY_APPLIED`, `REJECTED` o `CONFLICT`. La decisión reglamentaria final sobre operaciones recibidas después del cierre continúa pendiente; el backend actual las conserva como conflicto y no las aplica silenciosamente.
