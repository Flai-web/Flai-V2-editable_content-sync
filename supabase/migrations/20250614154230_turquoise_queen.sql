/*
  # Add rating images functionality

  1. Changes
    - Add images array column to ratings table
    - Add constraint to limit number of images to 4
    - Update random_ratings view to include images
*/

-- Add images array column to ratings table
ALTER TABLE ratings ADD COLUMN IF NOT EXISTS images TEXT[] DEFAULT '{}';

-- Add constraint to limit number of images
CREATE OR REPLACE FUNCTION check_rating_images_limit() 
RETURNS TRIGGER AS $$
BEGIN
  IF array_length(NEW.images, 1) > 4 THEN
    RAISE EXCEPTION 'Ratings cannot have more than 4 images';
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS enforce_rating_images_limit ON ratings;
CREATE TRIGGER enforce_rating_images_limit
  BEFORE INSERT OR UPDATE ON ratings
  FOR EACH ROW
  EXECUTE FUNCTION check_rating_images_limit();

-- Drop and recreate the random_ratings view to include images
DROP VIEW IF EXISTS random_ratings;
CREATE VIEW random_ratings AS
SELECT 
  r.id,
  r.rating,
  r.comment,
  r.images,
  r.created_at,
  p.email as user_email,
  b.product_id,
  prod.name as product_name
FROM ratings r
JOIN bookings b ON r.booking_id = b.id
JOIN profiles p ON r.user_id = p.id
JOIN products prod ON b.product_id = prod.id
ORDER BY random()
LIMIT 3;