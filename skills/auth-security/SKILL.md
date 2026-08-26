---
name: auth-security
description: Implementar o revisar autenticación, OTP/2FA de 6 dígitos, sesiones, logout, expiración, rate limiting y seguridad de acceso en Carnavales 2027. No usar para RBAC completo, votación, frontend ni rediseños generales de identidad.
---

# Autenticación y seguridad

## Alcance y aislamiento

Usar solo para generación/verificación OTP, sesiones, logout, expiración, rate limiting, brute force, cookies/tokens, enumeración y seguridad del login solicitados. No implementar toda la API, RBAC completo, votación, IndexedDB, frontend, migraciones generales, resultados o actas.

Solo `carnavales-orchestrator` selecciona skills: no enrutar, encadenar, cargar ni recomendar otras. Al resolver el alcance, detenerse; no iniciar pentesting, refactors, cambios generales de base/frontend, documentación ni revisión integral de seguridad.

## Fronteras

- **Autenticación:** determina quién es el usuario.
- **Autorización:** determina qué puede hacer. Aquí solo integrar lo imprescindible; no absorber RBAC.
- Backend valida identidad y autoriza. No confiar en UI ni en `userId`, `role`, permisos o headers arbitrarios del cliente; derivar rol e identidad de la sesión/token validado.

## Flujo

`credenciales/identificador → validar identidad → crear desafío OTP → entregar por canal configurado → verificar existencia/expiración/intentos/consumo → consumir OTP → crear sesión → devolver contexto autenticado`

No asumir proveedor de email/SMS. No inventar flujo de password si continúa email/DNI + OTP.

## OTP

- Generar exactamente 6 dígitos con una fuente criptográficamente segura de Node.js; nunca `Math.random()`.
- Debe expirar, ser de un solo uso, limitar intentos, invalidarse tras éxito y resistir replay.
- Si persiste, guardar representación segura, nunca texto plano. Modelo conceptual: `userId`, `codeHash`, `expiresAt`, `attempts`, `consumedAt`, `createdAt`; respetar nombres existentes.
- Usar tiempo del servidor. Obtener expiración e intentos máximos de configuración/documentación; si faltan, configurarlos explícitamente y marcar la decisión pendiente, sin inventar valores permanentes.
- Al exceder intentos, invalidar/bloquear el desafío y exigir uno nuevo según la política vigente.
- Nunca loguear ni devolver el OTP. Evitar mensajes que permitan enumerar usuarios.

## Sesiones y credenciales

- Vincular cada sesión a una identidad real; implementar expiración, invalidación y logout en backend. Cerrar la UI no equivale a logout.
- Respetar la arquitectura vigente; no decidir JWT versus sesión de servidor si sigue pendiente.
- Con cookies: `HttpOnly`, `Secure` en producción, `SameSite` apropiado, expiración controlada, rotación cuando corresponda y evaluación CSRF para escrituras autenticadas.
- Con tokens: expiración, validación estricta, almacenamiento seguro y revocación/rotación según necesidad.
- No guardar tokens sensibles innecesariamente en `localStorage`, IndexedDB, logs o query strings. Una sesión expirada no revive al reproducir requests.
- Si hay passwords, usar hashing específico para contraseñas; nunca texto plano, SHA-256 directo ni cifrado reversible. No registrar passwords ni hashes.

## Rate limiting y contexto del evento

Aplicar a login, solicitud/verificación OTP, recuperación y endpoints sensibles. Combinar IP, identidad disponible, endpoint y ventana temporal; no depender solo de IP. Muchos usuarios comparten Wi-Fi/NAT y la conectividad puede ser intermitente: evitar bloquear todo el corsódromo o impedir una reautenticación legítima, sin debilitar protección contra brute force.

## Controles operativos

- Secretos fuera del código mediante variables de entorno o el mecanismo vigente.
- No registrar OTP, passwords/hashes, cookies, tokens/JWT, `Authorization` ni secretos.
- Configurar CORS con orígenes explícitos; nunca `Access-Control-Allow-Origin: *` con credenciales en producción.
- Aplicar headers HTTP seguros cuando corresponda, sin tratarlos como sustituto de autenticación/autorización.
- Auditar sin secretos: login exitoso/fallido, OTP solicitado/inválido/expirado, rate limit, logout, bloqueo temporal y cambios relevantes.

Errores disponibles: `AUTH_REQUIRED`, `INVALID_CREDENTIALS`, `INVALID_OTP`, `OTP_EXPIRED`, `OTP_ALREADY_USED`, `OTP_ATTEMPTS_EXCEEDED`, `RATE_LIMITED`, `SESSION_EXPIRED`. Respetar el contrato API vigente; no fijar aquí códigos HTTP.
