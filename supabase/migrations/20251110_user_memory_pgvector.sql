-- Migration: user_memory table and pgvector setup
-- Date: 2025-11-10

-- Enable required extensions (safe if already enabled)
CREATE EXTENSION IF NOT EXISTS pgcrypto;
CREATE EXTENSION IF NOT EXISTS vector;

-- Create user_memory table for semantic memory
CREATE TABLE IF NOT EXISTS public.user_memory (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  project_id UUID NULL,
  conversation_id UUID NULL,
  source_type TEXT,
  created_at timestamptz DEFAULT now(),
  last_accessed_at timestamptz,
  raw_text TEXT,
  pre_summary TEXT,
  metadata JSONB,
  embedding vector(1536),
  embedding_model TEXT DEFAULT 'text-embedding-3-small',
  embedding_version TEXT DEFAULT 'v1'
);

-- Helpful btree indexes
CREATE INDEX IF NOT EXISTS idx_user_memory_user ON public.user_memory (user_id);
CREATE INDEX IF NOT EXISTS idx_user_memory_proj ON public.user_memory (project_id);

-- Build IVFFLAT index for cosine distance. Recommended to build after initial seeding.
DO $$
BEGIN
  -- Create index if it doesn't exist yet (pg 12+ supports IF NOT EXISTS for btree but not for all access methods)
  IF NOT EXISTS (
    SELECT 1 FROM pg_class c
    JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE c.relkind = 'i'
      AND c.relname = 'idx_user_memory_embedding'
      AND n.nspname = 'public'
  ) THEN
    EXECUTE 'CREATE INDEX idx_user_memory_embedding ON public.user_memory USING ivfflat (embedding vector_cosine_ops) WITH (lists = 100)';
  END IF;
END$$;

-- Note: Consider increasing ivfflat.probes at query time for better recall at the cost of latency.
-- Example query (server-side):
--   SET LOCAL ivfflat.probes = 10;  -- tune per environment
--   SELECT id, 1 - (embedding <=> :query_vec) AS sim
--   FROM public.user_memory
--   WHERE user_id = :user_id AND (:project_id IS NULL OR project_id = :project_id)
--   ORDER BY embedding <-> :query_vec
--   LIMIT 50;
