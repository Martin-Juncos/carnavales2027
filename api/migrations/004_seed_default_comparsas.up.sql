CREATE OR REPLACE FUNCTION seed_default_comparsas_for_night(target_night_id BIGINT)
RETURNS void LANGUAGE plpgsql AS $$
BEGIN
  WITH official_comparsas(nombre, default_order) AS (
    VALUES
      ('Tropicala', 1),
      ('Ita Vera', 2),
      ('Arami', 3),
      ('Aymara', 4),
      ('Oh Bahia', 5),
      ('Poramba', 6)
  ),
  existing_max AS (
    SELECT COALESCE(MAX(orden), 0)::int AS max_order
    FROM comparsas
    WHERE noche_id = target_night_id
  ),
  missing_comparsas AS (
    SELECT
      official_comparsas.nombre,
      CASE
        WHEN existing_max.max_order = 0 THEN official_comparsas.default_order
        ELSE existing_max.max_order + row_number() OVER (ORDER BY official_comparsas.default_order)
      END AS next_order
    FROM official_comparsas
    CROSS JOIN existing_max
    WHERE NOT EXISTS (
      SELECT 1
      FROM comparsas c
      WHERE c.noche_id = target_night_id
        AND lower(trim(c.nombre)) = lower(trim(official_comparsas.nombre))
    )
  )
  INSERT INTO comparsas (nombre, noche_id, orden, activo)
  SELECT nombre, target_night_id, next_order, true
  FROM missing_comparsas;
END;
$$;

CREATE OR REPLACE FUNCTION seed_default_comparsas_after_night_insert()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  PERFORM seed_default_comparsas_for_night(NEW.id);
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_seed_default_comparsas_after_night_insert ON noches;
CREATE TRIGGER trg_seed_default_comparsas_after_night_insert
AFTER INSERT ON noches
FOR EACH ROW EXECUTE FUNCTION seed_default_comparsas_after_night_insert();

SELECT seed_default_comparsas_for_night(id)
FROM noches;
