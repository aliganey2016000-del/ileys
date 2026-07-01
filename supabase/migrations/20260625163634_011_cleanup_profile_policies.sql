-- Drop the overly permissive policy
DROP POLICY IF EXISTS insert_via_trigger ON public.profiles;

-- Grant insert permission to service_role for the trigger
-- The trigger runs as SECURITY DEFINER, so it bypasses RLS anyway
-- But let's ensure the authenticated policy allows self-inserts

-- Update to allow both authenticated users inserting their own profile
-- AND the system trigger (which runs as the postgres superuser)
-- The trigger uses SECURITY DEFINER so it bypasses RLS, no extra policy needed