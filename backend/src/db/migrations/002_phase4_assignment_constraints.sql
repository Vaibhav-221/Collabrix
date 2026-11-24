DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1
        FROM pg_constraint
        WHERE conname = 'check_assignment_title_valid'
          AND conrelid = 'assignments'::regclass
    ) THEN
        ALTER TABLE assignments
        ADD CONSTRAINT check_assignment_title_valid
        CHECK (char_length(btrim(title)) BETWEEN 2 AND 255) NOT VALID;
    END IF;

    IF NOT EXISTS (
        SELECT 1
        FROM pg_constraint
        WHERE conname = 'check_assignment_description_valid'
          AND conrelid = 'assignments'::regclass
    ) THEN
        ALTER TABLE assignments
        ADD CONSTRAINT check_assignment_description_valid
        CHECK (description IS NULL OR char_length(description) <= 5000) NOT VALID;
    END IF;
END
$$;
