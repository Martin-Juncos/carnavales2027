# 01 — Especificación de Requisitos Funcionales

**Proyecto:** Carnavales 2027  
**Estado:** Base de desarrollo  
**Versión:** 1.0

## 1. Propósito
Define qué debe hacer el Sistema de Votación Digital de Carnavales 2027. Es la referencia funcional para frontend, backend y QA.

## 2. Roles
- **Jurado:** registra y confirma puntuaciones de las comparsas correspondientes a su noche asignada.
- **Fiscal:** supervisa el avance de votación, consulta planillas y registra penalizaciones autorizadas.
- **Escribano/Veedor:** supervisa la integridad del proceso, consulta información de auditoría, valida penalizaciones cuando corresponda y certifica actas.
- **Administrador:** configura el concurso, usuarios, noches, comparsas, rubros, asignaciones y operación técnica. No puede editar votos confirmados.

## 3. Configuración del concurso
El Administrador puede:
- Crear/editar/desactivar noches.
- Definir el orden de presentación por noche de las comparsas oficiales precreadas.
- Crear/editar/desactivar ítems y subítems, incluyendo orden y jerarquía.
- Crear/desactivar usuarios.
- Asignar jurados a noches.
- Reemplazar un jurado antes o durante una noche dejando trazabilidad.

### Regla de asignación
- Existen **9 jurados**, con **3 jurados asignados por noche**.
- Un jurado **no elige libremente la noche**: el backend determina su asignación activa.
- El sistema debe impedir una cuarta asignación activa a la misma noche.

### Regla de comparsas oficiales
- Las comparsas oficiales son: **Tropicala**, **Ita Vera**, **Arami**, **Aymara**, **Oh Bahia** y **Poramba**.
- Todas pasan en todas las noches.
- El Administrador no crea, renombra ni desactiva comparsas oficiales durante la operación normal; solo modifica el orden de pasada de cada noche.

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
2. Recupera su noche asignada y el estado de la votación.
3. Muestra las comparsas habilitadas y el progreso existente.

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
- El botón **Terminar** se habilita cuando todas las comparsas asignadas están cerradas y no existen operaciones locales pendientes críticas.
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
- CRUD lógico de configuración y usuarios.
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
