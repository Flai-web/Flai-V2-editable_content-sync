/*
  # Add portfolio bucket and storage policies

  1. Changes
    - Create portfolio bucket for image storage
    - Add storage policies for authenticated users
*/

-- Enable storage
INSERT INTO storage.buckets (id, name, public) 
VALUES ('portfolio', 'portfolio', true);

-- Create policies for portfolio bucket
CREATE POLICY "Authenticated users can upload portfolio images"
ON storage.objects FOR INSERT TO authenticated WITH CHECK (
  bucket_id = 'portfolio' AND 
  auth.role() = 'authenticated'
);

CREATE POLICY "Anyone can view portfolio images"
ON storage.objects FOR SELECT TO public USING (
  bucket_id = 'portfolio'
);

CREATE POLICY "Users can update their own portfolio images"
ON storage.objects FOR UPDATE TO authenticated USING (
  bucket_id = 'portfolio' AND 
  owner = auth.uid()
);

CREATE POLICY "Users can delete their own portfolio images"
ON storage.objects FOR DELETE TO authenticated USING (
  bucket_id = 'portfolio' AND 
  owner = auth.uid()
);