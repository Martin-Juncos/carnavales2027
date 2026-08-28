# 07 — Especificación de Resiliencia Offline y Sincronización

**Estado:** Base de desarrollo  
**Versión:** 1.0

## 1. Alcance
El sistema es online con tolerancia a cortes temporales. La PWA del Jurado debe evitar pérdida de operaciones críticas durante una interrupción.

## 2. Cola local
Cada operación almacena:
- `operationUuid`;
- tipo (`vote`, `close_comparsa`);
- payload;
- `clientCreatedAt`;
- estado;
- cantidad de intentos;
- último error;
- `serverResourceId` cuando sincroniza.

Estados visibles actuales: `LOCAL`, `PENDING`, `SYNCING`, `SYNCED`, `CONFLICT`, `REJECTED`.

## 3. Flujo de voto
1. Validación local básica.
2. Confirmación del jurado.
3. Escritura transaccional en IndexedDB.
4. UI marca voto como confirmado localmente/pendiente.
5. Envío al servidor.
6. Confirmación server → `SYNCED`.

Nunca se elimina una operación pendiente por logout, refresh o cierre de pestaña.

## 4. Reintentos
- Reintento al recuperar conectividad, abrir app y volver a foreground.
- Backoff para errores temporales.
- No reintentar automáticamente errores 4xx de negocio salvo `429` o política explícita.

## 5. Orden
- Los votos de una comparsa pueden sincronizarse independientemente.
- `close_comparsa` solo se envía cuando todos los votos locales de esa comparsa están `SYNCED` o reconciliados.

## 6. Idempotencia
`operationUuid` es estable durante todos los reintentos. El servidor almacena su asociación con el resultado aceptado.

## 7. Reconciliación
Al iniciar/reconectar:
- consultar estado del servidor;
- comparar operaciones locales;
- marcar como `SYNCED` las ya existentes;
- tratar `APPLIED` y `ALREADY_APPLIED` como sincronización exitosa;
- detectar conflictos;
- nunca sobrescribir automáticamente un voto distinto.

## 8. Cierre de noche durante desconexión
Una operación pendiente se envía igualmente para que el servidor decida. Si su validez temporal no puede determinarse inequívocamente, queda en conflicto/revisión y se registra auditoría. No se pierde ni se incorpora silenciosamente.

## 9. Indicadores de UI
Siempre visible:
- Online / Sin conexión.
- Cantidad de operaciones pendientes.
- Estado de sincronización.
- Advertencia clara antes de terminar si quedan operaciones sin resolver.

## 10. Datos locales
- No guardar secretos de autenticación en texto plano.
- Minimizar PII en IndexedDB.
- Limpiar datos ya sincronizados según política de retención, conservando lo necesario para reconciliación durante la jornada.
