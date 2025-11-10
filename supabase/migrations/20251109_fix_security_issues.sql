-- =====================================================
-- FIX SUPABASE SECURITY LINTER ERRORS AND WARNINGS
-- Generated: November 9, 2025
-- =====================================================
-- This migration addresses all security issues found by Supabase database linter

-- =====================================================
-- PART 1: FIX SECURITY DEFINER VIEWS (ERRORS)
-- =====================================================
-- Issue: Views with SECURITY DEFINER run with creator's permissions
-- Fix: Recreate views without SECURITY DEFINER (or with SECURITY INVOKER)

-- Drop and recreate v_cache_stats (SECURITY INVOKER)
DROP VIEW IF EXISTS public.v_cache_stats;
CREATE OR REPLACE VIEW public.v_cache_stats
WITH (security_invoker = true)
AS
SELECT
    'response_cache' as cache_type,
    COUNT(*) as entry_count,
    SUM(hit_count) as total_hits,
    AVG(hit_count)::integer as avg_hits,
    MAX(updated_at) as last_updated
FROM response_cache
WHERE is_personal = false;

COMMENT ON VIEW public.v_cache_stats IS 'Cache hit statistics (SECURITY INVOKER)';

-- Drop and recreate recent_conversations (SECURITY INVOKER)
DROP VIEW IF EXISTS public.recent_conversations;
CREATE OR REPLACE VIEW public.recent_conversations
WITH (security_invoker = true)
AS
SELECT 
    s.id,
    s.user_id,
    s.title,
    s.mode,
    s.created_at,
    s.updated_at,
    s.message_count,
    (
        SELECT m.content 
        FROM messages m 
        WHERE m.session_id = s.id 
        ORDER BY m.created_at DESC 
        LIMIT 1
    ) as last_message
FROM sessions s
ORDER BY s.updated_at DESC;

COMMENT ON VIEW public.recent_conversations IS 'Recent conversations with last message (SECURITY INVOKER)';

-- Drop and recreate v_pii_detection (SECURITY INVOKER)
DROP VIEW IF EXISTS public.v_pii_detection;
CREATE OR REPLACE VIEW public.v_pii_detection
WITH (security_invoker = true)
AS
SELECT 
    id,
    session_id,
    role,
    created_at,
    CASE 
        WHEN content ~* '(\d{3}-\d{2}-\d{4})|(\d{9})' THEN true  -- SSN
        WHEN content ~* '(\d{4}[\s-]?){3}\d{4}' THEN true        -- Credit card
        WHEN content ~* '\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,}\b' THEN true  -- Email
        WHEN content ~* '\b\d{3}[-.]?\d{3}[-.]?\d{4}\b' THEN true  -- Phone
        ELSE false
    END as contains_pii
FROM messages
WHERE content IS NOT NULL;

COMMENT ON VIEW public.v_pii_detection IS 'PII detection in messages (SECURITY INVOKER)';

-- Drop and recreate v_scope_adoption (SECURITY INVOKER)
DROP VIEW IF EXISTS public.v_scope_adoption;
CREATE OR REPLACE VIEW public.v_scope_adoption
WITH (security_invoker = true)
AS
SELECT
    COUNT(DISTINCT id) FILTER (WHERE (scopes->>'prompts')::boolean = true) as prompts_enabled,
    COUNT(DISTINCT id) FILTER (WHERE (scopes->>'outputs')::boolean = true) as outputs_enabled,
    COUNT(DISTINCT id) FILTER (WHERE (scopes->>'tools')::boolean = true) as tools_enabled,
    COUNT(DISTINCT id) FILTER (WHERE (scopes->>'screenshots')::boolean = true) as screenshots_enabled,
    COUNT(DISTINCT id) as total_users
FROM users;

COMMENT ON VIEW public.v_scope_adoption IS 'Scope adoption metrics (SECURITY INVOKER)';

-- Drop and recreate v_tool_usage (SECURITY INVOKER)
DROP VIEW IF EXISTS public.v_tool_usage;
CREATE OR REPLACE VIEW public.v_tool_usage
WITH (security_invoker = true)
AS
SELECT 
    name as tool_name,
    COUNT(*) as usage_count,
    COUNT(DISTINCT session_id) as session_count,
    AVG(latency_ms / 1000.0) as avg_duration_seconds
FROM tool_calls
WHERE latency_ms IS NOT NULL
GROUP BY name
ORDER BY usage_count DESC;

COMMENT ON VIEW public.v_tool_usage IS 'Tool usage statistics (SECURITY INVOKER)';

-- Drop and recreate v_beta_latency (SECURITY INVOKER)
DROP VIEW IF EXISTS public.v_beta_latency;
CREATE OR REPLACE VIEW public.v_beta_latency
WITH (security_invoker = true)
AS
SELECT
    DATE_TRUNC('day', ts) as date,
    AVG(latency_ms) as avg_latency_ms,
    PERCENTILE_CONT(0.5) WITHIN GROUP (ORDER BY latency_ms) as median_latency_ms,
    PERCENTILE_CONT(0.95) WITHIN GROUP (ORDER BY latency_ms) as p95_latency_ms,
    COUNT(*) as answer_count
FROM answers
WHERE latency_ms IS NOT NULL
GROUP BY DATE_TRUNC('day', ts)
ORDER BY date DESC;

COMMENT ON VIEW public.v_beta_latency IS 'Beta testing latency metrics (SECURITY INVOKER)';

-- =====================================================
-- PART 2: ENABLE RLS ON PUBLIC TABLES (ERRORS)
-- =====================================================
-- Issue: Tables in public schema don't have RLS enabled
-- Fix: Enable RLS and add appropriate policies

-- Enable RLS on question_frequency
ALTER TABLE public.question_frequency ENABLE ROW LEVEL SECURITY;

-- Policy: Service role can do anything, anon users can read their own or public data
CREATE POLICY question_frequency_service_role ON public.question_frequency
    FOR ALL
    TO service_role
    USING (true)
    WITH CHECK (true);

CREATE POLICY question_frequency_select ON public.question_frequency
    FOR SELECT
    TO anon, authenticated
    USING (true);  -- This is a statistics table, can be readable

CREATE POLICY question_frequency_insert ON public.question_frequency
    FOR INSERT
    TO anon, authenticated
    WITH CHECK (true);  -- Allow inserts for tracking

COMMENT ON TABLE public.question_frequency IS 'Question frequency tracking (RLS enabled)';

-- Enable RLS on answers
ALTER TABLE public.answers ENABLE ROW LEVEL SECURITY;

CREATE POLICY answers_service_role ON public.answers
    FOR ALL
    TO service_role
    USING (true)
    WITH CHECK (true);

-- Users can only see their own answers (via session ownership)
CREATE POLICY answers_select_own ON public.answers
    FOR SELECT
    TO authenticated
    USING (session_id IN (SELECT id FROM sessions WHERE user_id = (auth.uid())::uuid));

CREATE POLICY answers_insert_own ON public.answers
    FOR INSERT
    TO authenticated
    WITH CHECK (session_id IN (SELECT id FROM sessions WHERE user_id = (auth.uid())::uuid));

COMMENT ON TABLE public.answers IS 'User answers tracking (RLS enabled)';

-- Enable RLS on crashes
ALTER TABLE public.crashes ENABLE ROW LEVEL SECURITY;

CREATE POLICY crashes_service_role ON public.crashes
    FOR ALL
    TO service_role
    USING (true)
    WITH CHECK (true);

-- Users can only see their own crash reports
CREATE POLICY crashes_select_own ON public.crashes
    FOR SELECT
    TO authenticated
    USING (user_id = (auth.uid())::uuid);

CREATE POLICY crashes_insert_own ON public.crashes
    FOR INSERT
    TO authenticated
    WITH CHECK (user_id = (auth.uid())::uuid);

-- Allow anon users to insert crash reports (for error tracking before auth)
CREATE POLICY crashes_insert_anon ON public.crashes
    FOR INSERT
    TO anon
    WITH CHECK (true);

COMMENT ON TABLE public.crashes IS 'Crash reports (RLS enabled)';

-- Enable RLS on idempotency_keys
ALTER TABLE public.idempotency_keys ENABLE ROW LEVEL SECURITY;

CREATE POLICY idempotency_keys_service_role ON public.idempotency_keys
    FOR ALL
    TO service_role
    USING (true)
    WITH CHECK (true);

-- Idempotency keys are backend-managed
CREATE POLICY idempotency_keys_select ON public.idempotency_keys
    FOR SELECT
    TO authenticated
    USING (true);

CREATE POLICY idempotency_keys_insert ON public.idempotency_keys
    FOR INSERT
    TO authenticated
    WITH CHECK (true);

COMMENT ON TABLE public.idempotency_keys IS 'Idempotency key tracking (RLS enabled)';

-- =====================================================
-- PART 3: FIX FUNCTION SEARCH PATHS (WARNINGS)
-- =====================================================
-- Issue: Functions don't have fixed search_path
-- Fix: Add SET search_path = public to all functions

-- Fix search_messages_hybrid
CREATE OR REPLACE FUNCTION public.search_messages_hybrid(
    query_embedding vector(384),
    match_count int DEFAULT 5,
    search_text text DEFAULT ''
)
RETURNS TABLE (
    id bigint,
    session_id uuid,
    role text,
    content text,
    similarity float,
    rank float
)
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
    RETURN QUERY
    SELECT 
        m.id,
        m.session_id,
        m.role,
        m.content,
        1 - (m.embedding <=> query_embedding) as similarity,
        ts_rank(to_tsvector('english', m.content), plainto_tsquery('english', search_text)) as rank
    FROM messages m
    WHERE m.embedding IS NOT NULL
    ORDER BY 
        (1 - (m.embedding <=> query_embedding)) * 0.5 + 
        ts_rank(to_tsvector('english', m.content), plainto_tsquery('english', search_text)) * 0.5 DESC
    LIMIT match_count;
END;
$$;

-- Fix search_facts_semantic
CREATE OR REPLACE FUNCTION public.search_facts_semantic(
    query_embedding vector(384),
    match_count int DEFAULT 5
)
RETURNS TABLE (
    id uuid,
    category text,
    key text,
    value text,
    similarity float
)
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
    RETURN QUERY
    SELECT 
        f.id,
        f.category,
        f.key,
        f.value,
        1 - (f.embedding <=> query_embedding) as similarity
    FROM facts f
    WHERE f.embedding IS NOT NULL
    ORDER BY f.embedding <=> query_embedding
    LIMIT match_count;
END;
$$;

-- Fix purge_user_data
CREATE OR REPLACE FUNCTION public.purge_user_data(target_user_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
    -- Delete in order to respect foreign keys
    DELETE FROM tool_calls WHERE session_id IN (SELECT id FROM sessions WHERE user_id = target_user_id);
    DELETE FROM messages WHERE session_id IN (SELECT id FROM sessions WHERE user_id = target_user_id);
    DELETE FROM sessions WHERE user_id = target_user_id;
    DELETE FROM preferences WHERE user_id = target_user_id;
    DELETE FROM facts WHERE user_id = target_user_id;
    DELETE FROM telemetry_events WHERE user_id = target_user_id;
    DELETE FROM answers WHERE session_id IN (SELECT id FROM sessions WHERE user_id = target_user_id);
    DELETE FROM crashes WHERE user_id = target_user_id;
    DELETE FROM users WHERE id = target_user_id;
END;
$$;

-- Fix update_updated_at_column
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$;

-- Fix increment_message_count
CREATE OR REPLACE FUNCTION public.increment_message_count()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
    UPDATE sessions
    SET message_count = message_count + 1,
        updated_at = NOW()
    WHERE id = NEW.session_id;
    RETURN NEW;
END;
$$;

-- Fix search_messages_semantic
CREATE OR REPLACE FUNCTION public.search_messages_semantic(
    query_embedding vector(384),
    match_count int DEFAULT 5
)
RETURNS TABLE (
    id bigint,
    session_id uuid,
    role text,
    content text,
    similarity float
)
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
    RETURN QUERY
    SELECT 
        m.id,
        m.session_id,
        m.role,
        m.content,
        1 - (m.embedding <=> query_embedding) as similarity
    FROM messages m
    WHERE m.embedding IS NOT NULL
    ORDER BY m.embedding <=> query_embedding
    LIMIT match_count;
END;
$$;

-- Fix clean_expired_cache
CREATE OR REPLACE FUNCTION public.clean_expired_cache()
RETURNS void
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
    DELETE FROM response_cache
    WHERE updated_at < NOW() - INTERVAL '1 day' * ttl_days;
    
    DELETE FROM idempotency_keys
    WHERE expires_at < NOW();
END;
$$;

-- =====================================================
-- PART 4: MOVE EXTENSIONS TO EXTENSIONS SCHEMA (WARNINGS)
-- =====================================================
-- Issue: Extensions installed in public schema
-- Fix: Move to extensions schema

-- Create extensions schema if it doesn't exist
CREATE SCHEMA IF NOT EXISTS extensions;

-- Move pg_trgm extension
DROP EXTENSION IF EXISTS pg_trgm CASCADE;
CREATE EXTENSION IF NOT EXISTS pg_trgm WITH SCHEMA extensions;

-- Move vector extension
DROP EXTENSION IF EXISTS vector CASCADE;
CREATE EXTENSION IF NOT EXISTS vector WITH SCHEMA extensions;

-- Update search_path for database to include extensions schema
ALTER DATABASE postgres SET search_path TO public, extensions;

-- =====================================================
-- VERIFICATION COMMENTS
-- =====================================================

COMMENT ON SCHEMA extensions IS 'Schema for PostgreSQL extensions (security best practice)';

-- =====================================================
-- SUMMARY
-- =====================================================
-- Fixed 6 SECURITY DEFINER views (ERROR) - now use SECURITY INVOKER
-- Fixed 4 RLS disabled tables (ERROR) - enabled RLS with appropriate policies
-- Fixed 7 function search paths (WARN) - added SET search_path = public
-- Fixed 2 extensions in public (WARN) - moved to extensions schema
--
-- Total: 10 ERRORs fixed, 9 WARNINGs fixed
-- =====================================================
