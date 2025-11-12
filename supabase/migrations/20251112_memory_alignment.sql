-- Memory schema alignment for backend API
-- Date: 2025-11-12

-- Ensure facts table matches backend expectations
ALTER TABLE public.facts
    ADD COLUMN IF NOT EXISTS pinned BOOLEAN DEFAULT false,
    ADD COLUMN IF NOT EXISTS tombstoned BOOLEAN DEFAULT false,
    ADD COLUMN IF NOT EXISTS scope TEXT DEFAULT 'default',
    ADD COLUMN IF NOT EXISTS source_msg_id UUID,
    ADD COLUMN IF NOT EXISTS semantic_key TEXT,
    ADD COLUMN IF NOT EXISTS origin TEXT DEFAULT 'MODEL_INFERRED',
    ADD COLUMN IF NOT EXISTS priority_score REAL DEFAULT 0.5,
    ADD COLUMN IF NOT EXISTS use_count INTEGER DEFAULT 0,
    ADD COLUMN IF NOT EXISTS last_used_at TIMESTAMPTZ,
    ADD COLUMN IF NOT EXISTS last_boost_at TIMESTAMPTZ,
    ADD COLUMN IF NOT EXISTS is_current BOOLEAN DEFAULT true;

-- Maintain metadata jsonb for forward compatibility
ALTER TABLE public.facts
    ALTER COLUMN metadata SET DEFAULT '{}'::jsonb;

CREATE INDEX IF NOT EXISTS idx_facts_user_scope
    ON public.facts (user_id, scope, updated_at DESC);

-- Messages: track client UUID for compatibility with FastAPI models
ALTER TABLE public.messages
    ADD COLUMN IF NOT EXISTS client_uuid UUID DEFAULT gen_random_uuid(),
    ADD COLUMN IF NOT EXISTS scope TEXT DEFAULT 'default';

CREATE UNIQUE INDEX IF NOT EXISTS idx_messages_client_uuid
    ON public.messages (client_uuid);
