# AGENTS.md — Client

Estas reglas complementan el `AGENTS.md` ubicado en la raíz.

Aplican a todo el código contenido en:

```text
client/
```

---

# 1. Responsabilidad

El cliente contiene las interfaces para:

* Jurado;
* Fiscal;
* Escribano;
* Administrador.

El flujo del jurado tiene requisitos adicionales de resiliencia debido al entorno del corsódromo.

---

# 2. Stack

Frontend previsto:

```text
React
PWA para Jurado
IndexedDB
Service Worker
REST API
```

Utilizar TypeScript si forma parte de la configuración actual.

Mantener componentes modulares y tipados.

---

# 3. Prioridades UX

La interfaz se utilizará durante un evento en vivo.

Priorizar:

* lectura inmediata;
* interacción táctil;
* baja tasa de errores;
* botones amplios;
* buen contraste;
* modo oscuro como experiencia principal del evento;
* estados visibles;
* confirmaciones explícitas en acciones irreversibles;
* tolerancia a conectividad deficiente.

No sacrificar claridad por densidad visual.

---

# 4. Estado de conexión

El estado de sincronización debe estar visible para el jurado.

Distinguir conceptualmente:

```text
Conectado
Sin conexión
Sincronizando
Pendientes de sincronización
Error de sincronización
```

No representar `navigator.onLine === true` como garantía de comunicación real con el servidor.

La sincronización efectiva debe basarse en respuestas reales de la API.

---

# 5. Persistencia local

Una puntuación confirmada por el jurado debe persistirse localmente antes de considerarla segura desde la experiencia del usuario.

Usar IndexedDB para operaciones críticas.

No utilizar `localStorage` como cola principal de votos.

Cada operación debe disponer de un identificador estable:

```text
operationId: UUID
```

Ejemplo conceptual:

```ts
type PendingVote = {
  operationId: string
  comparsaId: string
  itemId: string
  value: number
  createdAt: string
  status: 'LOCAL' | 'PENDING' | 'SYNCING' | 'SYNCED' | 'CONFLICT' | 'REJECTED'
}
```

El esquema final debe ajustarse a la especificación de sincronización del proyecto.

---

# 6. Orden correcto al confirmar una nota

Nunca implementar:

```text
usuario confirma
→ POST API
→ si funciona, guardar local
```

porque un corte entre ambos pasos puede perder la operación.

Preferir conceptualmente:

```text
usuario confirma
→ generar operationId
→ persistir operación local
→ actualizar UI
→ intentar sincronizar
```

La eliminación o marcado definitivo de la operación local ocurre únicamente cuando el servidor confirma que fue procesada.

---

# 7. Reintentos

Un reintento siempre debe reutilizar el mismo:

```text
operationId
```

No generar un UUID nuevo para cada intento de envío.

Eso convertiría un reintento en una operación diferente y podría provocar duplicados.

Aplicar una estrategia razonable de backoff.

Evitar loops agresivos cuando no existe conectividad.

---

# 8. Estado de voto

Diferenciar claramente entre:

```text
confirmado localmente
```

y:

```text
confirmado por servidor
```

Una puntuación puede permanecer bloqueada para edición desde el momento en que el jurado la confirma, aunque todavía esté pendiente de sincronización.

El jurado no debe poder cambiar la nota simplemente porque todavía no llegó al servidor.

---

# 9. Inmutabilidad en UI

Después de confirmar:

* deshabilitar edición;
* mostrar el valor seleccionado;
* mostrar estado de sincronización;
* impedir una segunda confirmación manual.

La inmutabilidad real también será garantizada por API y base de datos.

---

# 10. Selección de noche

Después del login, el jurado debe elegir una noche creada por Administración.

La UI puede guiar y deshabilitar acciones si la noche no está abierta, pero la validación real corresponde al backend.

---

# 11. Pantalla del Jurado

Debe mostrar de forma clara:

* noche;
* identidad del jurado;
* estado de conexión;
* estado de sincronización;
* comparsas;
* rubros;
* subrubros;
* puntuaciones;
* progreso.

Las acciones irreversibles deben utilizar confirmación anti-error.

---

# 12. Comparsas

La navegación entre comparsas debe respetar las reglas funcionales definidas.

Las comparsas se administran por noche. La UI Admin debe permitir crear, modificar, ordenar y borrar comparsas. El backend solo permite borrado físico cuando no hay historial asociado; si hay dependencias, debe bloquear la acción y la UI debe mostrar el error.

Cuando exista una restricción por puntuaciones pendientes, mostrar qué elementos faltan.

No utilizar un mensaje genérico si se puede identificar claramente:

```text
Faltan puntuar:
- Carroza
- Música
- Vestuario
```

---

# 13. Modal de confirmación

Antes de confirmar una puntuación, mostrar claramente:

* comparsa;
* rubro/subrubro;
* nota;
* advertencia de que no podrá modificarse.

Ejemplo conceptual:

```text
Comparsa: Ará Berá
Rubro: Carroza
Nota: 4

Una vez confirmada, esta puntuación no podrá modificarse.
```

La confirmación debe requerir una acción explícita.

---

# 14. Protección contra doble interacción

Deshabilitar temporalmente acciones durante operaciones críticas cuando corresponda.

Evitar:

* doble click;
* doble tap;
* múltiples requests simultáneos;
* navegación accidental durante confirmaciones.

No depender de esto para garantizar integridad: la API igualmente debe ser idempotente.

---

# 15. Restauración de sesión

Ante:

* refresh;
* cierre accidental;
* suspensión;
* reapertura de la PWA;

el jurado debe poder reconstruir el estado necesario desde:

```text
servidor + IndexedDB
```

No asumir que el estado de React permanece disponible.

---

# 16. Reconciliación

Al recuperar conectividad:

1. consultar estado válido del servidor;
2. procesar operaciones pendientes;
3. reconocer operaciones ya procesadas;
4. marcar operaciones sincronizadas;
5. mostrar conflictos reales;
6. preservar operaciones que requieran intervención.

Nunca borrar una operación local crítica únicamente porque una request falló.

---

# 17. Manejo de conflictos

Errores de conectividad y conflictos de negocio no son equivalentes.

Ejemplo:

```text
timeout
```

→ reintentar.

```text
NIGHT_CLOSED
```

→ no reintentar indefinidamente.

```text
IDEMPOTENCY_CONFLICT
```

→ preservar evidencia local y escalar a un estado de revisión.

La UI debe poder distinguir estos casos.

---

# 18. Fiscal

La vista del Fiscal es principalmente de supervisión.

Debe permitir visualizar:

* jurados;
* progreso;
* comparsas completadas;
* puntuaciones recibidas;
* resultados disponibles;
* penalizaciones cuando corresponda;
* eventos relevantes.

La actualización puede utilizar polling inicialmente si ese es el contrato vigente.

No asumir WebSockets si no fueron incorporados a la arquitectura.

---

# 19. Escribano

La UI debe concentrarse en:

* consulta;
* certificación;
* penalizaciones autorizadas;
* actas;
* verificación de integridad;
* trazabilidad.

Las acciones oficiales deben requerir confirmación explícita.

---

# 20. Administrador

Debe poder administrar las entidades permitidas por RBAC.

Las operaciones destructivas deben utilizar:

* confirmación;
* indicación del impacto;
* respuesta de API clara.

No permitir desde la UI acciones que contradigan historial ya registrado.

---

# 21. Estado global

No almacenar indiscriminadamente toda la aplicación en estado global.

Separar:

* estado remoto;
* estado de sesión;
* estado de UI;
* cola offline;
* datos derivados.

La cola de sincronización debe persistir en IndexedDB, no solamente en memoria.

---

# 22. API

Centralizar el acceso HTTP.

Evitar llamadas dispersas como:

```ts
fetch('/api/...')
```

dentro de múltiples componentes.

Preferir una capa:

```text
services/
api/
repositories/
```

según la estructura adoptada.

Centralizar:

* base URL;
* headers;
* credentials;
* parsing;
* errores;
* requestId cuando corresponda.

---

# 23. Seguridad frontend

Nunca incluir secretos en:

```text
VITE_*
REACT_APP_*
bundle JS
service worker
IndexedDB
localStorage
```

Todo valor entregado al navegador debe considerarse visible al usuario.

No utilizar permisos de UI como sustituto de autorización backend.

Ocultar un botón no protege un endpoint.

---

# 24. Sesiones

Seguir la estrategia definida por la API.

Si se utilizan cookies seguras, no duplicar innecesariamente tokens en almacenamiento JavaScript.

No persistir códigos 2FA.

Al cerrar sesión:

* limpiar datos de sesión;
* conservar o gestionar cuidadosamente operaciones pendientes según la política de sincronización;
* no eliminar votos pendientes silenciosamente.

---

# 25. Accesibilidad y tactilidad

Los controles de puntuación deben funcionar correctamente en:

* celulares;
* tablets;
* escritorio.

Priorizar áreas táctiles suficientemente grandes.

Cada control debe tener:

* label accesible;
* foco visible;
* navegación por teclado cuando sea aplicable;
* contraste adecuado;
* feedback perceptible.

No depender exclusivamente del color para representar estados.

---

# 26. Rendimiento

La pantalla de votación debe seguir siendo fluida aun con conectividad irregular.

Evitar:

* renders innecesarios;
* requests repetitivos;
* bundles excesivos;
* operaciones síncronas pesadas;
* lógica compleja dentro del render.

La integridad tiene prioridad sobre microoptimizaciones.

---

# 27. Service Worker

El Service Worker debe tener responsabilidades explícitas.

No cachear indiscriminadamente respuestas autenticadas.

Diferenciar entre:

* assets estáticos;
* shell de aplicación;
* requests API;
* operaciones de escritura.

No almacenar información sensible en caches compartidos sin una estrategia específica.

---

# 28. Testing

Priorizar:

### Componentes

* selector de nota;
* confirmaciones;
* estados bloqueados;
* progreso.

### Integración

* persistencia IndexedDB;
* recuperación;
* cola;
* reconciliación.

### E2E

Simular:

```text
jurado inicia
→ puntúa
→ pierde conexión
→ sigue votando
→ recarga
→ recupera estado
→ vuelve conexión
→ sincroniza
```

También probar:

```text
request llega al servidor
→ respuesta se pierde
→ cliente reintenta
→ API responde idempotentemente
→ UI queda sincronizada
```

---

# 29. Casos borde obligatorios

Considerar explícitamente:

* Wi-Fi se pierde durante confirmación;
* request timeout;
* servidor procesa pero cliente no recibe respuesta;
* refresh con operaciones pendientes;
* PWA cerrada con operaciones pendientes;
* mismo voto enviado dos veces;
* noche cerrada mientras existe cola local;
* sesión expirada;
* dispositivo con hora incorrecta.

Nunca utilizar la hora del dispositivo como autoridad reglamentaria.

---

# 30. Antes de completar una tarea

Comprobar:

* UX táctil;
* permisos;
* comportamiento offline;
* persistencia;
* reintentos;
* estados de error;
* idempotencia;
* accesibilidad;
* tests.

Si un cambio modifica el comportamiento esperado de la API o de sincronización, revisar también la documentación correspondiente.
