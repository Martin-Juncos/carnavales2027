-- Carnavales 2027 — PostgreSQL baseline v1
CREATE EXTENSION IF NOT EXISTS pgcrypto;

CREATE TABLE users (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    nombre VARCHAR(150) NOT NULL,
    dni VARCHAR(20) NOT NULL UNIQUE,
    email VARCHAR(254) NOT NULL UNIQUE,
    role VARCHAR(20) NOT NULL CHECK (role IN ('jurado','fiscal','escribano','admin')),
    activo BOOLEAN NOT NULL DEFAULT true,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE noches (
    id BIGSERIAL PRIMARY KEY,
    nombre VARCHAR(50) NOT NULL,
    fecha DATE NOT NULL UNIQUE,
    estado VARCHAR(20) NOT NULL DEFAULT 'draft' CHECK (estado IN ('draft','open','closed','certified')),
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE jurado_asignaciones (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    jurado_id UUID NOT NULL REFERENCES users(id),
    noche_id BIGINT NOT NULL REFERENCES noches(id),
    estado VARCHAR(20) NOT NULL DEFAULT 'active' CHECK (estado IN ('active','replaced','cancelled','completed')),
    reemplaza_asignacion_id UUID REFERENCES jurado_asignaciones(id),
    motivo TEXT,
    asignado_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    finalizado_at TIMESTAMPTZ,
    UNIQUE (jurado_id, noche_id, estado) DEFERRABLE INITIALLY IMMEDIATE
);
CREATE INDEX idx_asignaciones_noche_estado ON jurado_asignaciones(noche_id, estado);

CREATE OR REPLACE FUNCTION enforce_three_active_jurors()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF NEW.estado = 'active' THEN
    PERFORM pg_advisory_xact_lock(NEW.noche_id);
    IF (SELECT count(*) FROM jurado_asignaciones
        WHERE noche_id = NEW.noche_id AND estado = 'active' AND id <> NEW.id) >= 3 THEN
      RAISE EXCEPTION 'La noche % ya tiene 3 jurados activos', NEW.noche_id;
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_max_three_active_jurors
BEFORE INSERT OR UPDATE OF estado, noche_id ON jurado_asignaciones
FOR EACH ROW EXECUTE FUNCTION enforce_three_active_jurors();

CREATE TABLE comparsas (
    id BIGSERIAL PRIMARY KEY,
    nombre VARCHAR(150) NOT NULL,
    noche_id BIGINT NOT NULL REFERENCES noches(id),
    orden SMALLINT NOT NULL CHECK (orden > 0),
    activo BOOLEAN NOT NULL DEFAULT true,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    UNIQUE (noche_id, orden)
);

CREATE TABLE items (
    id BIGSERIAL PRIMARY KEY,
    nombre VARCHAR(200) NOT NULL,
    parent_item_id BIGINT REFERENCES items(id),
    orden SMALLINT NOT NULL CHECK (orden > 0),
    activo BOOLEAN NOT NULL DEFAULT true,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_items_parent ON items(parent_item_id, orden);

CREATE TABLE puntuaciones (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    operation_uuid UUID NOT NULL UNIQUE,
    jurado_id UUID NOT NULL REFERENCES users(id),
    comparsa_id BIGINT NOT NULL REFERENCES comparsas(id),
    item_id BIGINT NOT NULL REFERENCES items(id),
    valor SMALLINT NOT NULL CHECK (valor BETWEEN 0 AND 5),
    client_created_at TIMESTAMPTZ NOT NULL,
    server_received_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    UNIQUE (jurado_id, comparsa_id, item_id)
);
CREATE INDEX idx_puntuaciones_comparsa ON puntuaciones(comparsa_id, item_id);
CREATE INDEX idx_puntuaciones_jurado ON puntuaciones(jurado_id, comparsa_id);

CREATE TABLE cierres_comparsa (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    operation_uuid UUID NOT NULL UNIQUE,
    jurado_id UUID NOT NULL REFERENCES users(id),
    comparsa_id BIGINT NOT NULL REFERENCES comparsas(id),
    client_created_at TIMESTAMPTZ NOT NULL,
    server_received_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    UNIQUE (jurado_id, comparsa_id)
);

CREATE TABLE penalizaciones (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    comparsa_id BIGINT NOT NULL REFERENCES comparsas(id),
    puntos INTEGER NOT NULL CHECK (puntos > 0),
    motivo_codigo VARCHAR(50),
    motivo_descripcion TEXT NOT NULL,
    registrada_por UUID NOT NULL REFERENCES users(id),
    estado VARCHAR(20) NOT NULL DEFAULT 'active' CHECK (estado IN ('active','annulled')),
    anulada_por UUID REFERENCES users(id),
    anulada_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    CHECK ((estado = 'active' AND anulada_por IS NULL AND anulada_at IS NULL)
        OR (estado = 'annulled' AND anulada_por IS NOT NULL AND anulada_at IS NOT NULL))
);
CREATE INDEX idx_penalizaciones_comparsa ON penalizaciones(comparsa_id, estado);

CREATE TABLE actas (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    noche_id BIGINT NOT NULL REFERENCES noches(id),
    tipo VARCHAR(30) NOT NULL CHECK (tipo IN ('pdf','csv')),
    version INTEGER NOT NULL CHECK (version > 0),
    storage_key TEXT NOT NULL,
    sha256 CHAR(64) NOT NULL,
    byte_size BIGINT NOT NULL CHECK (byte_size >= 0),
    estado VARCHAR(20) NOT NULL DEFAULT 'generated' CHECK (estado IN ('generated','certified','superseded')),
    generada_por UUID NOT NULL REFERENCES users(id),
    generada_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    certificada_por UUID REFERENCES users(id),
    certificada_at TIMESTAMPTZ,
    UNIQUE (noche_id, tipo, version),
    UNIQUE (sha256)
);

CREATE TABLE audit_log (
    id BIGSERIAL PRIMARY KEY,
    actor_user_id UUID REFERENCES users(id),
    accion VARCHAR(100) NOT NULL,
    entidad VARCHAR(50) NOT NULL,
    entidad_id TEXT,
    request_id UUID,
    operation_uuid UUID,
    before_hash CHAR(64),
    after_hash CHAR(64),
    metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_audit_actor_time ON audit_log(actor_user_id, created_at);
CREATE INDEX idx_audit_entity ON audit_log(entidad, entidad_id, created_at);
CREATE INDEX idx_audit_operation ON audit_log(operation_uuid) WHERE operation_uuid IS NOT NULL;

CREATE TABLE eventos_fiscal (
    id BIGSERIAL PRIMARY KEY,
    tipo VARCHAR(50) NOT NULL,
    jurado_id UUID REFERENCES users(id),
    comparsa_id BIGINT REFERENCES comparsas(id),
    noche_id BIGINT REFERENCES noches(id),
    payload JSONB NOT NULL DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_eventos_fiscal_cursor ON eventos_fiscal(id, created_at);

-- Defensa adicional: votos y auditoría no se modifican ni eliminan.
CREATE OR REPLACE FUNCTION reject_mutation()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  RAISE EXCEPTION 'La tabla % es append-only', TG_TABLE_NAME;
END;
$$;

CREATE TRIGGER trg_puntuaciones_no_update_delete
BEFORE UPDATE OR DELETE ON puntuaciones
FOR EACH ROW EXECUTE FUNCTION reject_mutation();

CREATE TRIGGER trg_audit_no_update_delete
BEFORE UPDATE OR DELETE ON audit_log
FOR EACH ROW EXECUTE FUNCTION reject_mutation();

-- En producción, además usar un rol de runtime sin UPDATE/DELETE:
-- REVOKE UPDATE, DELETE ON puntuaciones FROM app_runtime;
-- REVOKE UPDATE, DELETE ON audit_log FROM app_runtime;
