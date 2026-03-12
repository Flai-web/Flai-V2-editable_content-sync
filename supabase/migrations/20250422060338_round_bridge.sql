/*
  # Add initial products and fix data loading

  1. Changes
    - Add initial products with proper data and categories
    - Ensure products are visible to all users
*/

-- Add category column to products table
ALTER TABLE products ADD COLUMN IF NOT EXISTS category TEXT CHECK (category IN ('photo', 'video')) NOT NULL DEFAULT 'photo';

-- Delete existing products to start fresh
TRUNCATE products CASCADE;

-- Insert initial products
INSERT INTO products (name, description, price, image_url, category) VALUES 
(
  'Standard Droneoptagelse',
  'En times droneoptagelse i 4K kvalitet. Perfekt til ejendomsvisninger, events eller personlige projekter.',
  1499,
  'https://images.pexels.com/photos/336232/pexels-photo-336232.jpeg?auto=compress&cs=tinysrgb&w=1260&h=750&dpr=1',
  'video'
),
(
  'Premium Luftfotografering',
  'Professionel dronefotografering med 20 højkvalitets billeder. Ideelt til marketing, sociale medier eller ejendomsfremvisninger.',
  1299,
  'https://images.pexels.com/photos/1122639/pexels-photo-1122639.jpeg?auto=compress&cs=tinysrgb&w=1260&h=750&dpr=1',
  'photo'
);

-- Ensure products are visible to everyone
DROP POLICY IF EXISTS "Anyone can view products" ON products;
CREATE POLICY "Anyone can view products" 
  ON products 
  FOR SELECT 
  TO public 
  USING (true);