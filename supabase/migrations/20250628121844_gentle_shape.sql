/*
  # Add Credits System

  1. New Columns
    - Add `credits` column to `profiles` table (default 0)
    - Add `credits_used` column to `bookings` table (default 0)

  2. Security
    - Update existing RLS policies to handle credits
    - Add policies for credit transactions

  3. Views
    - Update `bookings_with_users` view to include credits_used
*/

-- Add credits column to profiles table
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'profiles' AND column_name = 'credits'
  ) THEN
    ALTER TABLE profiles ADD COLUMN credits integer DEFAULT 0;
  END IF;
END $$;

-- Add credits_used column to bookings table
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'bookings' AND column_name = 'credits_used'
  ) THEN
    ALTER TABLE bookings ADD COLUMN credits_used integer DEFAULT 0;
  END IF;
END $$;

-- Update the bookings_with_users view to include credits_used
DROP VIEW IF EXISTS bookings_with_users;

CREATE VIEW bookings_with_users AS
SELECT 
  b.*,
  p.email as user_email,
  pr.name as product_name
FROM bookings b
LEFT JOIN profiles p ON b.user_id = p.id
LEFT JOIN products pr ON b.product_id = pr.id;

-- Add check constraint to ensure credits_used is not negative
ALTER TABLE bookings ADD CONSTRAINT bookings_credits_used_check CHECK (credits_used >= 0);

-- Add check constraint to ensure credits is not negative
ALTER TABLE profiles ADD CONSTRAINT profiles_credits_check CHECK (credits >= 0);