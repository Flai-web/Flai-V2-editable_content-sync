/*
  # Add address zones management

  1. New Tables
    - `address_zones` - Store service coverage areas
      - `id` (uuid, primary key)
      - `name` (text) - Zone name/description
      - `center_address` (text) - Center point address
      - `radius_km` (integer) - Coverage radius in kilometers
      - `is_active` (boolean) - Whether the zone is currently active
      - `created_at` (timestamp)
      - `updated_at` (timestamp)

  2. Security
    - Enable RLS on address_zones table
    - Add policies for admin users
*/

CREATE TABLE IF NOT EXISTS address_zones (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  center_address TEXT NOT NULL,
  radius_km INTEGER NOT NULL CHECK (radius_km > 0),
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Enable RLS
ALTER TABLE address_zones ENABLE ROW LEVEL SECURITY;

-- Policies for address_zones
CREATE POLICY "Anyone can view active zones"
  ON address_zones
  FOR SELECT
  TO public
  USING (is_active = true);

CREATE POLICY "Admins can manage zones"
  ON address_zones
  FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.is_admin = true
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.is_admin = true
    )
  );

-- Function to update the updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = now();
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Trigger to update the updated_at column
CREATE TRIGGER update_address_zones_updated_at
    BEFORE UPDATE ON address_zones
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- Insert initial zone for Kolding
INSERT INTO address_zones (name, center_address, radius_km)
VALUES ('Kolding Zone', 'Kringsager 36, 6000 Kolding', 35);