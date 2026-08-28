# Documentación — Carnavales 2027

Esta carpeta es la fuente de verdad funcional y técnica del sistema.

## Documentos

1. `01-especificacion-requisitos-funcionales.md` — alcance funcional por rol.
2. `02-reglas-de-negocio-y-reglamento.md` — reglas confirmadas y pendientes.
3. `03-arquitectura-tecnica.md` — componentes, resiliencia y despliegue.
4. `04-modelo-de-datos-erd.md` — modelo lógico y restricciones.
5. `05-especificacion-api.md` — contratos HTTP vigentes.
6. `06-matriz-roles-permisos.md` — RBAC.
7. `07-especificacion-offline-sincronizacion.md` — IndexedDB, cola y reconciliación.
8. `08-seguridad-auditoria.md` — autenticación, sesiones, secretos y audit log.

## Decisiones vigentes

- Login: `nombre + email + DNI` y luego OTP de 6 dígitos.
- Entrega OTP: `OTP_DEV_LOG=true` solo para desarrollo local; con `OTP_DEV_LOG=false`, la API prioriza Resend si hay `RESEND_API_KEY` y luego SMTP.
- Comparsas: CRUD administrado por noche; el orden de pasada depende de cada noche y el borrado preserva historial cuando haya datos asociados.
- Votos confirmados: append-only, idempotentes y auditados.

Cuando cambie un contrato, una regla de negocio o un flujo crítico, actualizar el documento correspondiente en el mismo cambio.
