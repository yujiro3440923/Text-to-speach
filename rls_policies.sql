-- Enable RLS
ALTER TABLE histories ENABLE ROW LEVEL SECURITY;

-- Create Policy for Select
CREATE POLICY "Users can view their own history"
ON histories FOR SELECT
USING (auth.uid() = user_id);

-- Create Policy for Insert
CREATE POLICY "Users can insert their own history"
ON histories FOR INSERT
WITH CHECK (auth.uid() = user_id);

-- Create Policy for Update (if needed)
CREATE POLICY "Users can update their own history"
ON histories FOR UPDATE
USING (auth.uid() = user_id);

-- Create Policy for Delete (if needed)
CREATE POLICY "Users can delete their own history"
ON histories FOR DELETE
USING (auth.uid() = user_id);

-- Organizations table (Read-only for now, or based on membership)
-- Assuming organizations has a link to users or users have org_id
-- For now, if we just use a demo org ID as per the code, we might need a policy
-- to allow authenticated users to read the demo org to get the API key?
-- Wait, the API key is read on the SERVER side (API Route) using the service role or admin access?
-- Actually, the API route uses `createClient` (server component version) which uses the standard key.
-- Standard key (anon) adheres to RLS.
-- If the API route needs to read the API Key, it should probably use the Service Role Key or
-- the RLS should allow reading.
-- However, exposing API Keys to the client (even via RLS) is risky if the client can query the table.
-- The API route `app/api/check-text/route.ts` creates a client with:
-- process.env.NEXT_PUBLIC_SUPABASE_URL!
-- process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
-- This means it operates as the LOGGED IN USER.
-- So the logged in user MUST have access to the organizations table to read the API Key.
-- THIS IS A SECURITY RISK if the user can use the anon key on the client to read the API Key.
-- Use Service Role Key in API routes for reading sensitive configs!
-- I will add a todo to fix the API route to use Service Role or better yet, move keys to Env Vars if possible,
-- but the prompt says Keys are in `organizations` table.
-- So I should recommend using Service Role Client in the API Route.
-- I'll note this for the Phase 2/3 refactoring.
