/*
  # Content Management System

  1. New Tables
    - `site_content` - Store all editable content (text, images, colors)
      - `id` (uuid, primary key)
      - `key` (text, unique) - Unique identifier for content
      - `type` (text) - 'text', 'image', 'color'
      - `value` (text) - The actual content value
      - `description` (text) - Human readable description
      - `category` (text) - Group content by category
      - `created_at` (timestamp)
      - `updated_at` (timestamp)

  2. Security
    - Enable RLS on site_content table
    - Add policies for admin users and public read access
*/

CREATE TABLE IF NOT EXISTS site_content (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  key TEXT NOT NULL UNIQUE,
  type TEXT NOT NULL CHECK (type IN ('text', 'image', 'color')),
  value TEXT NOT NULL,
  description TEXT NOT NULL,
  category TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Enable RLS
ALTER TABLE site_content ENABLE ROW LEVEL SECURITY;

-- Policies for site_content
CREATE POLICY "Anyone can view site content"
  ON site_content
  FOR SELECT
  TO public
  USING (true);

CREATE POLICY "Admins can manage site content"
  ON site_content
  FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.is_admin = true
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.is_admin = true
    )
  );

-- Trigger to update the updated_at column
CREATE TRIGGER update_site_content_updated_at
    BEFORE UPDATE ON site_content
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- Insert default content
INSERT INTO site_content (key, type, value, description, category) VALUES
-- Colors
('primary-color', 'color', '#0F52BA', 'Primary brand color', 'colors'),
('secondary-color', 'color', '#64A0FF', 'Secondary brand color', 'colors'),
('accent-color', 'color', '#FF6B35', 'Accent color', 'colors'),
('success-color', 'color', '#10B981', 'Success color', 'colors'),
('warning-color', 'color', '#FBBF24', 'Warning color', 'colors'),
('error-color', 'color', '#EF4444', 'Error color', 'colors'),

-- Hero Section
('hero-title', 'text', 'Dronefotografering i Danmark', 'Hero section main title', 'hero'),
('hero-subtitle', 'text', 'Specialiseret i luftfoto og videooptagelser i Danmark', 'Hero section subtitle', 'hero'),
('hero-background', 'image', 'https://pbqeljimuerxatrtmgsn.supabase.co/storage/v1/object/public/portfolio/0.12330272945400556.webp', 'Hero section background image', 'hero'),

-- Navigation
('site-logo', 'image', '/logo.png', 'Site logo', 'navigation'),
('site-name', 'text', 'Flai.dk', 'Site name', 'navigation'),

-- Footer
('footer-description', 'text', 'luftoptagelser og dronefotografering. Vi bringer dine ideer til live', 'Footer description', 'footer'),
('contact-email', 'text', 'mail@flai.dk', 'Contact email', 'contact'),
('contact-phone', 'text', '+45 27 29 21 99', 'Contact phone', 'contact'),
('contact-hours', 'text', 'Mandag - Fredag 13.35 - 20.00 Lørdag - Søndag 9.00 - 20.30', 'Contact hours', 'contact'),

-- About Section
('about-title', 'text', 'Mød Felix', 'About section title', 'about'),
('about-subtitle', 'text', '12 årige Felix er vores dronepilot med passion for luftfotografering.', 'About section subtitle', 'about'),
('about-image', 'image', '/Felix.png', 'About section image', 'about'),

-- Services Section
('services-title', 'text', 'Vores Tjenester', 'Services page title', 'services'),
('services-subtitle', 'text', 'Udforsk vores udvalg af optagelser eller billeder og find den perfekte løsning til dit næste projekt.', 'Services page subtitle', 'services'),

-- Call to Action
('cta-title', 'text', 'Klar til at se din verden fra oven?', 'Call to action title', 'cta'),
('cta-subtitle', 'text', 'Book din droneoptagelse i dag og få luftbilleder til konkurrencedygtige priser.', 'Call to action subtitle', 'cta');