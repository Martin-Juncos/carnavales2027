# 02 — Reglas de Negocio y Reglamento de Votación

**Proyecto:** Carnavales 2027  
**Estado:** Base de desarrollo con reglas pendientes explícitas  
**Versión:** 1.0

## 1. Reglas confirmadas
- 3 noches de concurso.
- 9 jurados totales, 3 asignados por noche.
- La escala de cada ítem puntuable es **0 a 5**.
- Un voto confirmado no se modifica ni elimina.
- Un ítem padre con hijos es calculado; un ítem hoja es puntuable.
- No se descartan nota máxima ni mínima con la información disponible actualmente.
- Las comparsas oficiales son Tropicala, Ita Vera, Arami, Aymara, Oh Bahia y Poramba; participan todas las noches y solo cambia su orden de pasada por noche.

## 2. Asignación de jurados
- Una noche admite como máximo 3 asignaciones activas de jurado.
- La asignación la realiza Administración.
- Un reemplazo no sobrescribe la asignación anterior: la cierra y crea una nueva, con motivo, actor y timestamp.
- Un jurado reemplazado conserva todos los votos ya emitidos.

## 3. Puntuación
Para cada jurado, comparsa e ítem hoja:

`0 <= valor <= 5`

Debe existir como máximo un voto aceptado para la combinación:

`(jurado, comparsa, item)`

Los reintentos con el mismo `operation_uuid` deben devolver el resultado original sin generar un voto adicional.

## 4. Cálculo
### 4.1 Ítem padre
`valor_item_padre = SUM(valor_hijos)`

### 4.2 Total por ítem entre jurados
`total_item = SUM(valor_item_de_cada_jurado)`

### 4.3 Total general de comparsa
`total_general = SUM(items_raiz)`

### 4.4 Penalizaciones
`total_final = total_general - SUM(penalizaciones_vigentes)`

Los cálculos oficiales se realizan en backend/base de datos, nunca confiando en un total enviado por el cliente.

## 5. Cierre de comparsa
Una comparsa puede cerrarse para un jurado cuando:
- todos los ítems hoja activos tienen una puntuación aceptada;
- la noche está abierta para ese jurado;
- el jurado mantiene una asignación válida.

El cierre es irreversible desde la interfaz normal y queda auditado.

## 6. Penalizaciones
Reglas mínimas para poder desarrollar:
- Se aplican a una comparsa y descuentan puntos fijos.
- Solo Fiscal o Escribano pueden registrarlas.
- Deben tener motivo obligatorio, puntos, autor y timestamp.
- No se borran físicamente. Una anulación crea un nuevo evento/estado auditado.

**Pendiente del reglamento oficial:** catálogo de motivos, límites de puntos y momento exacto de aplicación. Hasta resolverlo, el sistema debe permitir configuración administrativa del catálogo y no codificar motivos hardcodeados.

## 7. Actas
Regla técnica mínima:
- Se generan desde datos persistidos en servidor.
- Un acta contiene el snapshot del resultado al momento de emisión.
- Se calcula SHA-256 sobre el archivo final.
- Una certificación no modifica el archivo emitido; una nueva versión genera un nuevo acta/hash.

## 8. Escrutinio, empates e impugnaciones
No existe aún una regla formal suficiente para automatizarlos. Por lo tanto:
- **Escrutinio:** se implementa inicialmente como vista de revisión y cierre, no como motor de modificación de votos.
- **Empates:** el sistema detecta y marca empate; no inventa desempate.
- **Impugnaciones:** se registran como expediente/evento auditado asociado a la entidad afectada; no editan el voto original.

## 9. Votos fuera de término
Regla técnica inicial:
- El servidor decide si una operación es temporalmente válida.
- Un voto creado localmente antes del cierre pero sincronizado después requiere evidencia de timestamp local y debe quedar marcado para revisión si el servidor ya había cerrado la noche.
- Un voto creado después de que el cliente conoció el cierre debe rechazarse.

La política definitiva de aceptación de operaciones pendientes tras el cierre debe ser aprobada antes del evento.

## 10. Precedencia
Ante conflicto entre documentos:
1. Reglamento oficial aprobado.
2. Este Documento 2.
3. Documento 1.
4. Arquitectura/implementación.
