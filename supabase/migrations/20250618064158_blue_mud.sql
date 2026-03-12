/*
  # Fix ratings view to properly load product names

  1. Changes
    - Update random_ratings view to show all ratings with proper joins
    - Create debug view to help troubleshoot rating issues
    - Use proper data types to avoid casting errors
*/

-- Drop existing views
DROP VIEW IF EXISTS random_ratings;
DROP VIEW IF EXISTS ratings_debug;

-- Create a comprehensive ratings view that shows all ratings
CREATE OR REPLACE VIEW random_ratings AS
SELECT 
  r.id,
  r.rating,
  r.comment,
  r.images,
  r.created_at,
  COALESCE(p.email, 'Ukendt bruger') as user_email,
  b.product_id,
  COALESCE(prod.name, 'Ukendt produkt') as product_name
FROM ratings r
LEFT JOIN bookings b ON r.booking_id = b.id
LEFT JOIN profiles p ON r.user_id = p.id
LEFT JOIN products prod ON b.product_id = prod.id
ORDER BY r.created_at DESC;

-- Create a debug view to help troubleshoot rating issues
CREATE OR REPLACE VIEW ratings_debug AS
SELECT 
  r.id as rating_id,
  r.booking_id,
  r.user_id,
  r.rating,
  r.comment,
  COUNT(b.id) as booking_exists,
  b.product_id,
  COUNT(prod.id) as product_exists,
  COALESCE(prod.name, 'MISSING PRODUCT') as product_name,
  COALESCE(p.email, 'MISSING USER') as user_email
FROM ratings r
LEFT JOIN bookings b ON r.booking_id = b.id
LEFT JOIN products prod ON b.product_id = prod.id
LEFT JOIN profiles p ON r.user_id = p.id
GROUP BY r.id, r.booking_id, r.user_id, r.rating, r.comment, b.product_id, prod.name, p.email
ORDER BY r.created_at DESC;

-- Grant access to the views
GRANT SELECT ON random_ratings TO public;
GRANT SELECT ON ratings_debug TO authenticated;