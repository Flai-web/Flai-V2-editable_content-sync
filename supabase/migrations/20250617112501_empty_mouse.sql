/*
  # Add site content storage bucket

  1. Changes
    - Create site-content bucket for storing site content images
    - Add storage policies for authenticated users
    - Set proper permissions for upload, view, update, and delete
*/

-- Create site-content bucket
INSERT INTO storage.buckets (id, name, public) 
VALUES ('site-content', 'site-content', true)
ON CONFLICT (id) DO NOTHING;

-- Create policies for site-content bucket
CREATE POLICY "Authenticated users can upload site content images"
ON storage.objects FOR INSERT TO authenticated WITH CHECK (
  bucket_id = 'site-content' AND 
  auth.role() = 'authenticated'
);

CREATE POLICY "Anyone can view site content images"
ON storage.objects FOR SELECT TO public USING (
  bucket_id = 'site-content'
);

CREATE POLICY "Authenticated users can update site content images"
ON storage.objects FOR UPDATE TO authenticated USING (
  bucket_id = 'site-content' AND 
  auth.role() = 'authenticated'
);

CREATE POLICY "Authenticated users can delete site content images"
ON storage.objects FOR DELETE TO authenticated USING (
  bucket_id = 'site-content' AND 
  auth.role() = 'authenticated'
);