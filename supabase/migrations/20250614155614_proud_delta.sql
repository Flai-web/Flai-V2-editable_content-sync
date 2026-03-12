/*
  # Add rating images storage bucket

  1. Changes
    - Create rating-images bucket for storing rating images
    - Add storage policies for authenticated users
    - Set proper permissions for upload, view, update, and delete
*/

-- Create rating-images bucket
INSERT INTO storage.buckets (id, name, public) 
VALUES ('rating-images', 'rating-images', true)
ON CONFLICT (id) DO NOTHING;

-- Create policies for rating-images bucket
CREATE POLICY "Authenticated users can upload rating images"
ON storage.objects FOR INSERT TO authenticated WITH CHECK (
  bucket_id = 'rating-images' AND 
  auth.role() = 'authenticated'
);

CREATE POLICY "Anyone can view rating images"
ON storage.objects FOR SELECT TO public USING (
  bucket_id = 'rating-images'
);

CREATE POLICY "Users can update their own rating images"
ON storage.objects FOR UPDATE TO authenticated USING (
  bucket_id = 'rating-images' AND 
  owner = auth.uid()
);

CREATE POLICY "Users can delete their own rating images"
ON storage.objects FOR DELETE TO authenticated USING (
  bucket_id = 'rating-images' AND 
  owner = auth.uid()
);