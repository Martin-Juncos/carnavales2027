# 06 — Matriz de Roles y Permisos (RBAC)

**Estado:** Base de desarrollo  
**Versión:** 1.0

| Acción | Jurado | Fiscal | Escribano | Admin |
|---|---:|---:|---:|---:|
| Ver propia asignación/progreso | Sí | No | No | Sí |
| Emitir voto | Sí, propio | No | No | No |
| Editar/eliminar voto | No | No | No | No |
| Cerrar comparsa propia | Sí | No | No | No |
| Ver puntuaciones consolidadas | Solo propias necesarias | Sí | Sí | Sí |
| Ver auditoría | No | Limitada | Sí | Sí |
| Registrar penalización | No | Sí | Sí | No |
| Anular penalización | No | Según política | Según política | No |
| Generar reportes | No | Sí | Sí | Sí |
| Generar acta | No | Sí/según flujo | Sí | Sí técnico |
| Certificar acta | No | No | Sí | No |
| Gestionar usuarios | No | No | No | Sí |
| Gestionar noches/comparsas/items | No | No | No | Sí |
| Asignar/reemplazar jurados | No | No | No | Sí |
| Abrir/cerrar noche | No | No | No | Sí |

## Reglas
- Denegar por defecto todo permiso no declarado.
- La autorización se verifica en backend, nunca solo en UI.
- El Admin posee capacidades operativas, pero no privilegio para alterar evidencia electoral.
- Toda acción sensible registra actor, recurso, timestamp y request/operation ID.
- Los permisos de anulación de penalizaciones deben cerrarse con el reglamento; hasta entonces se restringen a un flujo explícito y auditado.
