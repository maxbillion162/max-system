-- ══════════════════════════════════════════════════════════════════
-- Migration: add session_id to chat_messages
-- ══════════════════════════════════════════════════════════════════
-- The Archive page already reads chat_messages.session_id to group
-- conversations, but the column doesn't exist and nothing writes one.
-- Result: every web chat ever lands in one giant "session". This
-- migration adds the column and an index. Web chat passes a uuid per
-- page load; Telegram leaves it null (Telegram conversations are
-- continuous, not session-scoped).

alter table chat_messages
  add column if not exists session_id text;

create index if not exists chat_messages_session_id_idx
  on chat_messages(session_id);
