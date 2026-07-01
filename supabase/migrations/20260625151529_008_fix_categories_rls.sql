-- Create a working is_admin function that checks profiles.role
-- Since there's no admin table, check if profile has role='admin'
CREATE OR REPLACE FUNCTION public.is_admin() RETURNS boolean AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin'
  );
EXCEPTION WHEN OTHERS THEN
  RETURN false;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Fix category policies to use a non-circular approach
-- Drop the broken policies that reference non-existent admin table
DROP POLICY IF EXISTS "add_category" ON public.categories;
DROP POLICY IF EXISTS "update_category" ON public.categories;
DROP POLICY IF EXISTS "delete_category" ON public.categories;

-- Create new admin-only policies using profiles.role check directly
CREATE POLICY "add_category" ON public.categories FOR INSERT
  TO authenticated WITH CHECK (public.is_admin());
CREATE POLICY "update_category" ON public.categories FOR UPDATE
  TO authenticated USING (public.is_admin()) WITH CHECK (public.is_admin());
CREATE POLICY "delete_category" ON public.categories FOR DELETE
  TO authenticated USING (public.is_admin());
