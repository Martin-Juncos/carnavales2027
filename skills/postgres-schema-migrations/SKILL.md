---
name: postgres-schema-migrations
description: Diseñar o revisar esquemas, constraints, índices, migraciones y transacciones PostgreSQL para Carnavales 2027. Usar en cambios de persistencia e integridad; no para API, frontend, autenticación ni decisiones de negocio.
---

# PostgreSQL: esquema y migraciones

## Alcance y aislamiento

Usar para crear/modificar tablas, constraints e índices; escribir o revisar migraciones; proteger inmutabilidad; resolver concurrencia, auditoría e idempotencia.

No implementar controllers, REST/HTTP, React, IndexedDB, UX o 2FA; tampoco decidir reglas de negocio. Solo `carnavales-orchestrator` selecciona skills: no invocar, seleccionar, encadenar ni recomendar otras skills.

## Flujo

1. Identificar la invariante concreta; si depende de una regla de dominio ausente, marcarla pendiente y detener esa decisión.
2. Revisar el esquema y datos relacionados. Antes de agregar una entidad, buscar equivalentes en `users`, `roles`, `nights`, `juror_assignments`, `comparsas`, `items`, `scores`/`puntuaciones`, `penalties`/`penalizaciones`, `acts`/`actas` y `audit_log`.
3. Elegir el mecanismo mínimo: tabla, columna, constraint, índice, trigger, transacción, lock o migración.
4. Implementar mediante una migración versionada, reproducible, revisable y compatible con el historial.
5. Verificar datos existentes, reversión razonable, concurrencia e integridad.
6. Agregar o proponer pruebas de integración específicas y detenerse.

## Invariantes de persistencia

- PostgreSQL es la autoridad final de integridad persistida. No modificar el esquema con SQL ad hoc embebido en la aplicación.
- Usar `TIMESTAMPTZ` para timestamps relevantes y `UUID` para operaciones idempotentes originadas en cliente cuando corresponda.
- Aplicar `PRIMARY KEY`, `FOREIGN KEY`, `UNIQUE`, `CHECK`, `NOT NULL` e índices cuando expresen invariantes o consultas reales; no indexar indiscriminadamente.
- Reforzar en base las reglas críticas aunque frontend o backend también las validen.
- Proteger votos confirmados contra `UPDATE` y `DELETE` con mecanismos apropiados de PostgreSQL.
- En operaciones críticas multirregistro, usar transacciones y considerar concurrencia real en votos, cierres y operaciones sensibles.
- No usar `SELECT count(*)` → comprobar cupo → `INSERT` sin protección. Preferir constraints, locks, aislamiento o diseño transaccional consistente.
- Evitar borrado físico de historial auditable cuando corresponda baja lógica, anulación o versionado. Modelar `audit_log` como append-only.
- Parametrizar consultas; nunca concatenar input del usuario en SQL.
- Persistir hashes de documentos oficiales de forma verificable.

## Casos críticos

- **Puntuaciones:** impedir duplicados por jurado + comparsa + ítem; el mismo `operationId` no duplica el voto; un voto confirmado no se edita ni elimina por el flujo normal.
- **Auditoría:** impedir actualización/eliminación normal y conservar actor, acción, entidad, `TIMESTAMPTZ` y metadata necesaria.
- **Actas:** conservar identificación, versión y hash (SHA-256 cuando corresponda); una versión nueva no sobrescribe la anterior.
