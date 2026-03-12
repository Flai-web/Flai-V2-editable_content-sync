/*
  # Add multiple images support for products

  1. Changes
    - Add images array column to products table
    - Update existing products with multiple images
*/

-- Add images array column to products table
ALTER TABLE products DROP COLUMN IF EXISTS image_url;
ALTER TABLE products ADD COLUMN images TEXT[] NOT NULL DEFAULT '{}';

-- Update existing products with multiple images
UPDATE products SET images = ARRAY[
  'https://images.pexels.com/photos/336232/pexels-photo-336232.jpeg?auto=compress&cs=tinysrgb&w=1260&h=750&dpr=1',
  'https://images.pexels.com/photos/1122639/pexels-photo-1122639.jpeg?auto=compress&cs=tinysrgb&w=1260&h=750&dpr=1',
  'https://images.pexels.com/photos/2523959/pexels-photo-2523959.jpeg?auto=compress&cs=tinysrgb&w=1260&h=750&dpr=1'
] WHERE category = 'video';

UPDATE products SET images = ARRAY[
  'https://images.pexels.com/photos/1122639/pexels-photo-1122639.jpeg?auto=compress&cs=tinysrgb&w=1260&h=750&dpr=1',
  'https://images.pexels.com/photos/336232/pexels-photo-336232.jpeg?auto=compress&cs=tinysrgb&w=1260&h=750&dpr=1',
  'https://images.pexels.com/photos/2523959/pexels-photo-2523959.jpeg?auto=compress&cs=tinysrgb&w=1260&h=750&dpr=1'
] WHERE category = 'photo';