/*
  # Fix portfolio tables and policies

  1. Changes
    - Drop existing objects before recreating
    - Ensure clean slate for portfolio functionality
*/

-- Drop existing objects
DROP VIEW IF EXISTS portfolio_images_with_reactions;
DROP TRIGGER IF EXISTS on_reaction_changed ON portfolio_reactions;
DROP FUNCTION IF EXISTS update_reaction_counts();
DROP POLICY IF EXISTS "Anyone can view portfolio images" ON portfolio_images;
DROP POLICY IF EXISTS "Admins can manage portfolio images" ON portfolio_images;
DROP POLICY IF EXISTS "Anyone can view comments" ON portfolio_comments;
DROP POLICY IF EXISTS "Authenticated users can create comments" ON portfolio_comments;
DROP POLICY IF EXISTS "Anyone can view reactions" ON portfolio_reactions;
DROP POLICY IF EXISTS "Authenticated users can react once per image" ON portfolio_reactions;
DROP POLICY IF EXISTS "Users can update their own reactions" ON portfolio_reactions;
DROP POLICY IF EXISTS "Users can delete their own reactions" ON portfolio_reactions;
DROP TABLE IF EXISTS portfolio_reactions;
DROP TABLE IF EXISTS portfolio_comments;
DROP TABLE IF EXISTS portfolio_images;

-- Create portfolio_images table
CREATE TABLE IF NOT EXISTS portfolio_images (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title TEXT NOT NULL,
  image_url TEXT NOT NULL,
  likes INTEGER DEFAULT 0,
  dislikes INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Create portfolio_comments table
CREATE TABLE IF NOT EXISTS portfolio_comments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  image_id UUID REFERENCES portfolio_images(id) ON DELETE CASCADE,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  comment TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Create portfolio_reactions table
CREATE TABLE IF NOT EXISTS portfolio_reactions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  image_id UUID REFERENCES portfolio_images(id) ON DELETE CASCADE,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  reaction TEXT NOT NULL CHECK (reaction IN ('like', 'dislike')),
  created_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(image_id, user_id)
);

-- Enable RLS
ALTER TABLE portfolio_images ENABLE ROW LEVEL SECURITY;
ALTER TABLE portfolio_comments ENABLE ROW LEVEL SECURITY;
ALTER TABLE portfolio_reactions ENABLE ROW LEVEL SECURITY;

-- Policies for portfolio_images
CREATE POLICY "Anyone can view portfolio images"
  ON portfolio_images FOR SELECT
  TO public
  USING (true);

CREATE POLICY "Admins can manage portfolio images"
  ON portfolio_images FOR ALL
  TO authenticated
  USING (EXISTS (
    SELECT 1 FROM profiles
    WHERE profiles.id = auth.uid()
    AND profiles.is_admin = true
  ));

-- Policies for portfolio_comments
CREATE POLICY "Anyone can view comments"
  ON portfolio_comments FOR SELECT
  TO public
  USING (true);

CREATE POLICY "Authenticated users can create comments"
  ON portfolio_comments FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

-- Policies for portfolio_reactions
CREATE POLICY "Anyone can view reactions"
  ON portfolio_reactions FOR SELECT
  TO public
  USING (true);

CREATE POLICY "Authenticated users can react once per image"
  ON portfolio_reactions FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own reactions"
  ON portfolio_reactions FOR UPDATE
  TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own reactions"
  ON portfolio_reactions FOR DELETE
  TO authenticated
  USING (auth.uid() = user_id);

-- Function to update reaction counts
CREATE OR REPLACE FUNCTION update_reaction_counts()
RETURNS TRIGGER AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    IF NEW.reaction = 'like' THEN
      UPDATE portfolio_images SET likes = likes + 1 WHERE id = NEW.image_id;
    ELSE
      UPDATE portfolio_images SET dislikes = dislikes + 1 WHERE id = NEW.image_id;
    END IF;
  ELSIF TG_OP = 'DELETE' THEN
    IF OLD.reaction = 'like' THEN
      UPDATE portfolio_images SET likes = likes - 1 WHERE id = OLD.image_id;
    ELSE
      UPDATE portfolio_images SET dislikes = dislikes - 1 WHERE id = OLD.image_id;
    END IF;
  ELSIF TG_OP = 'UPDATE' AND OLD.reaction != NEW.reaction THEN
    IF OLD.reaction = 'like' THEN
      UPDATE portfolio_images SET 
        likes = likes - 1,
        dislikes = dislikes + 1
      WHERE id = NEW.image_id;
    ELSE
      UPDATE portfolio_images SET 
        likes = likes + 1,
        dislikes = dislikes - 1
      WHERE id = NEW.image_id;
    END IF;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Triggers for reaction counts
CREATE TRIGGER on_reaction_changed
  AFTER INSERT OR UPDATE OR DELETE ON portfolio_reactions
  FOR EACH ROW EXECUTE FUNCTION update_reaction_counts();

-- Create view for portfolio images with user reaction status
CREATE OR REPLACE VIEW portfolio_images_with_reactions AS
SELECT 
  pi.*,
  pr.reaction as user_reaction
FROM portfolio_images pi
LEFT JOIN portfolio_reactions pr ON 
  pi.id = pr.image_id AND 
  pr.user_id = auth.uid();

-- Grant access to the view
GRANT SELECT ON portfolio_images_with_reactions TO public;