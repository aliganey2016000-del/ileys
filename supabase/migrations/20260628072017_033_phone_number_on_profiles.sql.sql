/*
# Add phone_number to profiles

## Purpose
Students (and all users) can now register their mobile number so the platform
can send them automated SMS notifications via Africa's Talking.

## Changes

### Modified table: `profiles`
- `phone_number` (text, nullable) — E.164 format preferred (+252xxxxxxxxx for Somalia).
  Nullable so existing accounts are not broken.
- `sms_notifications_enabled` (boolean, not null, default true) — user opt-in flag.
  When false, no SMS is sent to that user regardless of event type.

## Security
No new policies needed — the existing per-user RLS on `profiles` already covers
select/update of the new columns.
*/

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'profiles' AND column_name = 'phone_number'
  ) THEN
    ALTER TABLE profiles ADD COLUMN phone_number text;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'profiles' AND column_name = 'sms_notifications_enabled'
  ) THEN
    ALTER TABLE profiles ADD COLUMN sms_notifications_enabled boolean NOT NULL DEFAULT true;
  END IF;
END $$;
