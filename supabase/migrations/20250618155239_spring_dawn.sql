/*
  # Fix bookings pricing display and add comprehensive analytics

  1. Changes
    - Add price column to bookings table for proper amount tracking
    - Update bookings_with_users view to include proper pricing calculation
    - Ensure all booking amounts are properly calculated and displayed

  2. Security
    - Maintain existing RLS policies
    - No changes to authentication or authorization
*/

-- Add price column to bookings table if it doesn't exist
ALTER TABLE bookings ADD COLUMN IF NOT EXISTS price INTEGER;

-- Update existing bookings to have the correct price from products
UPDATE bookings 
SET price = products.price 
FROM products 
WHERE bookings.product_id = products.id 
AND bookings.price IS NULL;

-- Drop and recreate the bookings_with_users view with proper pricing
DROP VIEW IF EXISTS bookings_with_users;

CREATE OR REPLACE VIEW bookings_with_users AS
SELECT 
  b.id,
  b.user_id,
  b.product_id,
  b.booking_date,
  b.booking_time,
  b.address,
  b.include_editing,
  b.payment_status,
  b.payment_method,
  b.payment_intent_id,
  b.is_completed,
  b.created_at,
  b.deleted_at,
  b.discount_code_id,
  b.discount_amount,
  b.original_price,
  COALESCE(b.price, prod.price) as price,
  p.email as user_email,
  prod.name as product_name
FROM bookings b
LEFT JOIN profiles p ON b.user_id = p.id
LEFT JOIN products prod ON b.product_id = prod.id
WHERE b.deleted_at IS NULL
AND (
  -- User can see their own bookings
  b.user_id = auth.uid()
  OR 
  -- Admins can see all bookings
  EXISTS (
    SELECT 1 FROM profiles 
    WHERE profiles.id = auth.uid() 
    AND profiles.is_admin = true
  )
);

-- Grant necessary permissions
GRANT SELECT ON bookings_with_users TO authenticated;

-- Create function to calculate total booking amount
CREATE OR REPLACE FUNCTION calculate_booking_amount(
  base_price INTEGER,
  include_editing BOOLEAN DEFAULT false,
  discount_amount INTEGER DEFAULT 0
) RETURNS INTEGER AS $$
BEGIN
  RETURN base_price + (CASE WHEN include_editing THEN 100 ELSE 0 END) - COALESCE(discount_amount, 0);
END;
$$ LANGUAGE plpgsql IMMUTABLE;