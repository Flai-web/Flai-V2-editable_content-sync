/*
  # Update bookings_with_users view

  1. Changes
    - Add rating_access_token column
    - Add rating_token_expires_at column
    - Ensure zip_file_url is included

  2. Purpose
    - Make new rating token fields available to frontend
    - Maintain compatibility with existing queries
*/

-- Drop the existing view
DROP VIEW IF EXISTS bookings_with_users;

-- Recreate the view with new columns
CREATE VIEW bookings_with_users AS
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
  b.price,
  b.zip_file_url,
  b.rating_access_token,
  b.rating_token_expires_at,
  p.email as user_email,
  pr.name as product_name
FROM bookings b
LEFT JOIN profiles p ON b.user_id = p.id
LEFT JOIN products pr ON b.product_id = pr.id
WHERE b.deleted_at IS NULL;