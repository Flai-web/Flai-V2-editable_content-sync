/*
  # Fix relationships and improve product management

  1. Changes
    - Add proper join between bookings and profiles
    - Update bookings view to include user email
*/

-- Create a view for bookings with user information
CREATE OR REPLACE VIEW bookings_with_users AS
SELECT 
  b.*,
  p.email as user_email,
  prod.name as product_name
FROM bookings b
JOIN auth.users u ON b.user_id = u.id
JOIN profiles p ON u.id = p.id
JOIN products prod ON b.product_id = prod.id
WHERE b.deleted_at IS NULL;