# 07 — Especificación de Conectividad Online-first e Idempotencia

**Estado:** Base de desarrollo  
**Versión:** 1.1

## 1. Alcance
El flujo operativo del Jurado es **online-first**. Si no hay conexión, timeout o API disponible, el sistema no confirma votos ni cierres.

La prioridad actual es estabilidad durante el evento: menos polling, menos reintentos automáticos y menos estados intermedios.

## 2. Flujo de voto
1. El jurado selecciona una nota.
2. La UI solicita confirmación explícita.
3. El cliente genera `operationUuid`.
4. Envía `POST /jurado/votos`.
5. Solo si el servidor acepta o reconoce un replay idempotente equivalente, la nota queda bloqueada.

Si falla por red, timeout o servidor inaccesible, la nota no queda confirmada y el jurado puede reintentar manualmente.

## 3. Cierre de comparsa
El cierre usa el mismo criterio:

```text
confirmar cierre -> operationUuid -> POST /jurado/comparsas/:id/cerrar -> bloqueo si servidor acepta
```

La UI no habilita cierre sin conexión ni cuando faltan ítems confirmados.

## 4. Idempotencia
`operationUuid` es estable para la operación enviada. El servidor almacena su asociación con el resultado aceptado:

- mismo `operationUuid` + mismo payload → devuelve el resultado original;
- mismo `operationUuid` + payload distinto → `IDEMPOTENCY_CONFLICT`.

Esto protege doble click, replay accidental y respuestas perdidas.

## 5. IndexedDB
IndexedDB queda para:

- cache de sesión/contexto;
- recuperación visual tras reload;
- compatibilidad técnica con tablas históricas.

No es cola crítica activa para confirmar nuevos votos offline.

## 6. Sync legacy
`POST /jurado/sync/reconcile` permanece disponible por compatibilidad técnica y para no forzar una refactorización riesgosa.

El flujo principal del Jurado no usa reintentos automáticos, intervalos globales ni reconciliación por foco/online.

## 7. Indicadores de UI
Mostrar estados simples y accionables:

- `Con conexión`;
- `Sin conexión`;
- `Confirmando`;
- `Confirmado`;
- error concreto de la última acción.

Evitar mensajes agresivos o preventivos como “API no responde” si no afectan una acción concreta.

## 8. Casos borde
- Red caída antes de confirmar → no enviar, no bloquear, permitir reintento.
- Timeout durante confirmación → no asumir éxito; refrescar contexto cuando sea posible y permitir reintento.
- Servidor procesó pero la respuesta se perdió → el reintento idempotente debe devolver el recurso original.
- Noche/comparsa cerrada durante reintento → backend rechaza con código de negocio y la UI muestra causa.
