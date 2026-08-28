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

WITH displaced AS (
  SELECT id, row_number() OVER (PARTITION BY noche_id ORDER BY id) AS rn
  FROM comparsas
)
UPDATE comparsas c
SET orden = 1000 + displaced.rn,
    activo = CASE WHEN is_fixed_comparsa_name(c.nombre) THEN c.activo ELSE false END
FROM displaced
WHERE c.id = displaced.id;

WITH fixed(nombre, orden) AS (
  VALUES
    ('Tropicala', 1),
    ('Ita Vera', 2),
    ('Arami', 3),
    ('Aymara', 4),
    ('Oh Bahia', 5),
    ('Poramba', 6)
),
ranked AS (
  SELECT c.id, fixed.nombre, fixed.orden,
         row_number() OVER (PARTITION BY c.noche_id, lower(fixed.nombre) ORDER BY c.id) AS rn
  FROM comparsas c
  JOIN fixed ON lower(c.nombre) = lower(fixed.nombre)
)
UPDATE comparsas c
SET nombre = ranked.nombre,
    orden = CASE WHEN ranked.rn = 1 THEN ranked.orden ELSE 2000 + c.id::int END,
    activo = ranked.rn = 1
FROM ranked
WHERE c.id = ranked.id;

WITH fixed(nombre, orden) AS (
  VALUES
    ('Tropicala', 1),
    ('Ita Vera', 2),
    ('Arami', 3),
    ('Aymara', 4),
    ('Oh Bahia', 5),
    ('Poramba', 6)
)
INSERT INTO comparsas (nombre, noche_id, orden, activo)
SELECT fixed.nombre, n.id, fixed.orden, true
FROM noches n
CROSS JOIN fixed
WHERE NOT EXISTS (
  SELECT 1
  FROM comparsas c
  WHERE c.noche_id = n.id
    AND lower(c.nombre) = lower(fixed.nombre)
);

CREATE OR REPLACE FUNCTION enforce_fixed_comparsa_catalog()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    IF NOT is_fixed_comparsa_name(NEW.nombre) OR NEW.activo IS DISTINCT FROM true THEN
      RAISE EXCEPTION USING
        ERRCODE = 'P0001',
        MESSAGE = 'COMPARSA_CATALOG_FIXED';
    END IF;
  END IF;

  IF TG_OP = 'UPDATE' THEN
    IF NEW.nombre IS DISTINCT FROM OLD.nombre
       OR NEW.noche_id IS DISTINCT FROM OLD.noche_id
       OR NEW.activo IS DISTINCT FROM OLD.activo THEN
      RAISE EXCEPTION USING
        ERRCODE = 'P0001',
        MESSAGE = 'COMPARSA_ONLY_ORDER_MUTABLE';
    END IF;
  END IF;

  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_fixed_comparsa_catalog
BEFORE INSERT OR UPDATE ON comparsas
FOR EACH ROW EXECUTE FUNCTION enforce_fixed_comparsa_catalog();
