/*
  # Add booking days configuration

  1. New Tables
    - `booking_config` - Store booking configuration
      - `id` (uuid, primary key)
      - `day_name` (text) - Day of the week (monday, tuesday, etc.)
      - `is_enabled` (boolean) - Whether bookings are allowed on this day
      - `start_time` (time) - Start time for bookings
      - `end_time` (time) - End time for bookings
      - `created_at` (timestamp)
      - `updated_at` (timestamp)

  2. Security
    - Enable RLS on booking_config table
    - Add policies for admin users and public read access
*/

CREATE TABLE IF NOT EXISTS booking_config (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  day_name TEXT NOT NULL UNIQUE CHECK (day_name IN ('monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday')),
  is_enabled BOOLEAN DEFAULT false,
  start_time TIME DEFAULT '14:00',
  end_time TIME DEFAULT '18:00',
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Enable RLS
ALTER TABLE booking_config ENABLE ROW LEVEL SECURITY;

-- Policies for booking_config
CREATE POLICY "Anyone can view booking config"
  ON booking_config
  FOR SELECT
  TO public
  USING (true);

CREATE POLICY "Admins can manage booking config"
  ON booking_config
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

-- Trigger to update the updated_at column
CREATE TRIGGER update_booking_config_updated_at
    BEFORE UPDATE ON booking_config
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- Insert default configuration (matching current system)
INSERT INTO booking_config (day_name, is_enabled, start_time, end_time) VALUES
('monday', true, '14:00', '18:00'),
('tuesday', false, '14:00', '18:00'),
('wednesday', true, '14:00', '18:00'),
('thursday', false, '14:00', '18:00'),
('friday', true, '14:00', '18:00'),
('saturday', false, '14:00', '18:00'),
('sunday', true, '10:00', '18:00');