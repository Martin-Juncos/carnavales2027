---
name: vote-integrity
description: Implementar o revisar el registro atómico, idempotente, inmutable y auditable de votos en Carnavales 2027. Usar para servicios, transacciones, constraints, concurrencia y reintentos de puntuaciones; no para rutas HTTP, UI, offline general ni resultados.
---

# Integridad de votos

## Alcance y aislamiento

Usar para crear/revisar el servicio de voto, su transacción, idempotencia, constraints, concurrencia, reintentos, inmutabilidad y vínculo con auditoría.

No definir rutas o códigos HTTP, React, IndexedDB, login/2FA, el esquema PostgreSQL completo, resultados generales, actas ni impugnaciones no documentadas. Solo `carnavales-orchestrator` selecciona skills: no enrutar, encadenar, cargar ni recomendar otras.

Al resolver el problema solicitado, detenerse. No iniciar refactors, tests extra, documentación, revisiones de seguridad ni cambios de API no pedidos.

## Invariantes

- Una puntuación confirmada es inmutable: el flujo normal no admite `UPDATE` ni `DELETE`. Errores, reclamos o excepciones preservan el voto original y agregan evidencia; no inventar procedimientos de impugnación.
- El backend es la autoridad funcional; el frontend nunca basta como frontera de seguridad. La hora del dispositivo no es autoridad reglamentaria.
- Un jurado puntúa una sola vez cada ítem puntuable de una comparsa.
- Cada operación del cliente usa un `operationId`/UUID estable; todos sus reintentos reutilizan ese identificador, que representa una única operación lógica.
- PostgreSQL refuerza invariantes críticas con constraints y mecanismos de integridad.
- Insertar voto y auditoría forma una transacción atómica: éxito deja evidencia; fallo revierte ambos.

## Validaciones previas

Antes de persistir, comprobar:

1. usuario autenticado;
2. rol `jurado`;
3. jurado activo;
4. asignación activa a una noche;
5. comparsa perteneciente a esa noche;
6. ítem existente;
7. ítem puntuable;
8. valor dentro de `0..5`;
9. ausencia de voto previo del jurado para esa comparsa + ítem;
10. noche y comparsa abiertas para votar;
11. `operationId` válido;
12. ausencia de conflicto idempotente.

## Flujo atómico

`confirmar → persistir localmente → enviar → autenticar → autorizar contexto → validar dominio → iniciar transacción → comprobar idempotencia → insertar voto → insertar auditoría → commit → confirmar`

## Idempotencia

| Caso | Condición | Resultado |
|---|---|---|
| `duplicate retry` | Mismo `operationId` y payload | Devolver consistentemente el resultado original sin otro voto, incluso si la respuesta previa se perdió. |
| `logical duplicate` | Mismo voto lógico con otro `operationId` | Rechazar: la puntuación ya está confirmada. |
| `idempotency conflict` | Mismo `operationId`, payload distinto | Rechazar y conservar evidencia diagnóstica/auditable. |

## Concurrencia y bordes

Resolver explícitamente doble click/tap, request duplicada, timeout post-commit, reintentos, dos requests concurrentes para el mismo voto, jurado reemplazado con sesión abierta, noche cerrada antes de recibir la operación, desconexión, reloj local incorrecto, sesión expirada y voto existente. Ningún caso debe duplicar, sobrescribir o dejar un voto confirmado sin auditoría.

Errores de dominio disponibles: `JUROR_NOT_ASSIGNED`, `ASSIGNMENT_INACTIVE`, `NIGHT_CLOSED`, `COMPARSA_CLOSED`, `ITEM_NOT_SCORABLE`, `INVALID_SCORE`, `VOTE_ALREADY_CONFIRMED`, `IDEMPOTENCY_CONFLICT`. No fijar aquí su transporte HTTP.
