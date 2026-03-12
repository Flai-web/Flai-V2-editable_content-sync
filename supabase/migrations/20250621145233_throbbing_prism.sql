/*
  # Add zip file support for completed bookings

  1. Changes
    - Add zip_file_url column to bookings table
    - Create booking-files storage bucket
    - Add storage policies for secure file access

  2. Security
    - Admins can upload files
    - Users can only download files for their own bookings
*/

-- Add zip_file_url column to bookings table
ALTER TABLE bookings ADD COLUMN IF NOT EXISTS zip_file_url TEXT;

-- Create booking-files bucket
INSERT INTO storage.buckets (id, name, public) 
VALUES ('booking-files', 'booking-files', false)
ON CONFLICT (id) DO NOTHING;

-- Create policies for booking-files bucket
CREATE POLICY "Admins can upload booking files"
ON storage.objects FOR INSERT TO authenticated WITH CHECK (
  bucket_id = 'booking-files' AND 
  EXISTS (
    SELECT 1 FROM profiles
    WHERE profiles.id = auth.uid()
    AND profiles.is_admin = true
  )
);

CREATE POLICY "Users can view their own booking files"
ON storage.objects FOR SELECT TO authenticated USING (
  bucket_id = 'booking-files' AND (
    -- Admins can view all files
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.is_admin = true
    )
    OR
    -- Users can view files for their own bookings
    -- File path should be: booking-{booking_id}-{user_id}/filename
    name LIKE '%' || auth.uid()::text || '%'
  )
);

CREATE POLICY "Admins can update booking files"
ON storage.objects FOR UPDATE TO authenticated USING (
  bucket_id = 'booking-files' AND 
  EXISTS (
    SELECT 1 FROM profiles
    WHERE profiles.id = auth.uid()
    AND profiles.is_admin = true
  )
);

CREATE POLICY "Admins can delete booking files"
ON storage.objects FOR DELETE TO authenticated USING (
  bucket_id = 'booking-files' AND 
  EXISTS (
    SELECT 1 FROM profiles
    WHERE profiles.id = auth.uid()
    AND profiles.is_admin = true
  )
);