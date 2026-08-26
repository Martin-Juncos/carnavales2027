CREATE EXTENSION IF NOT EXISTS pgcrypto;

CREATE OR REPLACE FUNCTION set_updated_at()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

CREATE TABLE users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  nombre VARCHAR(150) NOT NULL,
  dni VARCHAR(20) NOT NULL UNIQUE,
  email VARCHAR(254) NOT NULL UNIQUE,
  password_hash TEXT NOT NULL,
  role VARCHAR(20) NOT NULL CHECK (role IN ('jurado', 'fiscal', 'escribano', 'admin')),
  activo BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE TRIGGER trg_users_updated_at BEFORE UPDATE ON users
FOR EACH ROW EXECUTE FUNCTION set_updated_at();

CREATE OR REPLACE FUNCTION enforce_nine_active_jurors()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF NEW.role = 'jurado' AND NEW.activo THEN
    PERFORM pg_advisory_xact_lock(20270009);
    IF (
      SELECT count(*)
      FROM users
      WHERE role = 'jurado'
        AND activo
        AND id <> NEW.id
    ) >= 9 THEN
      RAISE EXCEPTION USING
        ERRCODE = 'P0001',
        MESSAGE = 'JUROR_TOTAL_CAPACITY_EXCEEDED';
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_max_nine_active_jurors
BEFORE INSERT OR UPDATE OF role, activo ON users
FOR EACH ROW EXECUTE FUNCTION enforce_nine_active_jurors();

CREATE TABLE noches (
  id BIGSERIAL PRIMARY KEY,
  nombre VARCHAR(50) NOT NULL,
  fecha DATE NOT NULL UNIQUE,
  estado VARCHAR(20) NOT NULL DEFAULT 'draft' CHECK (estado IN ('draft', 'open', 'closed', 'certified')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE TRIGGER trg_noches_updated_at BEFORE UPDATE ON noches
FOR EACH ROW EXECUTE FUNCTION set_updated_at();

CREATE TABLE jurado_asignaciones (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  jurado_id UUID NOT NULL REFERENCES users(id),
  noche_id BIGINT NOT NULL REFERENCES noches(id),
  estado VARCHAR(20) NOT NULL DEFAULT 'active' CHECK (estado IN ('active', 'replaced', 'cancelled', 'completed')),
  reemplaza_asignacion_id UUID REFERENCES jurado_asignaciones(id),
  motivo TEXT,
  asignado_por UUID NOT NULL REFERENCES users(id),
  finalizado_por UUID REFERENCES users(id),
  asignado_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  finalizado_at TIMESTAMPTZ,
  CHECK (
    (estado = 'active' AND finalizado_at IS NULL AND finalizado_por IS NULL)
    OR (estado <> 'active' AND finalizado_at IS NOT NULL AND finalizado_por IS NOT NULL)
  )
);
CREATE UNIQUE INDEX uq_jurado_asignacion_activa
  ON jurado_asignaciones(jurado_id) WHERE estado = 'active';
CREATE INDEX idx_asignaciones_noche_estado ON jurado_asignaciones(noche_id, estado);

CREATE OR REPLACE FUNCTION enforce_three_active_jurors()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF NEW.estado = 'active' THEN
    PERFORM pg_advisory_xact_lock(NEW.noche_id);
    IF (
      SELECT count(*)
      FROM jurado_asignaciones
      WHERE noche_id = NEW.noche_id
        AND estado = 'active'
        AND id <> NEW.id
    ) >= 3 THEN
      RAISE EXCEPTION USING
        ERRCODE = 'P0001',
        MESSAGE = 'JUDGE_CAPACITY_EXCEEDED';
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
CREATE TRIGGER trg_comparsas_updated_at BEFORE UPDATE ON comparsas
FOR EACH ROW EXECUTE FUNCTION set_updated_at();

CREATE TABLE items (
  id BIGSERIAL PRIMARY KEY,
  nombre VARCHAR(200) NOT NULL,
  parent_item_id BIGINT REFERENCES items(id),
  orden SMALLINT NOT NULL CHECK (orden > 0),
  activo BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CHECK (parent_item_id IS NULL OR parent_item_id <> id)
);
CREATE INDEX idx_items_parent ON items(parent_item_id, orden);
CREATE TRIGGER trg_items_updated_at BEFORE UPDATE ON items
FOR EACH ROW EXECUTE FUNCTION set_updated_at();

CREATE TABLE otp_challenges (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id),
  code_hash CHAR(64) NOT NULL,
  expires_at TIMESTAMPTZ NOT NULL,
  attempts SMALLINT NOT NULL DEFAULT 0 CHECK (attempts >= 0),
  max_attempts SMALLINT NOT NULL CHECK (max_attempts > 0),
  consumed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_otp_user_created ON otp_challenges(user_id, created_at DESC);

CREATE TABLE sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id),
  token_hash CHAR(64) NOT NULL UNIQUE,
  expires_at TIMESTAMPTZ NOT NULL,
  last_seen_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  revoked_at TIMESTAMPTZ,
  ip INET,
  user_agent TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_sessions_user_active ON sessions(user_id, expires_at) WHERE revoked_at IS NULL;

CREATE TABLE puntuaciones (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  operation_uuid UUID NOT NULL UNIQUE,
  request_hash CHAR(64) NOT NULL,
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
  request_hash CHAR(64) NOT NULL,
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
  estado VARCHAR(20) NOT NULL DEFAULT 'active' CHECK (estado IN ('active', 'annulled')),
  anulada_por UUID REFERENCES users(id),
  anulada_at TIMESTAMPTZ,
  anulacion_motivo TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CHECK (
    (estado = 'active' AND anulada_por IS NULL AND anulada_at IS NULL AND anulacion_motivo IS NULL)
    OR (estado = 'annulled' AND anulada_por IS NOT NULL AND anulada_at IS NOT NULL AND anulacion_motivo IS NOT NULL)
  )
);
CREATE INDEX idx_penalizaciones_comparsa ON penalizaciones(comparsa_id, estado);

CREATE TABLE actas (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  noche_id BIGINT NOT NULL REFERENCES noches(id),
  tipo VARCHAR(30) NOT NULL CHECK (tipo IN ('pdf', 'csv')),
  version INTEGER NOT NULL CHECK (version > 0),
  storage_key TEXT NOT NULL,
  sha256 CHAR(64) NOT NULL,
  byte_size BIGINT NOT NULL CHECK (byte_size >= 0),
  estado VARCHAR(20) NOT NULL DEFAULT 'generated' CHECK (estado IN ('generated', 'certified', 'superseded')),
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
  actor_role VARCHAR(20),
  accion VARCHAR(100) NOT NULL,
  entidad VARCHAR(50) NOT NULL,
  entidad_id TEXT,
  request_id UUID,
  operation_uuid UUID,
  before_hash CHAR(64),
  after_hash CHAR(64),
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  ip INET,
  device_id UUID,
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

CREATE OR REPLACE FUNCTION reject_append_only_mutation()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  RAISE EXCEPTION USING
    ERRCODE = 'P0001',
    MESSAGE = TG_TABLE_NAME || '_IS_APPEND_ONLY';
END;
$$;

CREATE TRIGGER trg_puntuaciones_append_only
BEFORE UPDATE OR DELETE ON puntuaciones
FOR EACH ROW EXECUTE FUNCTION reject_append_only_mutation();

CREATE TRIGGER trg_audit_append_only
BEFORE UPDATE OR DELETE ON audit_log
FOR EACH ROW EXECUTE FUNCTION reject_append_only_mutation();

-- En producción, el rol runtime también debe carecer de UPDATE/DELETE
-- sobre puntuaciones y audit_log. Se configura al aprovisionar el rol.
