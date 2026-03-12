/*
  # Add discount codes functionality

  1. New Tables
    - `discount_codes` - Store discount codes
      - `id` (uuid, primary key)
      - `code` (text, unique) - The discount code
      - `description` (text) - Description of the discount
      - `discount_type` (text) - 'percentage' or 'fixed'
      - `discount_value` (integer) - Percentage (1-100) or fixed amount in DKK
      - `min_order_amount` (integer) - Minimum order amount to use code
      - `max_uses` (integer) - Maximum number of uses (null for unlimited)
      - `current_uses` (integer) - Current number of uses
      - `is_active` (boolean) - Whether the code is active
      - `valid_from` (timestamp) - When the code becomes valid
      - `valid_until` (timestamp) - When the code expires
      - `created_at` (timestamp)
      - `updated_at` (timestamp)

    - `discount_code_uses` - Track discount code usage
      - `id` (uuid, primary key)
      - `discount_code_id` (uuid) - Reference to discount_codes
      - `booking_id` (integer) - Reference to bookings
      - `user_id` (uuid) - Reference to auth.users
      - `discount_amount` (integer) - Amount discounted in DKK
      - `created_at` (timestamp)

  2. Security
    - Enable RLS on all tables
    - Add appropriate policies
*/

-- Create discount_codes table
CREATE TABLE IF NOT EXISTS discount_codes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  code TEXT NOT NULL UNIQUE,
  description TEXT NOT NULL,
  discount_type TEXT NOT NULL CHECK (discount_type IN ('percentage', 'fixed')),
  discount_value INTEGER NOT NULL CHECK (discount_value > 0),
  min_order_amount INTEGER DEFAULT 0,
  max_uses INTEGER,
  current_uses INTEGER DEFAULT 0,
  is_active BOOLEAN DEFAULT true,
  valid_from TIMESTAMPTZ DEFAULT now(),
  valid_until TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Create discount_code_uses table
CREATE TABLE IF NOT EXISTS discount_code_uses (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  discount_code_id UUID NOT NULL REFERENCES discount_codes(id) ON DELETE CASCADE,
  booking_id INTEGER NOT NULL REFERENCES bookings(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  discount_amount INTEGER NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Enable RLS
ALTER TABLE discount_codes ENABLE ROW LEVEL SECURITY;
ALTER TABLE discount_code_uses ENABLE ROW LEVEL SECURITY;

-- Policies for discount_codes
CREATE POLICY "Anyone can view active discount codes"
  ON discount_codes
  FOR SELECT
  TO public
  USING (is_active = true AND (valid_until IS NULL OR valid_until > now()));

CREATE POLICY "Admins can manage discount codes"
  ON discount_codes
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

-- Policies for discount_code_uses
CREATE POLICY "Users can view their own discount code uses"
  ON discount_code_uses
  FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Admins can view all discount code uses"
  ON discount_code_uses
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.is_admin = true
    )
  );

CREATE POLICY "System can create discount code uses"
  ON discount_code_uses
  FOR INSERT
  TO authenticated
  WITH CHECK (true);

-- Add trigger to update updated_at column
CREATE TRIGGER update_discount_codes_updated_at
    BEFORE UPDATE ON discount_codes
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- Add discount_code_id to bookings table
ALTER TABLE bookings ADD COLUMN IF NOT EXISTS discount_code_id UUID REFERENCES discount_codes(id);
ALTER TABLE bookings ADD COLUMN IF NOT EXISTS discount_amount INTEGER DEFAULT 0;
ALTER TABLE bookings ADD COLUMN IF NOT EXISTS original_price INTEGER;

-- Function to validate and apply discount code
CREATE OR REPLACE FUNCTION validate_discount_code(
  code_text TEXT,
  order_amount INTEGER,
  user_id_param UUID
) RETURNS TABLE (
  is_valid BOOLEAN,
  discount_amount INTEGER,
  error_message TEXT,
  discount_code_id UUID
) AS $$
DECLARE
  discount_record discount_codes%ROWTYPE;
  calculated_discount INTEGER;
BEGIN
  -- Find the discount code
  SELECT * INTO discount_record
  FROM discount_codes
  WHERE code = code_text
  AND is_active = true
  AND (valid_until IS NULL OR valid_until > now())
  AND now() >= valid_from;

  -- Check if code exists and is valid
  IF NOT FOUND THEN
    RETURN QUERY SELECT false, 0, 'Ugyldig eller udløbet rabatkode'::TEXT, NULL::UUID;
    RETURN;
  END IF;

  -- Check minimum order amount
  IF order_amount < discount_record.min_order_amount THEN
    RETURN QUERY SELECT false, 0, format('Minimum ordrebeløb er %s kr', discount_record.min_order_amount)::TEXT, NULL::UUID;
    RETURN;
  END IF;

  -- Check usage limit
  IF discount_record.max_uses IS NOT NULL AND discount_record.current_uses >= discount_record.max_uses THEN
    RETURN QUERY SELECT false, 0, 'Rabatkoden er udsolgt'::TEXT, NULL::UUID;
    RETURN;
  END IF;

  -- Calculate discount amount
  IF discount_record.discount_type = 'percentage' THEN
    calculated_discount := ROUND(order_amount * discount_record.discount_value / 100.0);
  ELSE
    calculated_discount := LEAST(discount_record.discount_value, order_amount);
  END IF;

  -- Return valid result
  RETURN QUERY SELECT true, calculated_discount, ''::TEXT, discount_record.id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Insert some example discount codes
INSERT INTO discount_codes (code, description, discount_type, discount_value, min_order_amount, max_uses) VALUES
('WELCOME10', '10% rabat for nye kunder', 'percentage', 10, 500, 100),
('SAVE100', '100 kr rabat på ordrer over 1000 kr', 'fixed', 100, 1000, 50),
('SUMMER25', '25% sommerrabat', 'percentage', 25, 0, NULL);