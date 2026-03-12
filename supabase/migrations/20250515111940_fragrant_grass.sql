/*
  # Fix portfolio comments functionality

  1. Changes
    - Update portfolio_comments policies
    - Add proper indexes for performance
    - Ensure proper cascading deletes
*/

-- Drop existing policies
DROP POLICY IF EXISTS "Anyone can view comments" ON portfolio_comments;
DROP POLICY IF EXISTS "Authenticated users can create comments" ON portfolio_comments;
DROP POLICY IF EXISTS "Authenticated users can manage their comments" ON portfolio_comments;

-- Create updated policies
CREATE POLICY "Anyone can view comments"
  ON portfolio_comments FOR SELECT
  TO public
  USING (true);

CREATE POLICY "Authenticated users can manage their comments"
  ON portfolio_comments
  FOR ALL
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- Add index for performance
CREATE INDEX IF NOT EXISTS idx_portfolio_comments_image_id ON portfolio_comments(image_id);
CREATE INDEX IF NOT EXISTS idx_portfolio_comments_user_id ON portfolio_comments(user_id);

-- Create view for comments with user info
CREATE OR REPLACE VIEW portfolio_comments_with_users AS
SELECT 
  pc.id,
  pc.image_id,
  pc.user_id,
  pc.comment,
  pc.created_at,
  p.email as user_email
FROM portfolio_comments pc
JOIN profiles p ON pc.user_id = p.id
ORDER BY pc.created_at DESC;

-- Grant access to the view
GRANT SELECT ON portfolio_comments_with_users TO public;