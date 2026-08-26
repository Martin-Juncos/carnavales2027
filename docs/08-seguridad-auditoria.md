# 08 — Estrategia de Seguridad y Auditoría

**Estado:** Base de desarrollo  
**Versión:** 1.0

## 1. Objetivos
Proteger identidad, autorización, integridad de votos, trazabilidad de acciones y autenticidad de documentos oficiales.

## 2. Autenticación
- Usuarios precreados por Administración.
- Segundo factor/código de **6 dígitos** para accesos/acciones definidas como sensibles.
- OTP de un solo uso, expiración corta (referencia inicial: 5 min) y almacenamiento hash, nunca texto plano.
- Máximo de intentos por OTP y bloqueo temporal.
- Respuestas de login que no faciliten enumeración de usuarios.

## 3. Sesiones
- Expiración absoluta e inactividad configurable.
- Revocación por desactivación de usuario.
- Cookies `HttpOnly`, `Secure`, `SameSite` preferidas.
- Protección CSRF si se usan cookies para autenticación.

## 4. Rate limiting
Aplicar como mínimo a:
- login;
- solicitud/verificación OTP;
- recuperación de acceso;
- endpoints de escritura sensibles.

Límites deben ser configurables y registrar abusos sin almacenar secretos.

## 5. Autorización
- RBAC del Documento 6 aplicado en middleware + servicio de dominio.
- El identificador del actor proviene de la sesión autenticada, nunca del payload del cliente.
- Verificación de pertenencia/asignación para cada voto.

## 6. Inmutabilidad de votos
- `INSERT` únicamente para el rol de aplicación.
- `REVOKE UPDATE, DELETE` sobre `puntuaciones`.
- Trigger defensivo opcional que rechace UPDATE/DELETE incluso ante errores de aplicación.
- Correcciones extraordinarias no reescriben el voto: crean eventos de impugnación/resolución auditados.

## 7. Audit log
Debe registrar al menos:
- autenticaciones relevantes;
- emisión y cierre de votos/comparsas;
- apertura/cierre de noche;
- altas/bajas/cambios de configuración;
- reemplazo de jurados;
- penalizaciones y anulaciones;
- generación/certificación de actas;
- decisiones sobre operaciones `review_required`.

Campos mínimos: actor, acción, entidad, ID, timestamp servidor, request ID, operation UUID, metadata segura.

El `audit_log` es append-only para el rol de aplicación.

## 8. Integridad documental
- PDF/CSV generados server-side.
- SHA-256 del archivo exacto emitido.
- Persistir hash, tamaño, timestamp, versión y actor.
- Verificación posterior mediante endpoint/función dedicada.
- Nueva emisión = nueva versión y nuevo hash; nunca reemplazar silenciosamente un acta certificada.

## 9. Secretos y datos
- Secretos solo en variables/secret manager.
- `.env` fuera del repositorio.
- TLS en tránsito.
- Backups cifrados cuando el proveedor lo permita.
- Logs sin OTP, contraseñas, cookies/tokens ni PII innecesaria.

## 10. Baseline de pruebas de seguridad
Antes de producción:
- autorización horizontal/vertical;
- replay e idempotencia;
- brute force OTP/login;
- SQL injection/XSS/CSRF según superficie;
- manipulación de IDs y payloads;
- intento de UPDATE/DELETE directo sobre votos;
- alteración/verificación de actas;
- sincronización después de cierre y conflictos.
