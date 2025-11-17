-- Restore semantic search functions and supporting structures
-- Date: 2025-11-16

-- Ensure extensions and schemas exist
CREATE SCHEMA IF NOT EXISTS extensions;
CREATE EXTENSION IF NOT EXISTS pg_trgm WITH SCHEMA extensions;
CREATE EXTENSION IF NOT EXISTS vector WITH SCHEMA extensions;

-- Guarantee embedding columns exist on primary memory tables
ALTER TABLE IF EXISTS public.messages
    ADD COLUMN IF NOT EXISTS embedding vector(384);

ALTER TABLE IF EXISTS public.facts
    ADD COLUMN IF NOT EXISTS embedding vector(384);

-- Helpful indexes for vector search (safe if already created)
CREATE INDEX IF NOT EXISTS idx_messages_embedding
    ON public.messages USING hnsw (embedding vector_cosine_ops);

CREATE INDEX IF NOT EXISTS idx_facts_embedding
    ON public.facts USING hnsw (embedding vector_cosine_ops);

-- Semantic search for messages
CREATE OR REPLACE FUNCTION public.search_messages_semantic(
    query_embedding vector(384),
    target_user_id uuid,
    similarity_threshold float DEFAULT 0.7,
    max_results int DEFAULT 10
)
RETURNS TABLE (
    message_id bigint,
    session_id uuid,
    role text,
    content text,
    similarity float,
    created_at timestamptz
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
        1 - (m.embedding <=> query_embedding) AS similarity,
        m.created_at
    FROM public.messages m
    JOIN public.sessions s ON s.id = m.session_id
    WHERE s.user_id = target_user_id
      AND m.embedding IS NOT NULL
      AND 1 - (m.embedding <=> query_embedding) >= similarity_threshold
    ORDER BY m.embedding <=> query_embedding
    LIMIT max_results;
END;
$$;

-- Semantic search for facts
CREATE OR REPLACE FUNCTION public.search_facts_semantic(
    query_embedding vector(384),
    target_user_id uuid,
    similarity_threshold float DEFAULT 0.7,
    max_results int DEFAULT 10
)
RETURNS TABLE (
    fact_id uuid,
    category text,
    key text,
    value text,
    similarity float,
    confidence real
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
        1 - (f.embedding <=> query_embedding) AS similarity,
        f.confidence
    FROM public.facts f
    WHERE f.user_id = target_user_id
      AND f.embedding IS NOT NULL
      AND 1 - (f.embedding <=> query_embedding) >= similarity_threshold
    ORDER BY f.embedding <=> query_embedding
    LIMIT max_results;
END;
$$;

-- Hybrid keyword + semantic search for conversations
CREATE OR REPLACE FUNCTION public.search_messages_hybrid(
    search_query text,
    query_embedding vector(384),
    target_user_id uuid,
    max_results int DEFAULT 10
)
RETURNS TABLE (
    message_id bigint,
    session_id uuid,
    role text,
    content text,
    relevance_score float,
    match_type text,
    created_at timestamptz
)
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
    RETURN QUERY
    WITH keyword_matches AS (
        SELECT
            m.id,
            m.session_id,
            m.role,
            m.content,
            ts_rank(
                to_tsvector('english', COALESCE(m.content, '')),
                plainto_tsquery('english', search_query)
            ) AS kw_score,
            'keyword' AS match_type,
            m.created_at
        FROM public.messages m
        JOIN public.sessions s ON s.id = m.session_id
        WHERE s.user_id = target_user_id
          AND to_tsvector('english', COALESCE(m.content, '')) @@ plainto_tsquery('english', search_query)
        ORDER BY kw_score DESC
        LIMIT max_results
    ),
    semantic_matches AS (
        SELECT
            m.id,
            m.session_id,
            m.role,
            m.content,
            1 - (m.embedding <=> query_embedding) AS sem_score,
            'semantic' AS match_type,
            m.created_at
        FROM public.messages m
        JOIN public.sessions s ON s.id = m.session_id
        WHERE s.user_id = target_user_id
          AND m.embedding IS NOT NULL
        ORDER BY m.embedding <=> query_embedding
        LIMIT max_results
    )
    SELECT
        id,
        session_id,
        role,
        content,
        COALESCE(kw_score, sem_score) AS relevance_score,
        match_type,
        created_at
    FROM (
        SELECT *, kw_score, NULL::float AS sem_score FROM keyword_matches
        UNION ALL
        SELECT *, NULL::float AS kw_score, sem_score FROM semantic_matches
    ) AS unified;
END;
$$;
