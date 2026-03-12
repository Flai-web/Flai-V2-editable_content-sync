/*
  # Consolidate booking availability management

  1. Schema Changes
    - Drop the `specific_booking_slots` table (made redundant)
    - Rename `booking_config` to `booking_schedules` for broader scope
    - Add new columns to support both weekly and specific date entries:
      - `type`: 'weekly' or 'specific_date'
      - `date_override`: for specific date entries
      - `reason`: context for overrides
      - `priority`: conflict resolution (higher = higher priority)
    - Make `day_name` nullable for specific date entries
    - Add constraints to ensure data integrity

  2. Data Migration
    - Update existing weekly schedules with new type and priority
    - Preserve all existing booking configuration

  3. Security
    - Maintain existing RLS policies on renamed table
*/

-- Drop the specific_booking_slots table as it will be made redundant
DROP TABLE IF EXISTS specific_booking_slots;

-- Rename booking_config to booking_schedules for a more generic name
ALTER TABLE booking_config RENAME TO booking_schedules;

-- Drop the UNIQUE constraint on day_name from booking_schedules
DO $$
DECLARE
    constraint_name text;
BEGIN
    SELECT conname INTO constraint_name
    FROM pg_constraint
    WHERE conrelid = 'public.booking_schedules'::regclass
      AND contype = 'u'
      AND conkey = (SELECT array_agg(attnum ORDER BY attnum) FROM pg_attribute WHERE attrelid = 'public.booking_schedules'::regclass AND attname = 'day_name');

    IF constraint_name IS NOT NULL THEN
        EXECUTE 'ALTER TABLE booking_schedules DROP CONSTRAINT ' || quote_ident(constraint_name);
    END IF;
END $$;

-- Make day_name nullable
ALTER TABLE booking_schedules ALTER COLUMN day_name DROP NOT NULL;

-- Add new columns to booking_schedules
ALTER TABLE booking_schedules ADD COLUMN IF NOT EXISTS type TEXT NOT NULL DEFAULT 'weekly';
ALTER TABLE booking_schedules ADD COLUMN IF NOT EXISTS date_override DATE;
ALTER TABLE booking_schedules ADD COLUMN IF NOT EXISTS reason TEXT;
ALTER TABLE booking_schedules ADD COLUMN IF NOT EXISTS priority INTEGER NOT NULL DEFAULT 0;

-- Update existing data to reflect the new 'weekly' type and default priority
UPDATE booking_schedules SET type = 'weekly', priority = 0 WHERE type IS NULL OR type = '';

-- Add check constraint for 'type' column
ALTER TABLE booking_schedules ADD CONSTRAINT booking_schedules_type_check
CHECK (type IN ('weekly', 'specific_date'));

-- Add conditional constraints based on 'type'
ALTER TABLE booking_schedules ADD CONSTRAINT booking_schedules_type_data_consistency
CHECK (
    (type = 'weekly' AND day_name IS NOT NULL AND date_override IS NULL) OR
    (type = 'specific_date' AND date_override IS NOT NULL AND day_name IS NULL)
);

-- Update the check constraint for day_name to allow NULL for specific_date types
DO $$
DECLARE
    constraint_name text;
BEGIN
    SELECT conname INTO constraint_name
    FROM pg_constraint
    WHERE conrelid = 'public.booking_schedules'::regclass
      AND contype = 'c'
      AND conname LIKE '%day_name%';

    IF constraint_name IS NOT NULL THEN
        EXECUTE 'ALTER TABLE booking_schedules DROP CONSTRAINT ' || quote_ident(constraint_name);
    END IF;
END $$;

-- Add the new check constraint for day_name
ALTER TABLE booking_schedules ADD CONSTRAINT booking_schedules_day_name_valid_values
CHECK (
    (type = 'weekly' AND day_name IN ('monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday')) OR
    (type = 'specific_date' AND day_name IS NULL)
);

-- Re-create the trigger for updated_at column for the new table name
DROP TRIGGER IF EXISTS update_booking_config_updated_at ON booking_schedules;

-- Create the new trigger
CREATE TRIGGER update_booking_schedules_updated_at
    BEFORE UPDATE ON booking_schedules
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- Enable RLS on the new table (inherits from booking_config)
ALTER TABLE booking_schedules ENABLE ROW LEVEL SECURITY;

-- Create policies for the renamed table
DROP POLICY IF EXISTS "Authenticated users can read booking schedules" ON booking_schedules;
DROP POLICY IF EXISTS "Authenticated users can manage booking schedules" ON booking_schedules;

CREATE POLICY "Authenticated users can read booking schedules"
  ON booking_schedules
  FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Authenticated users can manage booking schedules"
  ON booking_schedules
  FOR ALL
  TO authenticated
  USING (true);


-- Product Page - Editing Section
('product-page-editing-included-title', 'text', 'Professionel redigering inkluderet', 'Produktsektion titel for inkluderet redigering', 'product'),
('product-page-editing-included-description', 'text', 'Dette produkt inkluderer professionel redigering med farvekorrigering, klipning og baggrundsmusik.', 'Produktsektion beskrivelse for inkluderet redigering', 'product')

