-- Drop existing view
DROP VIEW IF EXISTS bookings_with_users;

-- Recreate view with proper security
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