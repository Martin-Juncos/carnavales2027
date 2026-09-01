---
name: backend-api
description: Implementar o revisar endpoints, módulos y contratos HTTP de Carnavales 2027 con Node.js y Express. Usar para routes, controllers, services, repositories, DTOs, validación, middleware y mapeo de errores; no para frontend, esquema completo, 2FA ni reglas de votación.
---

# Backend API

## Alcance y aislamiento

Implementar solo el endpoint, módulo o contrato solicitado. No extender una tarea pequeña a refactors generales. Al completarla, detenerse: no iniciar documentación extra, tests no pedidos, security review completa ni cambios generales de frontend o base de datos.

No diseñar PostgreSQL completo, migraciones salvo pedido mínimo explícito, React, IndexedDB, 2FA interno, reglas de votación, resultados o PDF/CSV. Solo `carnavales-orchestrator` selecciona skills: no enrutar, encadenar, cargar ni recomendar otras.

## Arquitectura

Usar Node.js + Express y TypeScript cuando ya esté configurado. Mantener:

```text
src/
├── config/
├── routes/
├── controllers/
├── services/
├── repositories/
├── middleware/
├── validators/
├── domain/
├── errors/
├── audit/
└── utils/
```

- **Routes:** composición HTTP, sin reglas complejas.
- **Controllers:** adaptación request/response; deben ser delgados.
- **Services/domain:** casos de uso, autorización contextual y lógica compartida.
- **Repositories:** acceso parametrizado a PostgreSQL; nunca SQL en controllers.
- **Validators/DTOs:** contratos de entrada y salida.
- **Middleware:** autenticación, autorización, request context y errores.

La API es autoridad funcional; PostgreSQL, autoridad final de integridad persistida. El frontend nunca es frontera de seguridad.

## Flujo de implementación

1. Revisar módulo, ruta y especificación existentes; usar nombres explícitos y consistentes, sin inventar alternativas a contratos definidos.
2. Definir request, response, errores y autorización contextual.
3. Centralizar parsing/validación de params, query y body; no confiar en tipos del cliente, normalizar cuando corresponda y rechazar campos inesperados si el contrato lo exige.
4. Delegar controller → service → repository, evitando duplicar lógica de dominio entre controllers.
5. Reconocer transacciones necesarias sin diseñar toda PostgreSQL: voto/penalización + auditoría, cierre, cambios administrativos o acta.
6. Mapear resultados y errores al contrato HTTP vigente.
7. Si cambian ruta, request, response, error o semántica, actualizar la especificación y evitar incompatibilidades silenciosas.

## Contrato HTTP

Éxito: `{"data": {}, "meta": {}}`

Error: `{"error": {"code": "VOTE_ALREADY_CONFIRMED", "message": "La puntuación ya fue confirmada.", "requestId": "..."}}`

Usar códigos estables, mensajes claros y `requestId`. Distinguir validación, autenticación requerida, autorización denegada, inexistencia, conflicto, regla de negocio, rate limit y error interno. Códigos disponibles:

`VALIDATION_ERROR`, `AUTH_REQUIRED`, `FORBIDDEN`, `RESOURCE_NOT_FOUND`, `JUROR_NOT_ASSIGNED`, `ASSIGNMENT_INACTIVE`, `NIGHT_CLOSED`, `COMPARSA_CLOSED`, `ITEM_NOT_SCORABLE`, `INVALID_SCORE`, `VOTE_ALREADY_CONFIRMED`, `IDEMPOTENCY_CONFLICT`, `RATE_LIMITED`, `INTERNAL_ERROR`.

Elegir status HTTP según la semántica documentada. Nunca exponer stack traces, SQL, secretos ni errores internos de PostgreSQL.

## Autenticación, autorización e idempotencia

- Obtener identidad/rol de sesión o token validado; no confiar en `userId`, `role`, permisos o headers arbitrarios enviados por el cliente.
- Autorizar en servidor por rol y contexto: identidad → rol → noche elegida existente → comparsa activa de esa noche → operación permitida.
- No definir aquí detalles internos de 2FA.
- Preservar el `operationId` recibido en endpoints críticos y entregarlo intacto al caso de uso. No reemplazarlo ni convertir un conflicto idempotente en éxito.

## Seguridad y operación

- Parametrizar consultas; validar y sanitizar cuando corresponda.
- Aplicar límites de payload, CORS configurado y HTTPS en producción.
- Asignar `requestId` a requests relevantes para correlación.
- No registrar passwords, OTP, JWT, cookies, `Authorization` ni secretos.
- Mantener compatibilidad con auditoría, idempotencia, sincronización offline, RBAC y errores de dominio, implementando solo lo imprescindible para el contrato HTTP solicitado.
