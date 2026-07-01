-- Improve certificate_id format to be sequential and year-based
-- Format: LR-YYYY-NNNNNN (e.g., LR-2026-000001)

-- First, let's create a sequence for certificate IDs
CREATE SEQUENCE IF NOT EXISTS certificate_id_seq;

-- Create a function to generate sequential certificate IDs
CREATE OR REPLACE FUNCTION generate_certificate_id()
RETURNS text AS $$
DECLARE
  year_part text := to_char(now(), 'YYYY');
  seq_num integer;
  padded_seq text;
BEGIN
  -- Get next value from sequence
  SELECT nextval('certificate_id_seq') INTO seq_num;
  
  -- Pad the sequence number to 6 digits
  padded_seq := lpad(seq_num::text, 6, '0');
  
  -- Return the formatted ID
  RETURN 'LR-' || year_part || '-' || padded_seq;
END;
$$ LANGUAGE plpgsql;

-- Update existing records with proper certificate IDs
-- Only update ones that don't match the new format
UPDATE course_completions
SET certificate_id = generate_certificate_id()
WHERE certificate_id !~ '^LR-\d{4}-\d{6}$';

-- Update the default for new records
ALTER TABLE course_completions 
DROP CONSTRAINT IF EXISTS course_completions_certificate_id_default;

ALTER TABLE course_completions
ALTER COLUMN certificate_id SET DEFAULT generate_certificate_id();