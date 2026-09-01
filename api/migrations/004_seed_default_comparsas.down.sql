DROP TRIGGER IF EXISTS trg_seed_default_comparsas_after_night_insert ON noches;
DROP FUNCTION IF EXISTS seed_default_comparsas_after_night_insert();
DROP FUNCTION IF EXISTS seed_default_comparsas_for_night(BIGINT);
