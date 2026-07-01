-- Create trigger to auto-generate sequential certificate IDs on insert

CREATE OR REPLACE FUNCTION set_certificate_id()
RETURNS trigger AS $$
BEGIN
  -- Only set if not already properly formatted
  IF NEW.certificate_id IS NULL OR NEW.certificate_id !~ '^LR-\d{4}-\d{6}$' THEN
    NEW.certificate_id := generate_certificate_id();
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_set_certificate_id ON course_completions;
CREATE TRIGGER trg_set_certificate_id
  BEFORE INSERT ON course_completions
  FOR EACH ROW EXECUTE FUNCTION set_certificate_id();