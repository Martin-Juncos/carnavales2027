---
name: carnavales-domain-rules
description: Consultar las reglas de negocio confirmadas de Carnavales 2027 para votación, jurados y noches, comparsas, ítems, cálculos, penalizaciones, cierres y estados del concurso. No usar para implementación técnica, infraestructura ni pruebas puras.
---

# Reglas de dominio confirmadas

## Uso

Aplicar solo al razonar sobre votación, jurados/noches, comparsas, ítems/subítems, cálculos, penalizaciones, cierres o estados del concurso.

No aplicar a migraciones PostgreSQL, endpoints REST, login/2FA, IndexedDB/offline, componentes React, testing puro ni generación PDF/CSV. No implementar API, SQL, UI o autenticación.

Solo el Skill Orchestrator selecciona skills. Esta skill no selecciona, enruta, invoca ni recomienda otras skills.

## Reglas

- El jurado elige una noche creada después de autenticarse y puede votar sus comparsas activas al ingresar; el servidor valida existencia de noche y pertenencia de comparsa.
- Las comparsas se administran por noche. El Admin puede crearlas, editarlas, ordenar su pasada y darlas de baja; si hay historial, la baja debe preservar votos, cierres, penalizaciones y auditoría.
- La escala válida es de 0 a 5.
- Un ítem padre con hijos no se puntúa directamente: vale la suma de sus subítems. Un ítem hoja sí se puntúa directamente.
- Una puntuación confirmada es inmutable; modificarla o eliminarla no forma parte del flujo normal.
- No se descartan notas máximas ni mínimas. El total de un ítem entre jurados es la suma directa de sus puntuaciones.
- Las penalizaciones restan puntos fijos del total de la comparsa. Fiscal y Escribano pueden intervenir según la documentación vigente.

## Reglas pendientes

No inventar criterios para empates, impugnaciones, votos fuera de término ni otros casos no confirmados. Si una tarea depende de una regla ausente, marcarla como pendiente y detener cualquier decisión basada en ella.
