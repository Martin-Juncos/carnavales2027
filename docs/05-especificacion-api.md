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

### Solicitar OTP
`POST /auth/login` y `POST /auth/otp/request` validan identidad operativa y envían un código al correo del usuario.

Request:
```json
{
  "nombre": "Nombre Apellido",
  "email": "jurado@example.com",
  "dni": "25609038"
}
```

El DNI actúa como clave operativa del usuario. No existe una contraseña separada para el login. El código OTP no se devuelve en la respuesta ni debe registrarse en logs.

## 3. Jurado
- `GET /jurado/noches` — noches creadas disponibles para selección.
- `GET /jurado/noches/:nocheId/contexto` — contexto de la noche elegida: comparsas, ítems, progreso y estado.
- `GET /jurado/contexto` — contexto heredado, mantenido por compatibilidad técnica.
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
- `GET|POST /admin/users`, `PATCH|DELETE /admin/users/:id`
- `GET|POST /admin/noches`, `PATCH|DELETE /admin/noches/:id`
- `GET|POST /admin/comparsas`, `PATCH|DELETE /admin/comparsas/:id` y `PATCH /admin/noches/:id/comparsas/orden`
- `GET|POST /admin/items`, `PATCH|DELETE /admin/items/:id`

Usuarios, noches, comparsas e ítems se borran físicamente solo si no tienen historial asociado. Si existen sesiones, OTP, votos, cierres, penalizaciones, actas, eventos, auditoría o subítems relacionados, el backend bloquea el borrado para preservar evidencia. El endpoint bulk de orden recibe `{ "comparsas": [{ "comparsaId": number, "orden": number }] }` y la UI exige confirmación antes de enviarlo.

Operaciones críticas:
- `POST /admin/noches/:id/abrir`
- `POST /admin/noches/:id/cerrar`

Los endpoints históricos de asignaciones pueden permanecer disponibles por compatibilidad técnica, pero no forman parte del flujo operativo visible del Administrador.

## 7. Códigos de error de negocio
- `AUTH_REQUIRED`
- `FORBIDDEN`
- `RESOURCE_NOT_FOUND`
- `JUROR_NOT_ASSIGNED`
- `ASSIGNMENT_INACTIVE`
- `JUDGE_CAPACITY_EXCEEDED`
- `NIGHT_CLOSED`
- `NIGHT_HAS_DEPENDENCIES`
- `USER_HAS_DEPENDENCIES`
- `COMPARSA_HAS_DEPENDENCIES`
- `ITEM_HAS_DEPENDENCIES`
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

`POST /jurado/sync/reconcile` responde por operación con `APPLIED`, `ALREADY_APPLIED`, `REJECTED` o `CONFLICT`. La decisión reglamentaria final sobre operaciones recibidas después del cierre continúa pendiente; el flujo actual permite votar al jurado autenticado sobre comparsas activas de la noche elegida.
