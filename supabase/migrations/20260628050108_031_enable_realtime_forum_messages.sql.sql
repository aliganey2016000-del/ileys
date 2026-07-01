-- Enable realtime for forum_messages table
-- The table was missing from the supabase_realtime publication,
-- so new INSERT/UPDATE/DELETE events were not pushed to subscribed clients.
ALTER PUBLICATION supabase_realtime ADD TABLE forum_messages;
