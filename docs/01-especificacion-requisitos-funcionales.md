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
- **Administrador:** configura el concurso, usuarios, noches, orden de comparsas, rubros y operación técnica. No puede editar votos confirmados.

## 3. Configuración del concurso
El Administrador puede:
- Crear/editar/borrar noches, bloqueando el borrado destructivo cuando exista evidencia asociada.
- Crear/editar/borrar comparsas por noche y definir su orden de presentación.
- Crear/editar/borrar ítems y subítems, incluyendo orden y jerarquía.
- Crear/editar/borrar usuarios.

### Regla de selección de noche
- El Jurado elige una noche creada al ingresar.
- El backend valida que la noche exista y que las comparsas pertenezcan a esa noche; el estado de noche es informativo para la operación, no un bloqueo de voto del jurado.
- No se requiere asignación administrativa de jurados para votar: el jurado autenticado elige la noche creada.

### Regla de comparsas
- Las comparsas son administradas por noche.
- El Administrador puede crear, modificar, ordenar y borrar comparsas.
- Usuarios, noches, comparsas e ítems se borran físicamente solo cuando no tienen historial asociado; si existen votos, cierres, penalizaciones, actas, sesiones, auditoría u otras dependencias, el backend bloquea el borrado para preservar evidencia.
- En el panel de Administración, las acciones sensibles de modificación, borrado, apertura/cierre y guardado de orden requieren confirmación explícita mediante modal.

## 4. Autenticación y sesión
- El acceso utiliza identidad previamente creada por Administración.
- El usuario inicia sesión con las credenciales definidas por la política de seguridad.
- Para operaciones sensibles se utiliza un segundo factor/código de 6 dígitos según Documento 8.
- La sesión debe poder recuperarse ante una reconexión sin perder el contexto visual cacheado.
- Un usuario desactivado no puede iniciar nuevas sesiones.

## 5. Flujo del Jurado
### 5.1 Inicio
Al autenticar:
1. El sistema identifica al jurado.
2. Muestra las noches creadas para que el jurado elija.
3. Recupera el contexto de la noche elegida: estado, comparsas, ítems y progreso.

### 5.2 Pantalla de votación
- Encabezado con noche, jurado, estado de conexión y progreso.
- Navegación por comparsas.
- Lista de ítems y subítems.
- Cada ítem hoja se puntúa de **0 a 5**.
- Un ítem padre con hijos no se puntúa directamente: se calcula como suma de sus hijos.

### 5.3 Confirmación de nota
1. El jurado selecciona una nota.
2. El sistema solicita confirmación explícita.
3. La operación se envía al servidor con `operationUuid` idempotente.
4. Al aceptarse en servidor, el voto queda **inmutable**.
5. Si hay red caída, timeout o API inaccesible, la nota no queda confirmada y el jurado puede reintentar manualmente.

### 5.4 Cierre de comparsa
- Solo puede cerrarse una comparsa cuando todos sus ítems puntuables tienen nota confirmada.
- El cierre es una operación explícita e idempotente.
- Después del cierre, el jurado no puede agregar nuevos votos a esa comparsa.
- El Fiscal recibe un evento de finalización.

### 5.5 Fin de la noche
- El botón **Terminar** se habilita cuando todas las comparsas de la noche seleccionada están cerradas en servidor.
- El cierre de sesión no elimina votos confirmados porque la fuente de verdad es el servidor.

## 6. Flujo del Fiscal
- Usa un panel operativo con selector de noche, indicadores en vivo, avance por comparsa y planilla consolidada.
- Recibe/consulta eventos de comparsa finalizada mediante polling o mecanismo equivalente.
- Visualiza planilla por jurado, planilla por noche y planilla general.
- Puede registrar penalizaciones conforme al Documento 2.
- No puede modificar votos.

## 7. Flujo del Escribano/Veedor
- Acceso operativo a resultados por noche, actas, penalizaciones y auditoría.
- Puede generar actas PDF/CSV, verificar su hash SHA-256 y certificar actas generadas.
- Puede anular penalizaciones activas con motivo obligatorio, dejando evidencia auditable.
- No puede modificar ni eliminar votos confirmados.
- Debe poder verificar hash, fecha de emisión y versión de un acta.

## 8. Flujo del Administrador
- CRUD de usuarios, noches, comparsas y rubros/ítems; el borrado se permite solo sin historial asociado y se bloquea cuando hay evidencia que preservar.
- Apertura y cierre administrativo de noches.
- Consulta de auditoría y estado operativo.
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
- Cierre de comparsa con conexión caída o timeout.
- Jurado desactivado con sesión abierta.
- Noche cerrada durante un reintento manual posterior a una falla de red.
- Intento de voto fuera de término.
- Empate técnico e impugnación: se registran y auditan, pero su resolución depende del reglamento oficial.

## 11. Fuera de alcance inicial
- Publicación pública de resultados en tiempo real.
- Votación anónima.
- Edición de votos confirmados.
- Resolución automática de impugnaciones sin regla formal aprobada.

## 12. Criterio de inicio de desarrollo
Se puede comenzar cuando estén versionados junto con este documento los Documentos 2–8. Las reglas marcadas como pendientes del reglamento no deben codificarse por inferencia: deben quedar parametrizadas o bloqueadas hasta su definición.
