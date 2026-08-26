---
name: frontend-pwa
description: Implementar o revisar pantallas, componentes y flujos React/PWA de Carnavales 2027, especialmente la experiencia táctil, accesible y resiliente del Jurado. No usar para SQL, backend, 2FA, idempotencia de servidor ni resultados oficiales.
---

# Frontend React/PWA

## Alcance y aislamiento

Resolver solo el componente, pantalla o flujo solicitado. No implementar SQL/migraciones, reglas completas de backend, 2FA, idempotencia del servidor, resultados, PDF/CSV ni permisos no documentados.

Solo `carnavales-orchestrator` selecciona skills: no enrutar, encadenar, cargar ni recomendar otras. Al completar el alcance, detenerse; no iniciar refactors globales, cambios de backend/base, security review, documentación ni tests no pedidos.

## Base de UI

- Usar React y PWA para el Jurado; TypeScript con tipos explícitos para DTOs, sync, roles, errores, entidades y props. Evitar `any` sin justificación.
- Diseñar responsive para celular, tablet y escritorio; priorizar modo oscuro nocturno, controles táctiles amplios, feedback inmediato y confirmación explícita de acciones irreversibles.
- Mostrar siempre conexión y sincronización al Jurado. No tratar `navigator.onLine` como prueba de acceso real a la API.
- El frontend no es autoridad de seguridad ni debe duplicar reglas críticas del backend.

Separar estado:

| Tipo | Contenido |
|---|---|
| remoto | datos de API |
| sesión | identidad, rol y contexto |
| UI | modales, tabs, selección y loading |
| local persistente | operaciones críticas en IndexedDB |

No concentrar toda la aplicación en un único estado global.

```text
src/
├── app/
├── components/
├── features/
├── pages/
├── hooks/
├── services/
├── api/
├── stores/
├── offline/
├── types/
└── utils/
```

Adaptar esta estructura si el repositorio ya usa otra consistente.

## Flujo del Jurado

Al iniciar: obtener identidad, asignación/noche activas, comparsas, ítems/subítems y estado previo; luego reconciliar pendientes locales. El Jurado no elige noche: mostrarla como contexto no editable y listar solo sus comparsas.

La pantalla principal muestra nombre, noche, comparsas, rubros/subrubros, notas, progreso, conexión, sincronización y cantidad pendiente.

## Puntuación y confirmación

- Escala vigente: `0..5`.
- Item padre con hijos: sin control editable; mostrar valor calculado cuando corresponda. Item hoja: puntuable.
- Antes de confirmar, mostrar comparsa, ítem/subítem, nota y advertencia de inmutabilidad; exigir una acción explícita. No confirmar al seleccionar un número si el flujo vigente requiere modal.
- Después: bloquear edición, persistir la operación local según la arquitectura offline, reflejar la nota y mostrar sync.
- Comunicar `confirmado localmente != confirmado por servidor` sin permitir reedición.

Estados visuales: `pendiente`, `sincronizando`, `sincronizado`, `error`, `conflicto`. Combinar texto, iconos e indicadores; nunca solo color. Mostrar `Conectado`, `Sin conexión`, `Sincronizando`, `X pendientes` o `Error de sincronización`; nunca indicar sincronizado con pendientes. Permitir continuar ante un corte si la persistencia local y reglas vigentes lo admiten.

## Navegación, cierre y recuperación

- Respetar reglas vigentes entre comparsas. Si faltan ítems, impedir la acción cuando corresponda y enumerarlos específicamente, no usar un mensaje genérico.
- Cerrar comparsa requiere confirmación explícita y revisión de ítems obligatorios, estado local y pendientes. `Completo en UI` no implica confirmado por servidor; respetar el contrato de sincronización.
- Prevenir doble click/tap, submit repetido, confirmaciones múltiples y navegación accidental; deshabilitar controles temporalmente cuando proceda. Esto no reemplaza idempotencia backend.
- Tras refresh, cierre, suspensión o reapertura, reconstruir desde servidor + IndexedDB + sesión; no depender de memoria React.

## PWA, API y errores

- IndexedDB persiste operaciones críticas. El Service Worker maneja shell/assets y caches explícitas; no cachea indiscriminadamente respuestas autenticadas, datos sensibles o POST críticos, ni es la única fuente de pendientes.
- Centralizar HTTP (base URL, headers, credentials, parsing, errores, `requestId`, respuestas tipadas); no dispersar `fetch` ni exponer detalles de transporte a componentes.
- Traducir códigos a mensajes claros: `NIGHT_CLOSED` -> noche cerrada; `VOTE_ALREADY_CONFIRMED` -> puntuación confirmada; `IDEMPOTENCY_CONFLICT` -> operación preservada para revisión. Nunca mostrar stack, SQL, internos o secretos.

## Roles, accesibilidad y calidad

- Las vistas pueden incluir Fiscal (monitoreo/progreso/resultados disponibles/eventos/penalizaciones), Escribano (consulta/certificación/penalizaciones/actas/integridad) y Admin (configuración/usuarios/comparsas/rubros/asignaciones/operación). Ocultar/deshabilitar mejora UX, no autoriza; no crear permisos.
- Incluir labels, foco visible, teclado cuando aplique, contraste, targets amplios, mensajes legibles, modales accesibles y focus trap. Evitar fondos brillantes, grises ilegibles e indicadores solo cromáticos.
- Mantener fluidez: evitar renders, requests y bundles innecesarios, keys inestables y lógica pesada en render; no sacrificar integridad o mantenibilidad por optimización prematura.
