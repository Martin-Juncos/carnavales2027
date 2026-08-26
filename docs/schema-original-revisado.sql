-- Carnavales 2027 — Esquema PostgreSQL
-- Nota: la autenticación de jurados ya existe; este esquema asume que
-- la tabla "jurados" puede vincularse a lo que ya tengas (ajustar FK si aplica).

CREATE EXTENSION IF NOT EXISTS "pgcrypto"; -- para gen_random_uuid() si se prefiere UUID

-- ==========================================
-- NOCHES
-- ==========================================
CREATE TABLE noches (
    id          SERIAL PRIMARY KEY,
    nombre      VARCHAR(50) NOT NULL,      -- "Noche 1", "Noche 2", "Noche 3"
    fecha       DATE NOT NULL,
    activa      BOOLEAN NOT NULL DEFAULT true,
    created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ==========================================
-- COMPARSAS
-- ==========================================
CREATE TABLE comparsas (
    id          SERIAL PRIMARY KEY,
    nombre      VARCHAR(150) NOT NULL,
    noche_id    INTEGER NOT NULL REFERENCES noches(id),
    orden       SMALLINT NOT NULL,          -- orden de la pestaña (1-6)
    created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
    UNIQUE (noche_id, orden)
);

-- ==========================================
-- JURADOS
-- (ajustar/enlazar con la tabla de autenticación existente)
-- ==========================================
CREATE TABLE jurados (
    id          SERIAL PRIMARY KEY,
    nombre      VARCHAR(150) NOT NULL,
    dni         VARCHAR(20) NOT NULL UNIQUE,
    email       VARCHAR(150) UNIQUE,
    activo      BOOLEAN NOT NULL DEFAULT true,
    created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ==========================================
-- FISCALES
-- (rol separado del jurado; el admin los crea)
-- ==========================================
CREATE TABLE fiscales (
    id          SERIAL PRIMARY KEY,
    nombre      VARCHAR(150) NOT NULL,
    dni         VARCHAR(20) NOT NULL UNIQUE,
    email       VARCHAR(150) UNIQUE,
    activo      BOOLEAN NOT NULL DEFAULT true,
    created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ==========================================
-- ESCRIBANOS
-- (rol separado del jurado/fiscal; el admin los crea)
-- ==========================================
CREATE TABLE escribanos (
    id          SERIAL PRIMARY KEY,
    nombre      VARCHAR(150) NOT NULL,
    dni         VARCHAR(20) NOT NULL UNIQUE,
    email       VARCHAR(150) UNIQUE,
    activo      BOOLEAN NOT NULL DEFAULT true,
    created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ==========================================
-- PENALIZACIONES
-- Restan puntos fijos al total de una comparsa (Documento 2, sección 4).
-- Cargadas por Escribano o Fiscal (nunca por Admin).
-- ==========================================
CREATE TABLE penalizaciones (
    id                  SERIAL PRIMARY KEY,
    comparsa_id         INTEGER NOT NULL REFERENCES comparsas(id),
    puntos              INTEGER NOT NULL CHECK (puntos > 0), -- cantidad a restar (siempre positiva; se resta en el cálculo)
    motivo              TEXT, -- ⚠️ [PENDIENTE] lista cerrada de motivos vs. texto libre (Documento 2, sección 4.3)
    cargado_por_rol     VARCHAR(20) NOT NULL CHECK (cargado_por_rol IN ('escribano', 'fiscal')),
    cargado_por_id      INTEGER NOT NULL, -- referencia a escribanos.id o fiscales.id según cargado_por_rol
    created_at          TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ==========================================
-- ACTAS
-- ⚠️ [PENDIENTE DE DEFINICIÓN] — estructura provisoria. Falta confirmar
-- contenido exacto, si se genera automáticamente al cerrar una noche, y
-- el mecanismo de firma/certificación del Escribano (Documento 2, sección 6).
-- ==========================================
CREATE TABLE actas (
    id              SERIAL PRIMARY KEY,
    noche_id        INTEGER NOT NULL REFERENCES noches(id),
    escribano_id    INTEGER REFERENCES escribanos(id), -- quién certifica; nullable hasta que se firme
    certificada     BOOLEAN NOT NULL DEFAULT false,
    certificada_at  TIMESTAMPTZ,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ==========================================
-- AUDIT LOG
-- ⚠️ [PENDIENTE DE DEFINICIÓN COMPLETA] — estructura mínima genérica;
-- el detalle de qué acciones se auditan y con qué granularidad se define
-- en el Documento 8 (Seguridad y Auditoría).
-- ==========================================
CREATE TABLE audit_log (
    id              SERIAL PRIMARY KEY,
    actor_rol       VARCHAR(20) NOT NULL, -- 'jurado' | 'fiscal' | 'escribano' | 'admin'
    actor_id        INTEGER NOT NULL,
    accion          VARCHAR(100) NOT NULL, -- ej. 'puntuar_item', 'cerrar_comparsa', 'crear_penalizacion'
    entidad         VARCHAR(50),           -- tabla afectada, ej. 'puntuaciones'
    entidad_id      INTEGER,
    detalle         JSONB,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_audit_log_actor ON audit_log (actor_rol, actor_id, created_at);

-- ==========================================
-- ITEMS (y sub-items vía parent_item_id)
-- Un item sin parent_item_id es un "item padre" (agrupador, sin nota propia).
-- Un item con parent_item_id es un sub-item puntuable (0-5).
-- ==========================================
CREATE TABLE items (
    id              SERIAL PRIMARY KEY,
    nombre          VARCHAR(200) NOT NULL,
    parent_item_id  INTEGER REFERENCES items(id),
    orden           SMALLINT NOT NULL,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Restricción a nivel de aplicación (no SQL puro): solo se puntúan
-- items donde parent_item_id IS NOT NULL, o items sin hijos (hoja).
-- Se valida en el backend antes del INSERT en puntuaciones.

-- ==========================================
-- PUNTUACIONES (INMUTABLE: solo INSERT, nunca UPDATE/DELETE)
-- ==========================================
CREATE TABLE puntuaciones (
    id              SERIAL PRIMARY KEY,
    uuid_cliente    UUID NOT NULL UNIQUE, -- generado en el dispositivo del jurado al confirmar la nota;
                                            -- permite reintentar el envío sin duplicar (ver Documento 7)
    jurado_id       INTEGER NOT NULL REFERENCES jurados(id),
    comparsa_id     INTEGER NOT NULL REFERENCES comparsas(id),
    item_id         INTEGER NOT NULL REFERENCES items(id),
    valor           SMALLINT NOT NULL CHECK (valor >= 0 AND valor <= 5),
    created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
    UNIQUE (jurado_id, comparsa_id, item_id)  -- un jurado puntúa cada item una sola vez por comparsa
);

-- Revocar UPDATE/DELETE a nivel de rol de aplicación si se quiere reforzar
-- la inmutabilidad más allá de la lógica de negocio (opcional, recomendado):
-- REVOKE UPDATE, DELETE ON puntuaciones FROM app_user;

-- ==========================================
-- EVENTOS PARA EL FISCAL (alimenta el polling)
-- ==========================================
CREATE TABLE eventos_fiscal (
    id              SERIAL PRIMARY KEY,
    jurado_id       INTEGER NOT NULL REFERENCES jurados(id),
    comparsa_id     INTEGER NOT NULL REFERENCES comparsas(id),
    noche_id        INTEGER NOT NULL REFERENCES noches(id),
    visto           BOOLEAN NOT NULL DEFAULT false,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_eventos_fiscal_visto ON eventos_fiscal (visto, created_at);

-- ==========================================
-- (Opcional) ASIGNACIÓN JURADO-NOCHE
-- Si un jurado no vota todas las noches, esta tabla controla a cuáles
-- noches está habilitado. Si todos los jurados votan las 3 noches,
-- esta tabla no es necesaria.
-- ==========================================
-- CREATE TABLE jurado_noche (
--     jurado_id   INTEGER NOT NULL REFERENCES jurados(id),
--     noche_id    INTEGER NOT NULL REFERENCES noches(id),
--     PRIMARY KEY (jurado_id, noche_id)
-- );
