---
name: offline-sync
description: Mantener compatibilidad legacy de IndexedDB/reconcile y revisar cache local de la PWA del Jurado en Carnavales 2027. No usar para reglas completas de votación, API, PostgreSQL, autenticación ni diseño general de UI.
---

# Conectividad online-first y sync legacy

## Alcance y aislamiento

Usar solo para cache IndexedDB, compatibilidad de `sync/reconcile`, recuperación visual tras reload y pruebas de desconexión solicitadas. No implementar reglas completas de votación, SQL PostgreSQL, endpoints REST completos, OTP/auth, UI general del Jurado, resultados o PDF/CSV.

Solo `carnavales-orchestrator` selecciona skills: no enrutar, encadenar, cargar ni recomendar otras. Al resolver el alcance, detenerse.

## Invariantes actuales

- El sistema es online-first: sin conexión/API disponible, el Jurado no confirma votos ni cierres.
- Las escrituras críticas se envían directo a la API con `operationUuid` estable generado en cliente.
- La edición se bloquea solo cuando el servidor acepta o reconoce replay idempotente equivalente.
- Timeout/red/DNS no confirma localmente: mostrar error claro y permitir reintento manual.
- La hora del dispositivo no es autoridad reglamentaria.
- `navigator.onLine === true` no prueba que la API sea alcanzable; los errores se derivan de respuestas reales o fallas concretas.

Flujo principal:

```text
confirmar -> generar operationUuid -> POST API -> bloquear si servidor acepta -> refrescar contexto
```

## IndexedDB

IndexedDB queda para:

- cache de sesión/contexto;
- recuperación visual tras reload;
- compatibilidad técnica de tablas históricas.

No usar IndexedDB como cola crítica activa para confirmar nuevos votos offline.

## Reconcile legacy

`POST /jurado/sync/reconcile` puede permanecer disponible por compatibilidad técnica.

No activar runtime global, intervalos automáticos, retries por foco/online ni ráfagas de requests desde el flujo principal del Jurado.

## UX mínima

Mostrar estados accionables:

- `Con conexión`;
- `Sin conexión`;
- `Confirmando`;
- `Confirmado`;
- error concreto de la última acción.

Evitar “API no responde” preventivo o “Demasiadas solicitudes” causado por health polling/retries agresivos.
