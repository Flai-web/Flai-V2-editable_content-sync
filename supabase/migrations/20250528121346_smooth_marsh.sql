/*
  # Add product links functionality

  1. Changes
    - Add links array to products table
    - Update existing products
*/

ALTER TABLE products ADD COLUMN IF NOT EXISTS links JSONB[] DEFAULT '{}';

-- Add constraint to limit number of links
CREATE OR REPLACE FUNCTION check_links_limit() 
RETURNS TRIGGER AS $$
BEGIN
  IF array_length(NEW.links, 1) > 4 THEN
    RAISE EXCEPTION 'Products cannot have more than 4 links';
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS enforce_links_limit ON products;
CREATE TRIGGER enforce_links_limit
  BEFORE INSERT OR UPDATE ON products
  FOR EACH ROW
  EXECUTE FUNCTION check_links_limit();