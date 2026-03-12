/*
  # Add rating token fields to bookings table

  1. New Columns
    - `rating_access_token` (text, nullable) - Unique token for rating access
    - `rating_token_expires_at` (timestamptz, nullable) - Token expiration time

  2. Purpose
    - Enable secure rating access via email links
    - Allow users to rate bookings without logging in
    - Provide time-limited access for security
*/

DO $$
BEGIN
  -- Add rating_access_token column if it doesn't exist
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'bookings' AND column_name = 'rating_access_token'
  ) THEN
    ALTER TABLE bookings ADD COLUMN rating_access_token text;
  END IF;

  -- Add rating_token_expires_at column if it doesn't exist
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'bookings' AND column_name = 'rating_token_expires_at'
  ) THEN
    ALTER TABLE bookings ADD COLUMN rating_token_expires_at timestamptz;
  END IF;
END $$;

-- Create index for efficient token lookups
CREATE INDEX IF NOT EXISTS idx_bookings_rating_token ON bookings(rating_access_token) WHERE rating_access_token IS NOT NULL;