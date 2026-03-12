/*
  # Enable RLS on bookings view

  1. Changes
    - Enable RLS on bookings_with_users view
    - Add policies for authenticated users and admins
*/

-- Drop existing view
DROP VIEW IF EXISTS bookings_with_users;

-- Recreate view with security definer
CREATE OR REPLACE VIEW bookings_with_users 
WITH (security_invoker = false)
AS
SELECT 
  b.*,
  p.email as user_email,
  prod.name as product_name
FROM bookings b
JOIN auth.users u ON b.user_id = u.id
JOIN profiles p ON u.id = p.id
JOIN products prod ON b.product_id = prod.id
WHERE b.deleted_at IS NULL
AND (
  -- User can see their own bookings
  b.user_id = auth.uid()
  OR 
  -- Admins can see all bookings
  EXISTS (
    SELECT 1 
    FROM profiles 
    WHERE profiles.id = auth.uid() 
    AND profiles.is_admin = true
  )
);

-- Grant access to authenticated users
GRANT SELECT ON bookings_with_users TO authenticated;