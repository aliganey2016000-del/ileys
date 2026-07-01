/*
# Add admin read policy to course_completions

1. Security
- Adds a SELECT policy so admin users can read ALL course_completions rows
  (not just their own). The existing `select_own_completions` policy only
  lets a student read their own completions, which hides the data from
  the Admin Overview dashboard.
- The new policy uses the same admin-detection pattern used across the
  schema: `exists (select 1 from profiles where id = auth.uid() and role = 'admin')`.
- Idempotent: drops the policy first if it already exists.
*/

DROP POLICY IF EXISTS "admin_select_all_completions" ON public.course_completions;
CREATE POLICY "admin_select_all_completions"
ON public.course_completions FOR SELECT
TO authenticated
USING (
  exists (select 1 from public.profiles where id = auth.uid() and role = 'admin')
);
