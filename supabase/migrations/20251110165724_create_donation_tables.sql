/*
  # Create Donation System Tables

  1. New Tables
    - `donation_links`
      - `id` (uuid, primary key)
      - `title` (text)
      - `is_active` (boolean)
      - `created_at` (timestamp)
      - `created_by` (uuid, admin user reference)
      - `total_amount` (integer, in DKK)
      - `donation_count` (integer)
    
    - `donations`
      - `id` (uuid, primary key)
      - `donation_link_id` (uuid, foreign key)
      - `amount` (integer, in DKK)
      - `payment_status` (text)
      - `payment_intent_id` (text)
      - `created_at` (timestamp)

  2. Security
    - Enable RLS on both tables
    - Public read access to active donation links
    - Insert access for donations via public API
    - Admin-only write access to donation_links
*/

CREATE TABLE IF NOT EXISTS donation_links (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  title text NOT NULL,
  is_active boolean DEFAULT true,
  total_amount integer DEFAULT 0,
  donation_count integer DEFAULT 0,
  created_by uuid,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

CREATE TABLE IF NOT EXISTS donations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  donation_link_id uuid NOT NULL REFERENCES donation_links(id) ON DELETE CASCADE,
  amount integer NOT NULL,
  payment_status text DEFAULT 'pending',
  payment_intent_id text,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE donation_links ENABLE ROW LEVEL SECURITY;
ALTER TABLE donations ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Donation links are viewable by everyone"
  ON donation_links
  FOR SELECT
  USING (is_active = true);

CREATE POLICY "Admins can view all donation links"
  ON donation_links
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles 
      WHERE profiles.id = auth.uid() AND profiles.is_admin = true
    )
  );

CREATE POLICY "Admins can create donation links"
  ON donation_links
  FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM profiles 
      WHERE profiles.id = auth.uid() AND profiles.is_admin = true
    )
  );

CREATE POLICY "Admins can update donation links"
  ON donation_links
  FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles 
      WHERE profiles.id = auth.uid() AND profiles.is_admin = true
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM profiles 
      WHERE profiles.id = auth.uid() AND profiles.is_admin = true
    )
  );

CREATE POLICY "Admins can delete donation links"
  ON donation_links
  FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles 
      WHERE profiles.id = auth.uid() AND profiles.is_admin = true
    )
  );

CREATE POLICY "Public can view donations"
  ON donations
  FOR SELECT
  USING (true);

CREATE POLICY "Public can create donations"
  ON donations
  FOR INSERT
  WITH CHECK (true);

CREATE INDEX IF NOT EXISTS idx_donation_links_active ON donation_links(is_active);
CREATE INDEX IF NOT EXISTS idx_donations_link_id ON donations(donation_link_id);
CREATE INDEX IF NOT EXISTS idx_donations_payment_status ON donations(payment_status);
CREATE INDEX IF NOT EXISTS idx_donations_created_at ON donations(created_at);
