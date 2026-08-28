CREATE OR REPLACE FUNCTION is_fixed_comparsa_name(value TEXT)
RETURNS BOOLEAN LANGUAGE sql IMMUTABLE AS $$
  SELECT lower(trim(value)) IN (
    lower('Tropicala'),
    lower('Ita Vera'),
    lower('Arami'),
    lower('Aymara'),
    lower('Oh Bahia'),
    lower('Poramba')
  );
$$;

CREATE OR REPLACE FUNCTION enforce_fixed_comparsa_catalog()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    IF NOT is_fixed_comparsa_name(NEW.nombre) OR NEW.activo IS DISTINCT FROM true THEN
      RAISE EXCEPTION USING ERRCODE = 'P0001', MESSAGE = 'COMPARSA_CATALOG_FIXED';
    END IF;
  END IF;

  IF TG_OP = 'UPDATE' THEN
    IF NEW.nombre IS DISTINCT FROM OLD.nombre
       OR NEW.noche_id IS DISTINCT FROM OLD.noche_id
       OR NEW.activo IS DISTINCT FROM OLD.activo THEN
      RAISE EXCEPTION USING ERRCODE = 'P0001', MESSAGE = 'COMPARSA_ONLY_ORDER_MUTABLE';
    END IF;
  END IF;

  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_fixed_comparsa_catalog
BEFORE INSERT OR UPDATE ON comparsas
FOR EACH ROW EXECUTE FUNCTION enforce_fixed_comparsa_catalog();
