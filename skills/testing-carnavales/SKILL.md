---
name: testing-carnavales
description: Crear o revisar pruebas unitarias, integración, API, PostgreSQL, concurrencia, offline/PWA y E2E para los flujos críticos de Carnavales 2027. Usar para cobertura, regresiones y reproducción de bugs; no para redefinir producto o implementar features ajenas al test.
---

# Testing de Carnavales 2027

## Alcance y aislamiento

Probar comportamiento observable e invariantes, no detalles internos irrelevantes. No redefinir reglas, diseñar API, cambiar esquema sin necesidad, alterar UX salvo para hacerla testeable ni crear datos incompatibles. Solo `carnavales-orchestrator` selecciona skills: no enrutar, encadenar, cargar ni recomendar otras.

Ejecutar primero la prueba mínima; escalar a módulo, integración, E2E o suite completa solo si aporta evidencia necesaria. Al demostrar la condición solicitada, detenerse: no iniciar refactors, security review, documentación, features o pruebas ajenas.

## Principios y prioridad

- Cubrir adecuadamente toda función crítica; pérdida/duplicación/alteración de votos, autorización incorrecta e inmutabilidad tienen prioridad máxima.
- No inventar tests de reglas pendientes (p. ej., desempates o impugnaciones).
- Tests deterministas y reproducibles; esperar condiciones explícitas en vez de sleeps arbitrarios.
- Preparar/limpiar solo datos necesarios; no compartir estado mutable salvo requisito del framework.
- Areas: dominio, API, PostgreSQL, auth, autorización, votos, concurrencia, sync, PWA y auditoría.

Prioridad: **critical** pérdida/duplicado/alteración de voto, autorización, corrupción transaccional y cupo de jurados; **high** sync, OTP, cierres, penalizaciones y auditoría; **normal** componentes secundarios, filtros y presentación.

## Unitarias y dominio

Usar para cálculos, validaciones, reglas puras, transformaciones, estados y utilidades.

- Puntuaciones: aceptar `0`/`5`; rechazar `-1`/`6` y no enteros si el contrato exige enteros.
- Items: hoja puntuable; padre con hijos no puntuable directamente y calculado como suma de hijos.
- Totales: sumar notas, no descartar máximo/mínimo y aplicar penalizaciones según regla vigente.

## Integración, PostgreSQL y votos

Validar interacción real services/repositories/PostgreSQL: foreign keys, unique/check constraints, transacciones, rollback, inmutabilidad, auditoría e idempotencia.

Casos obligatorios de voto:

1. voto válido insertado;
2. jurado + comparsa + item no duplicable;
3. mismo `operationId` + payload idempotente;
4. mismo `operationId` + payload distinto conflictivo;
5. voto confirmado no actualizable;
6. voto confirmado no eliminable por flujo normal;
7. fallo transaccional sin estado parcial;
8. éxito con evidencia auditable cuando corresponda.

## Concurrencia y asignaciones

Usar concurrencia real del runtime/framework, no llamadas secuenciales disfrazadas. Probar requests simultáneos para mismo voto, mismo `operationId`, último cupo de jurados, reemplazo concurrente con voto y cierre de noche concurrente con operación entrante.

En selección de noche verificar noche inexistente/cerrada rechazada, comparsa de otra noche rechazada por contexto de backend y reemplazos auditados cuando se usen asignaciones.

## API, auth y RBAC

- API: status, body, códigos, validación, autenticación, autorización, inexistencia, conflictos e idempotencia; comprobar también efectos persistidos.
- Auth: OTP válido/inválido/expirado/usado, límite de intentos, rate limit, sesión válida/expirada y logout invalidante. Nunca versionar OTP, secretos o credenciales reales.
- RBAC: cubrir jurado, fiscal, escribano y admin, incluyendo contexto; p. ej. jurado correcto + noche incorrecta = rechazo. No limitarse a `role === ...`.

## Offline, PWA y E2E

Flujo offline prioritario: confirmar voto -> persistir local -> perder red -> conservar pendiente -> recargar -> recuperar -> reconectar -> reenviar -> confirmar API -> marcar sincronizado.

También: servidor procesa y pierde respuesta -> cliente reintenta mismo `operationId` -> no duplica -> sincroniza. Cubrir múltiples pendientes, dependencias/orden, sesión expirada, noche cerrada, conflicto idempotente y reconexiones repetidas.

E2E esenciales, sin mega-flujos si pruebas menores bastan:

- Jurado: login/OTP -> selector de noche -> comparsa -> puntuar/confirmar -> completar -> continuar -> terminar noche.
- Pérdida de red: votar -> desconectar -> continuar local -> recargar/recuperar -> reconectar/sincronizar.
- Fiscal: progreso, comparsa completa y resultados disponibles.
- Admin: entidades permitidas, asignaciones y restricciones.
- Escribano: consulta y acciones autorizadas sobre penalizaciones/actas.

## Frontend y auditoría

- Probar selector, modal, bloqueo post-confirmación, pendientes, cambio de comparsa, conexión/sync, recuperación y errores API.
- Consultar por role, label o texto visible; evitar clases CSS, DOM interno y nombres privados de componentes.
- Auditar voto, asignación/reemplazo, penalización, cierre, auth y generación/certificación de acta cuando corresponda. Verificar ausencia de OTP, tokens, passwords, cookies y `Authorization`.

## Datos y regresiones

Usar factories/builders solo si reducen duplicación, fixtures mínimos y nombres de escenario explícitos, p. ej. `rejects_vote_from_juror_assigned_to_another_night`.

Ante un bug: reproducirlo con un test cuando sea razonable -> demostrar fallo -> aplicar fix -> verificar éxito -> conservar regression test. No implementar funcionalidades completas innecesarias para probarlo ni ejecutar toda la suite si una prueba focalizada basta.
