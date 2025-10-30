-- ============================================
-- pgvector Support for Semantic Search
-- Adds embedding columns and indexes for hybrid memory architecture
-- ============================================

-- Enable pgvector extension
CREATE EXTENSION IF NOT EXISTS vector;

-- Add embedding columns to messages table
ALTER TABLE messages 
ADD COLUMN IF NOT EXISTS embedding vector(384);  -- Using all-MiniLM-L6-v2 dimensions

-- Add embedding columns to facts table
ALTER TABLE facts
ADD COLUMN IF NOT EXISTS embedding vector(384);

-- Create vector similarity indexes (HNSW for fast approximate nearest neighbor)
CREATE INDEX IF NOT EXISTS idx_messages_embedding 
ON messages USING hnsw (embedding vector_cosine_ops)
WITH (m = 16, ef_construction = 64);

CREATE INDEX IF NOT EXISTS idx_facts_embedding
ON facts USING hnsw (embedding vector_cosine_ops)
WITH (m = 16, ef_construction = 64);

-- Add GIN index for full-text search on message content (hybrid approach)
CREATE INDEX IF NOT EXISTS idx_messages_content_gin
ON messages USING gin(to_tsvector('english', COALESCE(content, '')));

CREATE INDEX IF NOT EXISTS idx_facts_value_gin
ON facts USING gin(to_tsvector('english', value));

-- ============================================
-- Helper Functions for Semantic Search
-- ============================================

-- Function: Search messages by semantic similarity
CREATE OR REPLACE FUNCTION search_messages_semantic(
    query_embedding vector(384),
    target_user_id UUID,
    similarity_threshold FLOAT DEFAULT 0.7,
    max_results INT DEFAULT 10
)
RETURNS TABLE (
    message_id BIGINT,
    session_id UUID,
    role TEXT,
    content TEXT,
    similarity FLOAT,
    created_at TIMESTAMPTZ
) AS $$
BEGIN
    RETURN QUERY
    SELECT 
        m.id,
        m.session_id,
        m.role,
        m.content,
        1 - (m.embedding <=> query_embedding) AS similarity,
        m.created_at
    FROM messages m
    JOIN sessions s ON s.id = m.session_id
    WHERE s.user_id = target_user_id
        AND m.embedding IS NOT NULL
        AND 1 - (m.embedding <=> query_embedding) >= similarity_threshold
    ORDER BY m.embedding <=> query_embedding
    LIMIT max_results;
END;
$$ LANGUAGE plpgsql STABLE;

-- Function: Search facts by semantic similarity
CREATE OR REPLACE FUNCTION search_facts_semantic(
    query_embedding vector(384),
    target_user_id UUID,
    similarity_threshold FLOAT DEFAULT 0.7,
    max_results INT DEFAULT 10
)
RETURNS TABLE (
    fact_id UUID,
    category TEXT,
    key TEXT,
    value TEXT,
    similarity FLOAT,
    confidence REAL
) AS $$
BEGIN
    RETURN QUERY
    SELECT 
        f.id,
        f.category,
        f.key,
        f.value,
        1 - (f.embedding <=> query_embedding) AS similarity,
        f.confidence
    FROM facts f
    WHERE f.user_id = target_user_id
        AND f.embedding IS NOT NULL
        AND 1 - (f.embedding <=> query_embedding) >= similarity_threshold
    ORDER BY f.embedding <=> query_embedding
    LIMIT max_results;
END;
$$ LANGUAGE plpgsql STABLE;

-- Function: Hybrid search combining keyword and semantic
CREATE OR REPLACE FUNCTION search_messages_hybrid(
    search_query TEXT,
    query_embedding vector(384),
    target_user_id UUID,
    max_results INT DEFAULT 10
)
RETURNS TABLE (
    message_id BIGINT,
    session_id UUID,
    role TEXT,
    content TEXT,
    relevance_score FLOAT,
    match_type TEXT,
    created_at TIMESTAMPTZ
) AS $$
BEGIN
    RETURN QUERY
    WITH keyword_matches AS (
        SELECT 
            m.id,
            m.session_id,
            m.role,
            m.content,
            ts_rank(to_tsvector('english', COALESCE(m.content, '')), 
                   plainto_tsquery('english', search_query)) AS kw_score,
            'keyword' AS match_type,
            m.created_at
        FROM messages m
        JOIN sessions s ON s.id = m.session_id
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
        FROM messages m
        JOIN sessions s ON s.id = m.session_id
        WHERE s.user_id = target_user_id
            AND m.embedding IS NOT NULL
        ORDER BY m.embedding <=> query_embedding
        LIMIT max_results
    )
    SELECT DISTINCT ON (id)
        id,
        session_id,
        role,
        content,
        GREATEST(COALESCE(kw.kw_score, 0), COALESCE(sem.sem_score, 0)) AS relevance_score,
        COALESCE(kw.match_type, sem.match_type) AS match_type,
        COALESCE(kw.created_at, sem.created_at) AS created_at
    FROM (
        SELECT * FROM keyword_matches
        UNION ALL
        SELECT * FROM semantic_matches
    ) AS combined
    LEFT JOIN keyword_matches kw ON kw.id = combined.id
    LEFT JOIN semantic_matches sem ON sem.id = combined.id
    ORDER BY id, relevance_score DESC
    LIMIT max_results;
END;
$$ LANGUAGE plpgsql STABLE;

-- ============================================
-- Metadata and Comments
-- ============================================

COMMENT ON COLUMN messages.embedding IS 'Semantic embedding vector (384-dim all-MiniLM-L6-v2) for similarity search';
COMMENT ON COLUMN facts.embedding IS 'Semantic embedding vector for fact similarity search';

COMMENT ON FUNCTION search_messages_semantic IS 'Search messages by semantic similarity using cosine distance';
COMMENT ON FUNCTION search_facts_semantic IS 'Search facts by semantic similarity';
COMMENT ON FUNCTION search_messages_hybrid IS 'Hybrid search combining keyword (full-text) and semantic (vector) matching';

-- ============================================
-- Performance Hints
-- ============================================

-- Update table statistics for better query planning
ANALYZE messages;
ANALYZE facts;
