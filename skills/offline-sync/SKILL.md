---
name: offline-sync
description: Implementar o revisar IndexedDB, cola local, reintentos, reconciliación, conflictos y estado de sincronización de la PWA del Jurado en Carnavales 2027. No usar para reglas completas de votación, API, PostgreSQL, autenticación ni diseño general de UI.
---

# Persistencia offline y sincronización

## Alcance y aislamiento

Usar solo para base/repositorio IndexedDB, cola, retry, reconciliación, recuperación tras reload, conflictos, estado de sincronización y pruebas de desconexión solicitadas. No implementar reglas completas de votación, SQL PostgreSQL, endpoints REST completos, OTP/auth, UI general del Jurado, resultados o PDF/CSV.

Solo `carnavales-orchestrator` selecciona skills: no enrutar, encadenar, cargar ni recomendar otras. Al resolver el alcance, detenerse; no iniciar refactors, tests extra, security review, cambios de backend/UX ni documentación adicional.

## Invariantes

- El sistema es online-first, pero la PWA del Jurado tolera cortes temporales.
- Persistir cada voto confirmado en IndexedDB **antes** de considerarlo seguro en UX. Nunca usar `localStorage` como cola crítica ni aplicar `POST → guardar local si funciona`.
- Cada operación usa un `operationId`/UUID estable generado en cliente; todo retry reutiliza el mismo. El backend reconoce repeticiones idempotentemente.
- Una request fallida no elimina la operación local. Una nota confirmada localmente queda bloqueada aunque aún no esté confirmada por servidor.
- Diferenciar confirmación local de confirmación remota. La hora del dispositivo no es autoridad reglamentaria.
- `navigator.onLine === true` no prueba que la API sea alcanzable; confirmar conectividad con respuestas reales.

Estados actuales del proyecto: `LOCAL`, `PENDING`, `SYNCING`, `SYNCED`, `CONFLICT`, `REJECTED`.

```ts
type PendingOperation = {
  operationId: string
  type: string
  payload: unknown
  createdAt: string
  status: 'LOCAL' | 'PENDING' | 'SYNCING' | 'SYNCED' | 'CONFLICT' | 'REJECTED'
  attempts: number
  lastError?: string
}
```

Adaptar el modelo si ya existe uno.

## Confirmación y respuestas

`confirmar → generar operationId → persistir en IndexedDB → bloquear edición → enviar → procesar respuesta`

| Resultado | Acción |
|---|---|
| API confirma | Marcar `SYNCED`. |
| Timeout/red/DNS/servidor temporal | Volver a `PENDING`, preservar y reintentar con backoff. |
| `NIGHT_CLOSED`, `COMPARSA_CLOSED`, `JUROR_NOT_ASSIGNED`, `ASSIGNMENT_INACTIVE`, `ITEM_NOT_SCORABLE` | Marcar `conflict`/`error`, preservar evidencia y no reintentar indefinidamente. |
| Mismo `operationId` + mismo payload ya procesado | Tratar como duplicate retry y marcar `synced`, incluso si la respuesta original se perdió. |
| Mismo `operationId` + payload distinto | Marcar `IDEMPOTENCY_CONFLICT`; preservar y nunca generar otro UUID para forzar el envío. |

## Reintentos, orden y recuperación

- Usar backoff simple y razonable, limitar concurrencia y evitar loops o ráfagas al reconectar.
- Respetar dependencias. Ejemplo: sincronizar/reconciliar votos requeridos antes de enviar el cierre de comparsa; no asumir orden libre.
- Al iniciar/reabrir: abrir IndexedDB → recuperar no finalizadas → obtener contexto del servidor si es alcanzable → reconciliar → procesar pendientes válidas → marcar conflictos → actualizar UI.
- No asumir que React conserva estado tras refresh.
- Cubrir refresh, cierre/suspensión/reapertura, pérdida durante confirmación, post-commit sin respuesta, varias pendientes/reconexiones, sesión expirada, jurado reemplazado, noche cerrada y reinicio del dispositivo.

## Persistencia, Service Worker y seguridad

- IndexedDB es la fuente local de verdad: versionar esquema, usar migraciones simples y operaciones transaccionales, agregar índices solo si hacen falta y recuperar registros incompletos.
- No limpiar toda IndexedDB en deploy, actualización de PWA o logout si hay operaciones críticas pendientes. En logout, preservarlas y aplicar la política documentada.
- El Service Worker puede cachear shell/assets y colaborar con retries soportados; no debe cachear indiscriminadamente respuestas autenticadas, tratar POST como cache común, ser la única cola ni almacenar secretos.
- No persistir innecesariamente OTP, passwords, cookies, tokens sensibles o secretos; no duplicar cookies `HttpOnly` en IndexedDB.

## UX mínima

Mostrar `Conectado`, `Sin conexión`, `Sincronizando`, cantidad pendiente y error. No declarar `todo sincronizado` con pendientes ni bloquear toda la votación por un timeout cuando las reglas permitan continuar localmente. Comunicar `confirmado localmente != confirmado por servidor` sin reabrir la edición del voto.
