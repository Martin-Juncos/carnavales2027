# 01 — Especificación de Requisitos Funcionales

**Proyecto:** Carnavales 2027  
**Estado:** Base de desarrollo  
**Versión:** 1.0

## 1. Propósito
Define qué debe hacer el Sistema de Votación Digital de Carnavales 2027. Es la referencia funcional para frontend, backend y QA.

## 2. Roles
- **Jurado:** elige una noche creada después de autenticarse y registra puntuaciones de las comparsas activas de esa noche.
- **Fiscal:** supervisa el avance de votación, consulta planillas y registra penalizaciones autorizadas.
- **Escribano/Veedor:** supervisa la integridad del proceso, consulta información de auditoría, valida penalizaciones cuando corresponda y certifica actas.
- **Administrador:** configura el concurso, usuarios, noches, orden de comparsas, rubros, asignaciones y operación técnica. No puede editar votos confirmados.

## 3. Configuración del concurso
El Administrador puede:
- Crear/editar/borrar noches, bloqueando el borrado destructivo cuando exista evidencia asociada.
- Crear/editar/desactivar/borrar comparsas por noche y definir su orden de presentación.
- Crear/editar/desactivar ítems y subítems, incluyendo orden y jerarquía.
- Crear/editar/desactivar/borrar usuarios.
- Asignar/reemplazar jurados cuando el operativo lo requiera.
- Reemplazar un jurado antes o durante una noche dejando trazabilidad.

### Regla de selección de noche
- El Jurado elige una noche creada al ingresar.
- El backend valida que la noche exista y que las comparsas pertenezcan a esa noche; el estado de noche es informativo para la operación, no un bloqueo de voto del jurado.
- Las asignaciones/reemplazos de jurados se mantienen como herramienta operativa auditable, pero no bloquean la selección inicial de noche.

### Regla de comparsas
- Las comparsas son administradas por noche.
- El Administrador puede crear, modificar, ordenar, activar/desactivar y borrar comparsas.
- Si existen datos asociados, el borrado operativo se realiza como baja lógica para no destruir votos, cierres, penalizaciones ni auditoría.

## 4. Autenticación y sesión
- El acceso utiliza identidad previamente creada por Administración.
- El usuario inicia sesión con las credenciales definidas por la política de seguridad.
- Para operaciones sensibles se utiliza un segundo factor/código de 6 dígitos según Documento 8.
- La sesión debe poder recuperarse ante una reconexión sin perder el estado local pendiente.
- Un usuario desactivado no puede iniciar nuevas sesiones.

## 5. Flujo del Jurado
### 5.1 Inicio
Al autenticar:
1. El sistema identifica al jurado.
2. Muestra las noches creadas para que el jurado elija.
3. Recupera el contexto de la noche elegida: estado, comparsas, ítems y progreso.

### 5.2 Pantalla de votación
- Encabezado con noche, jurado, estado de conexión/sincronización y progreso.
- Navegación por comparsas.
- Lista de ítems y subítems.
- Cada ítem hoja se puntúa de **0 a 5**.
- Un ítem padre con hijos no se puntúa directamente: se calcula como suma de sus hijos.

### 5.3 Confirmación de nota
1. El jurado selecciona una nota.
2. El sistema solicita confirmación explícita.
3. La operación se persiste localmente con UUID antes de enviarse al servidor.
4. Al aceptarse en servidor, el voto queda **inmutable**.
5. La interfaz muestra claramente si el voto está sincronizado o pendiente.

### 5.4 Cierre de comparsa
- Solo puede cerrarse una comparsa cuando todos sus ítems puntuables tienen nota confirmada.
- El cierre es una operación explícita e idempotente.
- Después del cierre, el jurado no puede agregar nuevos votos a esa comparsa.
- El Fiscal recibe un evento de finalización.

### 5.5 Fin de la noche
- El botón **Terminar** se habilita cuando todas las comparsas de la noche seleccionada están cerradas y no existen operaciones locales pendientes críticas.
- El cierre de sesión no borra registros locales aún no sincronizados.

## 6. Flujo del Fiscal
- Consulta el avance por noche, jurado y comparsa.
- Recibe/consulta eventos de comparsa finalizada mediante polling o mecanismo equivalente.
- Visualiza planilla por jurado, planilla por noche y planilla general.
- Puede registrar penalizaciones conforme al Documento 2.
- No puede modificar votos.

## 7. Flujo del Escribano/Veedor
- Acceso de solo lectura a puntuaciones, cierres, penalizaciones y auditoría.
- Puede validar/certificar el cierre de actas.
- Puede registrar o validar penalizaciones si el reglamento lo habilita.
- No puede modificar ni eliminar votos confirmados.
- Debe poder verificar hash, fecha de emisión y versión de un acta.

## 8. Flujo del Administrador
- CRUD de usuarios, noches, comparsas y rubros/ítems, usando baja lógica cuando hay historial.
- Asignación/reemplazo de jurados por noche.
- Apertura y cierre administrativo de noches.
- Consulta de auditoría y estado de sincronización.
- Generación de reportes técnicos y operativos.
- No puede editar/eliminar puntuaciones confirmadas ni alterar actas certificadas.

## 9. Reportes y actas
El sistema debe producir:
- Planilla por jurado+noche.
- Planilla consolidada por noche.
- Planilla general del concurso.
- Acta oficial en PDF y exportación CSV de respaldo.
- Cada artefacto oficial debe incluir identificador, fecha/hora, hash SHA-256 y versión del formato.

## 10. Casos borde obligatorios
- Corte de red durante la confirmación.
- Reintento de la misma operación.
- Doble click/reenvío accidental.
- Cierre de comparsa con votos pendientes de sincronización.
- Reemplazo de jurado a último momento.
- Jurado desactivado con sesión abierta.
- Noche cerrada mientras un dispositivo está desconectado.
- Intento de voto fuera de término.
- Empate técnico e impugnación: se registran y auditan, pero su resolución depende del reglamento oficial.

## 11. Fuera de alcance inicial
- Publicación pública de resultados en tiempo real.
- Votación anónima.
- Edición de votos confirmados.
- Resolución automática de impugnaciones sin regla formal aprobada.

## 12. Criterio de inicio de desarrollo
Se puede comenzar cuando estén versionados junto con este documento los Documentos 2–8. Las reglas marcadas como pendientes del reglamento no deben codificarse por inferencia: deben quedar parametrizadas o bloqueadas hasta su definición.
