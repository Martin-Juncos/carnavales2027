# Carnavales 2027

Sistema web de votación digital para comparsas de carnaval, con API auditable, PWA offline-first para jurados y persistencia PostgreSQL.

## Estructura

- `api/`: API Node.js/Express/TypeScript, PostgreSQL, OTP, auditoría, actas y sincronización.
- `client/`: PWA React/TypeScript para Jurado, Fiscal, Escribano y Admin.
- `docs/`: documentación funcional, técnica, API, roles, offline y seguridad.
- `skills/`: instrucciones locales para agentes Codex del proyecto.

## Reglas vigentes clave

- Login operativo: `nombre + email + DNI`, seguido por OTP de 6 dígitos.
- El rol técnico de “juez” es `jurado`.
- El Admin gestiona usuarios, noches, comparsas y rubros/ítems; las comparsas se crean por noche y su orden depende de cada noche.
- Los votos confirmados son inmutables, idempotentes y auditados.
- La PWA del jurado persiste operaciones críticas en IndexedDB antes de sincronizar.

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
