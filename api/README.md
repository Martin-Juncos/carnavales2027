# API de Carnavales 2027

Backend transaccional y auditable para el sistema de votación. Usa Node.js 20+, Express 5, TypeScript estricto y PostgreSQL 16, sin ORM.

## Requisitos

- Node.js 20 o superior.
- npm.
- PostgreSQL 16. Opcionalmente puede iniciarse con Docker Compose.
- Resend o un servidor SMTP para entregar OTP. En desarrollo puede usarse Mailpit, Gmail SMTP u `OTP_DEV_LOG=true` para imprimir el OTP en la terminal.

## Instalación

```bash
npm install
cp .env.example .env
```

En PowerShell:

```powershell
Copy-Item .env.example .env
```

Reemplazar `SESSION_SECRET`, `OTP_PEPPER` y configurar `RESEND_API_KEY` o las variables SMTP. Los valores `dev-*` son rechazados en producción.

## Correo OTP

La prioridad de entrega es:

1. `OTP_DEV_LOG=true` en desarrollo: escribe el código en `storage/dev-otp.txt` y consola, sin enviar correo real.
2. `RESEND_API_KEY`: envía por Resend.
3. SMTP: envía por el servidor configurado.

### Resend

Crear una API key en Resend y configurar:

```env
RESEND_API_KEY=re_xxxxxxxxx
MAIL_FROM=Carnavales 2027 <onboarding@resend.dev>
OTP_DEV_LOG=false
```

Para producción, verificar un dominio propio en Resend y usar un remitente de ese dominio. Si `RESEND_API_KEY` está configurada, la API usa Resend; si no, intenta SMTP.

### Gmail SMTP

Para enviar a bandejas reales sin dominio propio, crear una App Password de Gmail y configurar:

```env
OTP_DEV_LOG=false
RESEND_API_KEY=
SMTP_HOST=smtp.gmail.com
SMTP_PORT=465
SMTP_SECURE=true
SMTP_USER=prof.mcjuncos@gmail.com
SMTP_PASSWORD=app-password-local
MAIL_FROM=Carnavales 2027 <prof.mcjuncos@gmail.com>
```

No versionar `SMTP_PASSWORD`. Debe vivir solo en `.env` o en el secret manager del entorno.

## Base de datos

```bash
docker compose up -d postgres
npm run db:migrate
```

Las migraciones siembran automáticamente las comparsas base `Tropicala`, `Ita Vera`, `Arami`, `Aymara`, `Oh Bahia` y `Poramba` en cada noche existente y en cada noche nueva. El Administrador conserva el CRUD y puede modificar el orden por noche.

Para el correo OTP local, Mailpit expone SMTP en `127.0.0.1:1025` y su bandeja en `http://127.0.0.1:8025`:

```bash
docker compose up -d mailpit
```

Si Windows tiene una variable global `DATABASE_URL` de otro proyecto, quitála en la terminal antes de iniciar o migrar. La API valida el esquema efectivo antes de abrir el puerto:

```powershell
Remove-Item Env:DATABASE_URL -ErrorAction SilentlyContinue
```

```bash
unset DATABASE_URL
```

Rollback de la última migración:

```bash
npm run db:rollback
```

Las migraciones aplicadas quedan registradas en `schema_migrations` y se ejecutan bajo advisory lock.

## Administrador inicial

Definir `ADMIN_NAME`, `ADMIN_DNI` y `ADMIN_EMAIL` solo en el entorno local y ejecutar:

```bash
npm run seed:admin
```

El DNI actúa como credencial operativa y se persiste hasheado con Argon2. El script no imprime credenciales ni secretos.

## Usuarios core locales

Para dejar el entorno local con los usuarios operativos acordados:

```bash
npm run seed:core-users
```

Estado esperado:

- Martin Juncos — `admin` — `prof.mcjuncos@gmail.com` — DNI `25609038`.
- Modo Beta — `jurado` — `modo.beta.developer@gmail.com` — DNI `12345678`.

## Ejecución

```bash
npm run dev
```

- API: `http://127.0.0.1:3000/api/v1`
- Estado: `GET http://127.0.0.1:3000/health`
- OpenAPI JSON: `GET http://127.0.0.1:3000/openapi.json`
- Swagger UI: `http://127.0.0.1:3000/docs`

Producción:

```bash
npm run build
npm start
```

## Verificación local

```bash
npm run lint
npm run typecheck
npm run test:unit
```

`npm run build` queda reservado para preparación de release/despliegue. Durante tareas de limpieza del repositorio se respeta la regla local de no ejecutar build.

Las integraciones crean un esquema PostgreSQL temporal y requieren una URL explícita de test:

```bash
TEST_DATABASE_URL=postgresql://postgres:postgres@127.0.0.1:5433/carnavales2027_test npm run test:integration
```

`test:integration` falla de forma explícita si falta `TEST_DATABASE_URL` o si el nombre de la base no termina en `_test`.

PowerShell:

```powershell
$env:TEST_DATABASE_URL='postgresql://postgres:postgres@127.0.0.1:5433/carnavales2027_test'
npm run test:integration
```

Usar exclusivamente una base descartable de pruebas. El esquema temporal se elimina al finalizar.

Prueba integral con OTP real, API `3100`, cliente de producción `5174` y Chromium móvil:

```bash
docker compose up -d postgres mailpit
npm run test:system
```

El runner crea datos deterministas en un esquema temporal de `carnavales2027_test`, recupera los OTP desde Mailpit y elimina esquema, actas y procesos temporales aunque la prueba falle. Nunca acepta una base cuyo nombre no termine en `_test`.

## Decisiones operativas

- Sesiones opacas del lado servidor en cookie `HttpOnly`; no se expone JWT al navegador.
- OTP de seis dígitos, de un solo uso, con expiración e intentos limitados; nunca se devuelve por API. En desarrollo, `OTP_DEV_LOG=true` lo escribe en `storage/dev-otp.txt` y lo imprime en terminal para pruebas locales.
- CORS por allowlist y validación de `Origin` en escrituras con cookie.
- Votos y auditoría se escriben en la misma transacción.
- `operationUuid` identifica una operación lógica: mismo payload reproduce el resultado; payload distinto genera conflicto.
- Votos y auditoría son append-only mediante triggers. El rol de producción también debe carecer de permisos `UPDATE`/`DELETE` sobre esas tablas.
- Los documentos PDF/CSV se guardan mediante un adaptador de filesystem y se verifican con SHA-256. En despliegue distribuido debe reemplazarse por storage compartido compatible con el mismo contrato.
- No se automatizan desempates, impugnaciones ni aceptación tardía post-cierre porque siguen pendientes de definición.

La especificación de rutas está en [docs/05-especificacion-api.md](../docs/05-especificacion-api.md).
