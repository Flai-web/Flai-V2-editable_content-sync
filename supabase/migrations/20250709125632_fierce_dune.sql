/*
  # Create specific booking slots table

  1. New Tables
    - `specific_booking_slots`
      - `id` (uuid, primary key)
      - `date` (date, not null)
      - `time` (time, not null)
      - `is_available` (boolean, not null)
      - `reason` (text, optional)
      - `created_at` (timestamptz)
      - `updated_at` (timestamptz)
      - Unique constraint on (date, time)

  2. Security
    - Enable RLS on `specific_booking_slots` table
    - Add policy for admins to manage all specific booking slots
    - Add policy for public to view specific booking slots

  3. Triggers
    - Add trigger to update updated_at timestamp
*/

CREATE TABLE IF NOT EXISTS specific_booking_slots (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  date date NOT NULL,
  time time NOT NULL,
  is_available boolean NOT NULL,
  reason text,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  UNIQUE(date, time)
);

ALTER TABLE specific_booking_slots ENABLE ROW LEVEL SECURITY;

-- Admins can manage all specific booking slots
CREATE POLICY "Admins can manage specific booking slots"
  ON specific_booking_slots
  FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid() AND profiles.is_admin = true
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid() AND profiles.is_admin = true
    )
  );

-- Public can view available specific slots
CREATE POLICY "Anyone can view specific booking slots"
  ON specific_booking_slots
  FOR SELECT
  TO public
  USING (true);

-- Add trigger to update updated_at timestamp
CREATE TRIGGER update_specific_booking_slots_updated_at
  BEFORE UPDATE ON specific_booking_slots
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();