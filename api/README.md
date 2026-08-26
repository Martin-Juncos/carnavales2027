# API de Carnavales 2027

Backend transaccional y auditable para el sistema de votación. Usa Node.js 20+, Express 5, TypeScript estricto y PostgreSQL 16, sin ORM.

## Requisitos

- Node.js 20 o superior.
- npm.
- PostgreSQL 16. Opcionalmente puede iniciarse con Docker Compose.
- Un servidor SMTP para entregar OTP. En desarrollo puede usarse Mailpit u otro servidor local.

## Instalación

```bash
npm install
cp .env.example .env
```

En PowerShell:

```powershell
Copy-Item .env.example .env
```

Reemplazar `SESSION_SECRET`, `OTP_PEPPER` y las variables SMTP. Los valores `dev-*` son rechazados en producción.

## Base de datos

```bash
docker compose up -d postgres
npm run db:migrate
```

Rollback de la última migración:

```bash
npm run db:rollback
```

Las migraciones aplicadas quedan registradas en `schema_migrations` y se ejecutan bajo advisory lock.

## Administrador inicial

Definir `ADMIN_NAME`, `ADMIN_DNI`, `ADMIN_EMAIL` y `ADMIN_PASSWORD` solo en el entorno local y ejecutar:

```bash
npm run seed:admin
```

El password se persiste con Argon2. El script no imprime credenciales ni secretos.

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

## Verificación

```bash
npm run lint
npm run typecheck
npm run test:unit
npm run build
```

Las integraciones crean un esquema PostgreSQL temporal y solo se habilitan si existe una URL explícita de test:

```bash
TEST_DATABASE_URL=postgresql://postgres:postgres@localhost:5432/carnavales2027_test npm run test:integration
```

PowerShell:

```powershell
$env:TEST_DATABASE_URL='postgresql://postgres:postgres@localhost:5432/carnavales2027_test'
npm run test:integration
```

Usar exclusivamente una base descartable de pruebas. El esquema temporal se elimina al finalizar.

## Decisiones operativas

- Sesiones opacas del lado servidor en cookie `HttpOnly`; no se expone JWT al navegador.
- OTP de seis dígitos, de un solo uso, con expiración e intentos limitados; nunca se devuelve ni registra.
- CORS por allowlist y validación de `Origin` en escrituras con cookie.
- Votos y auditoría se escriben en la misma transacción.
- `operationUuid` identifica una operación lógica: mismo payload reproduce el resultado; payload distinto genera conflicto.
- Votos y auditoría son append-only mediante triggers. El rol de producción también debe carecer de permisos `UPDATE`/`DELETE` sobre esas tablas.
- Los documentos PDF/CSV se guardan mediante un adaptador de filesystem y se verifican con SHA-256. En despliegue distribuido debe reemplazarse por storage compartido compatible con el mismo contrato.
- No se automatizan desempates, impugnaciones ni aceptación tardía post-cierre porque siguen pendientes de definición.

La especificación de rutas está en [docs/05-especificacion-api.md](../docs/05-especificacion-api.md).
