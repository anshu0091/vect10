-- Allow users to delete their own carbon credit holdings (e.g. after selling all)
CREATE POLICY "Users can delete their own carbon credits"
  ON user_carbon_credits
  FOR DELETE
  TO authenticated
  USING (auth.uid() = user_id);
