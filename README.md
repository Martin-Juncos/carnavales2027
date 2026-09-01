# Carnavales 2027

Sistema web de votación digital para comparsas de carnaval, con API auditable, PWA online-first para jurados con idempotencia y persistencia PostgreSQL.

## Estructura

- `api/`: API Node.js/Express/TypeScript, PostgreSQL, OTP, auditoría, actas e idempotencia.
- `client/`: PWA React/TypeScript para Jurado, Fiscal, Escribano y Admin.
- `docs/`: documentación funcional, técnica, API, roles, conectividad y seguridad.
- `skills/`: instrucciones locales para agentes Codex del proyecto.

## Reglas vigentes clave

- Login operativo: `nombre + email + DNI`, seguido por OTP de 6 dígitos.
- El rol técnico de “juez” es `jurado`.
- El Admin gestiona usuarios, noches, comparsas y rubros/ítems; las comparsas se crean por noche y su orden depende de cada noche.
- Fiscal y Escribanía trabajan con paneles operativos por noche: supervisión, penalizaciones, resultados, actas e integridad.
- Los votos confirmados son inmutables, idempotentes y auditados.
- La PWA del jurado confirma votos online contra la API; si no hay conexión, no confirma y permite reintento manual. IndexedDB queda para cache de lectura/recuperación visual.

## Arranque local

```bash
cd api
npm install
npm run db:migrate
npm run seed:core-users
npm run dev
```

```bash
cd client
npm install
npm run dev
```

Ver detalles en:

- [Documentación funcional y técnica](docs/README.md)
- [Backend/API](api/README.md)
- [Cliente PWA](client/README.md)
