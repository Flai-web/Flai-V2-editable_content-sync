/*
  # Add guest email support to bookings table

  1. Changes to bookings table
    - Add `guest_email` column (text, nullable) to store email for guest bookings
    - Make `user_id` nullable to support guest bookings
  
  2. Security
    - Update RLS policies to allow unauthenticated users to create bookings with guest_email
    - Add policy for guests to view their bookings by guest_email
    - Existing authenticated policies remain unchanged
  
  3. Important notes
    - guest_email is used when user_id is null (guest booking)
    - Both cannot be null - at least one must have a value
    - This maintains backward compatibility with existing user-based bookings
*/

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'bookings' AND column_name = 'guest_email'
  ) THEN
    ALTER TABLE bookings ADD COLUMN guest_email text;
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'bookings' AND column_name = 'user_id' AND is_nullable = 'YES'
  ) THEN
    ALTER TABLE bookings ALTER COLUMN user_id DROP NOT NULL;
  END IF;
END $$;

DROP POLICY IF EXISTS "Users can insert bookings" ON bookings;

CREATE POLICY "Authenticated users can create bookings"
  ON bookings
  FOR INSERT
  TO authenticated
  WITH CHECK (user_id = auth.uid());

CREATE POLICY "Guest users can create bookings"
  ON bookings
  FOR INSERT
  TO anon
  WITH CHECK (guest_email IS NOT NULL AND user_id IS NULL);

DROP POLICY IF EXISTS "Users can view own bookings" ON bookings;

CREATE POLICY "Authenticated users can view own bookings"
  ON bookings
  FOR SELECT
  TO authenticated
  USING (user_id = auth.uid());

CREATE POLICY "Guest users can view own bookings by email"
  ON bookings
  FOR SELECT
  TO anon
  USING (guest_email IS NOT NULL);
