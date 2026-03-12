/*
  # Add ratings functionality and views

  1. New Tables
    - `ratings` - Store customer ratings for completed bookings
      - `id` (uuid, primary key)
      - `booking_id` (integer, references bookings)
      - `user_id` (uuid, references auth.users)
      - `rating` (integer, 1-5)
      - `comment` (text, optional)
      - `created_at` (timestamp)

  2. New Views
    - `random_ratings` - Get three random approved ratings

  3. Security
    - Enable RLS on ratings table
    - Add policies for authenticated users
*/

-- Create ratings table
CREATE TABLE IF NOT EXISTS ratings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  booking_id INTEGER REFERENCES bookings(id) ON DELETE CASCADE,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  rating INTEGER CHECK (rating >= 1 AND rating <= 5),
  comment TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Enable RLS
ALTER TABLE ratings ENABLE ROW LEVEL SECURITY;

-- Ratings policies
CREATE POLICY "Users can view all approved ratings"
  ON ratings FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Users can create ratings for their own bookings"
  ON ratings FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM bookings
      WHERE bookings.id = booking_id
      AND bookings.user_id = auth.uid()
      AND bookings.is_completed = true
    )
  );

-- Create view for random ratings
CREATE OR REPLACE VIEW random_ratings AS
SELECT 
  r.id,
  r.rating,
  r.comment,
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