-- ============================================
-- Agent Max Unified Database Schema
-- Beta Data Collection with Consent & Privacy Controls
-- Bridges frontend (agent-max-desktop) and backend (Agent_Max)
-- ============================================

-- Enable required extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS pgcrypto;
CREATE EXTENSION IF NOT EXISTS pg_trgm;
-- CREATE EXTENSION IF NOT EXISTS vector; -- Uncomment for embeddings support

-- ============================================
-- 1. CONSENT & USER MANAGEMENT
-- ============================================

CREATE TABLE users (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    device_id UUID UNIQUE NOT NULL,
    email TEXT,
    name TEXT,
    consent_version INTEGER NOT NULL DEFAULT 1,
    scopes JSONB NOT NULL DEFAULT '{"prompts":false,"outputs":false,"tools":false,"screenshots":false}'::jsonb,
    consented_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    last_active_at TIMESTAMPTZ,
    interaction_count INTEGER DEFAULT 0,
    metadata JSONB DEFAULT '{}'::jsonb
);

CREATE INDEX idx_users_device ON users(device_id);
CREATE INDEX idx_users_email ON users(email) WHERE email IS NOT NULL;
CREATE INDEX idx_users_last_active ON users(last_active_at DESC);

COMMENT ON TABLE users IS 'User identity and consent tracking - device_id is primary identifier for beta';
COMMENT ON COLUMN users.scopes IS 'Consent scopes: {"prompts":bool,"outputs":bool,"tools":bool,"screenshots":bool}';
COMMENT ON COLUMN users.consent_version IS 'Privacy policy version user consented to';

-- ============================================
-- 2. CORE DATA MODEL
-- ============================================

-- Sessions: conversation threads
CREATE TABLE sessions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    title TEXT,
    mode TEXT DEFAULT 'private' CHECK (mode IN ('private', 'learning', 'team')),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    message_count INTEGER DEFAULT 0,
    is_active BOOLEAN DEFAULT true,
    metadata JSONB DEFAULT '{}'::jsonb
);

CREATE INDEX idx_sessions_user ON sessions(user_id);
CREATE INDEX idx_sessions_active ON sessions(user_id, is_active) WHERE is_active = true;
CREATE INDEX idx_sessions_updated ON sessions(updated_at DESC);

COMMENT ON TABLE sessions IS 'Conversation sessions with privacy modes';
COMMENT ON COLUMN sessions.mode IS 'private: no collection, learning: full collection, team: shared context';

-- Messages: individual turns with PII handling
CREATE TABLE messages (
    id BIGSERIAL PRIMARY KEY,
    session_id UUID NOT NULL REFERENCES sessions(id) ON DELETE CASCADE,
    role TEXT NOT NULL CHECK (role IN ('user', 'assistant', 'system', 'tool')),
    content TEXT,
    redacted_content TEXT,
    token_count INTEGER,
    pii_tags JSONB DEFAULT '{}'::jsonb,
    from_cache BOOLEAN DEFAULT false,
    cache_type TEXT,
    thinking_time_ms INTEGER,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    metadata JSONB DEFAULT '{}'::jsonb
);

CREATE INDEX idx_messages_session ON messages(session_id, created_at DESC);
CREATE INDEX idx_messages_role ON messages(role);
CREATE INDEX idx_messages_cached ON messages(from_cache) WHERE from_cache = true;
CREATE INDEX idx_messages_pii ON messages USING gin(pii_tags);
CREATE INDEX idx_messages_created ON messages(created_at DESC);

COMMENT ON TABLE messages IS 'Messages with privacy-aware content storage';
COMMENT ON COLUMN messages.content IS 'Raw content (NULL if consent not given)';
COMMENT ON COLUMN messages.redacted_content IS 'PII-redacted content for analysis';
COMMENT ON COLUMN messages.pii_tags IS 'PII detection counts: {"email":2,"phone":1,"ssn":0}';

-- Tool calls: autonomous actions with audit trail
CREATE TABLE tool_calls (
    id BIGSERIAL PRIMARY KEY,
    session_id UUID NOT NULL REFERENCES sessions(id) ON DELETE CASCADE,
    message_id BIGINT REFERENCES messages(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    args JSONB,
    result JSONB,
    success BOOLEAN,
    latency_ms INTEGER,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    metadata JSONB DEFAULT '{}'::jsonb
);

CREATE INDEX idx_tool_calls_session ON tool_calls(session_id, created_at DESC);
CREATE INDEX idx_tool_calls_name ON tool_calls(name);
CREATE INDEX idx_tool_calls_success ON tool_calls(success);
CREATE INDEX idx_tool_calls_latency ON tool_calls(latency_ms DESC);

COMMENT ON TABLE tool_calls IS 'Autonomous tool execution audit trail';

-- ============================================
-- 3. CROSS-USER CACHING (INTEGRATION FIX)
-- ============================================

-- Response cache: cross-user cached responses
CREATE TABLE response_cache (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    prompt_normalized TEXT NOT NULL UNIQUE,
    prompt_original TEXT NOT NULL,
    response TEXT NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    hit_count INTEGER DEFAULT 0,
    last_hit_at TIMESTAMPTZ,
    ttl_days INTEGER DEFAULT 7,
    is_personal BOOLEAN DEFAULT false,
    metadata JSONB DEFAULT '{}'::jsonb
);

CREATE INDEX idx_cache_normalized ON response_cache(prompt_normalized);
CREATE INDEX idx_cache_updated ON response_cache(updated_at DESC);
CREATE INDEX idx_cache_hits ON response_cache(hit_count DESC);
CREATE INDEX idx_cache_non_personal ON response_cache(is_personal) WHERE is_personal = false;

COMMENT ON TABLE response_cache IS 'Cross-user response cache (non-personal queries only) - MAJOR INTEGRATION FIX';
COMMENT ON COLUMN response_cache.is_personal IS 'If true, exclude from cross-user sharing';

-- Question frequency: optimize caching strategy
CREATE TABLE question_frequency (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    question_normalized TEXT NOT NULL UNIQUE,
    question_original TEXT NOT NULL,
    ask_count INTEGER DEFAULT 1,
    unique_users INTEGER DEFAULT 1,
    first_asked_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    last_asked_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_question_freq ON question_frequency(ask_count DESC);
CREATE INDEX idx_question_recent ON question_frequency(last_asked_at DESC);

COMMENT ON TABLE question_frequency IS 'Track question patterns to optimize caching';

-- ============================================
-- 4. USER MEMORY (INTEGRATION FIX)
-- ============================================

-- Facts: structured user knowledge
CREATE TABLE facts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    category TEXT NOT NULL,
    key TEXT NOT NULL,
    value TEXT NOT NULL,
    confidence REAL DEFAULT 1.0,
    source TEXT,
    verified BOOLEAN DEFAULT false,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    metadata JSONB DEFAULT '{}'::jsonb,
    UNIQUE(user_id, category, key)
);

CREATE INDEX idx_facts_user ON facts(user_id);
CREATE INDEX idx_facts_category ON facts(category);
CREATE INDEX idx_facts_user_category ON facts(user_id, category);

COMMENT ON TABLE facts IS 'User facts (category → key → value) - replaces frontend memory-manager.cjs';

-- Preferences: learned behavior settings
CREATE TABLE preferences (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    key TEXT NOT NULL,
    value TEXT NOT NULL,
    category TEXT DEFAULT 'general',
    confidence REAL DEFAULT 1.0,
    learn_count INTEGER DEFAULT 1,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    metadata JSONB DEFAULT '{}'::jsonb,
    UNIQUE(user_id, key)
);

CREATE INDEX idx_preferences_user ON preferences(user_id);
CREATE INDEX idx_preferences_category ON preferences(category);

COMMENT ON TABLE preferences IS 'User preferences learned from behavior - syncs across devices';

-- ============================================
-- 5. TELEMETRY & ANALYTICS
-- ============================================

-- Events: user interactions
CREATE TABLE telemetry_events (
    id BIGSERIAL PRIMARY KEY,
    user_id UUID REFERENCES users(id) ON DELETE SET NULL,
    session_id UUID REFERENCES sessions(id) ON DELETE SET NULL,
    event_type TEXT NOT NULL,
    action TEXT,
    ts TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    metadata JSONB DEFAULT '{}'::jsonb
);

CREATE INDEX idx_telemetry_user ON telemetry_events(user_id);
CREATE INDEX idx_telemetry_type ON telemetry_events(event_type);
CREATE INDEX idx_telemetry_ts ON telemetry_events(ts DESC);

COMMENT ON TABLE telemetry_events IS 'User interaction events';

-- Answers: response quality tracking
CREATE TABLE answers (
    id BIGSERIAL PRIMARY KEY,
    session_id UUID NOT NULL REFERENCES sessions(id) ON DELETE CASCADE,
    message_id BIGINT REFERENCES messages(id) ON DELETE CASCADE,
    outcome TEXT NOT NULL CHECK (outcome IN ('success', 'error', 'timeout', 'cancelled')),
    latency_ms INTEGER,
    token_count INTEGER,
    from_cache BOOLEAN DEFAULT false,
    error_code TEXT,
    ts TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_answers_outcome ON answers(outcome);
CREATE INDEX idx_answers_latency ON answers(latency_ms DESC);
CREATE INDEX idx_answers_ts ON answers(ts DESC);

COMMENT ON TABLE answers IS 'Response quality and performance metrics';

-- Crashes: error tracking
CREATE TABLE crashes (
    id BIGSERIAL PRIMARY KEY,
    user_id UUID REFERENCES users(id) ON DELETE SET NULL,
    session_id UUID REFERENCES sessions(id) ON DELETE SET NULL,
    error_type TEXT NOT NULL,
    error_message TEXT,
    stack_trace TEXT,
    context JSONB DEFAULT '{}'::jsonb,
    ts TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_crashes_type ON crashes(error_type);
CREATE INDEX idx_crashes_ts ON crashes(ts DESC);

COMMENT ON TABLE crashes IS 'Application error tracking';

-- Idempotency: prevent duplicate operations
CREATE TABLE idempotency_keys (
    key TEXT PRIMARY KEY,
    response JSONB NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    expires_at TIMESTAMPTZ NOT NULL DEFAULT NOW() + INTERVAL '24 hours'
);

CREATE INDEX idx_idempotency_expires ON idempotency_keys(expires_at);

COMMENT ON TABLE idempotency_keys IS 'Idempotency key storage for duplicate prevention';

-- ============================================
-- 6. ROW LEVEL SECURITY (RLS)
-- ============================================

ALTER TABLE users ENABLE ROW LEVEL SECURITY;
ALTER TABLE sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE tool_calls ENABLE ROW LEVEL SECURITY;
ALTER TABLE facts ENABLE ROW LEVEL SECURITY;
ALTER TABLE preferences ENABLE ROW LEVEL SECURITY;
ALTER TABLE telemetry_events ENABLE ROW LEVEL SECURITY;

-- Users can only see their own data
CREATE POLICY users_select_own ON users
    FOR SELECT USING (auth.uid() = id);

CREATE POLICY sessions_all_own ON sessions
    FOR ALL USING (user_id = auth.uid());

CREATE POLICY messages_select_own ON messages
    FOR SELECT USING (
        session_id IN (
            SELECT id FROM sessions WHERE user_id = auth.uid()
        )
    );

CREATE POLICY tool_calls_select_own ON tool_calls
    FOR SELECT USING (
        session_id IN (
            SELECT id FROM sessions WHERE user_id = auth.uid()
        )
    );

CREATE POLICY facts_all_own ON facts
    FOR ALL USING (user_id = auth.uid());

CREATE POLICY preferences_all_own ON preferences
    FOR ALL USING (user_id = auth.uid());

CREATE POLICY telemetry_insert_own ON telemetry_events
    FOR INSERT WITH CHECK (user_id = auth.uid());

-- Note: Cache tables (response_cache, question_frequency) have no RLS
-- They're managed server-side only for cross-user sharing

COMMENT ON POLICY users_select_own ON users IS 'Users can only view their own profile';
COMMENT ON POLICY sessions_all_own ON sessions IS 'Users have full access to their sessions';

-- ============================================
-- 7. HELPER FUNCTIONS & TRIGGERS
-- ============================================

-- Auto-update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_users_updated_at BEFORE UPDATE ON users
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_sessions_updated_at BEFORE UPDATE ON sessions
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_facts_updated_at BEFORE UPDATE ON facts
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_preferences_updated_at BEFORE UPDATE ON preferences
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_response_cache_updated_at BEFORE UPDATE ON response_cache
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Auto-increment message count
CREATE OR REPLACE FUNCTION increment_message_count()
RETURNS TRIGGER AS $$
BEGIN
    UPDATE sessions
    SET message_count = message_count + 1,
        updated_at = NOW()
    WHERE id = NEW.session_id;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER increment_session_message_count AFTER INSERT ON messages
    FOR EACH ROW EXECUTE FUNCTION increment_message_count();

-- Clean expired cache entries
CREATE OR REPLACE FUNCTION clean_expired_cache()
RETURNS void AS $$
BEGIN
    DELETE FROM response_cache
    WHERE updated_at < NOW() - INTERVAL '1 day' * ttl_days;
    
    DELETE FROM idempotency_keys
    WHERE expires_at < NOW();
END;
$$ LANGUAGE plpgsql;

-- Purge user data (GDPR compliance)
CREATE OR REPLACE FUNCTION purge_user_data(target_user_id UUID)
RETURNS void AS $$
BEGIN
    -- Cascade deletes handle most tables via foreign keys
    -- But explicitly delete to ensure order
    DELETE FROM telemetry_events WHERE user_id = target_user_id;
    DELETE FROM crashes WHERE user_id = target_user_id;
    DELETE FROM preferences WHERE user_id = target_user_id;
    DELETE FROM facts WHERE user_id = target_user_id;
    -- Sessions cascade to messages and tool_calls
    DELETE FROM sessions WHERE user_id = target_user_id;
    DELETE FROM users WHERE id = target_user_id;
    
    RAISE NOTICE 'Purged all data for user %', target_user_id;
END;
$$ LANGUAGE plpgsql;

COMMENT ON FUNCTION purge_user_data IS 'Delete all user data for GDPR compliance';

-- ============================================
-- 8. VIEWS FOR DASHBOARDS
-- ============================================

-- Recent conversations with preview
CREATE OR REPLACE VIEW recent_conversations AS
SELECT 
    s.id,
    s.user_id,
    s.title,
    s.mode,
    s.created_at,
    s.updated_at,
    s.message_count,
    s.is_active,
    (SELECT redacted_content FROM messages WHERE session_id = s.id ORDER BY created_at DESC LIMIT 1) as last_message
FROM sessions s
ORDER BY s.updated_at DESC;

COMMENT ON VIEW recent_conversations IS 'Recent conversations with redacted preview';

-- Beta telemetry: latency percentiles
CREATE OR REPLACE VIEW v_beta_latency AS
SELECT 
    outcome,
    COUNT(*) as count,
    PERCENTILE_CONT(0.5) WITHIN GROUP (ORDER BY latency_ms) as p50,
    PERCENTILE_CONT(0.9) WITHIN GROUP (ORDER BY latency_ms) as p90,
    PERCENTILE_CONT(0.99) WITHIN GROUP (ORDER BY latency_ms) as p99,
    AVG(latency_ms)::integer as avg_latency
FROM answers
WHERE ts > NOW() - INTERVAL '7 days'
GROUP BY outcome;

COMMENT ON VIEW v_beta_latency IS 'Response latency percentiles (7 days)';

-- Scope adoption: consent tracking
CREATE OR REPLACE VIEW v_scope_adoption AS
SELECT 
    COUNT(*) as total_users,
    COUNT(*) FILTER (WHERE (scopes->>'prompts')::boolean = true) as prompts_enabled,
    COUNT(*) FILTER (WHERE (scopes->>'outputs')::boolean = true) as outputs_enabled,
    COUNT(*) FILTER (WHERE (scopes->>'tools')::boolean = true) as tools_enabled,
    COUNT(*) FILTER (WHERE (scopes->>'screenshots')::boolean = true) as screenshots_enabled,
    ROUND(100.0 * COUNT(*) FILTER (WHERE (scopes->>'prompts')::boolean = true) / NULLIF(COUNT(*), 0), 1) as prompts_pct,
    ROUND(100.0 * COUNT(*) FILTER (WHERE (scopes->>'outputs')::boolean = true) / NULLIF(COUNT(*), 0), 1) as outputs_pct
FROM users;

COMMENT ON VIEW v_scope_adoption IS 'Consent scope adoption rates';

-- Cache effectiveness
CREATE OR REPLACE VIEW v_cache_stats AS
SELECT
    'response_cache' as cache_type,
    COUNT(*) as entry_count,
    SUM(hit_count) as total_hits,
    AVG(hit_count)::integer as avg_hits,
    MAX(updated_at) as last_updated
FROM response_cache
WHERE is_personal = false;

COMMENT ON VIEW v_cache_stats IS 'Cache hit statistics';

-- Tool usage analytics
CREATE OR REPLACE VIEW v_tool_usage AS
SELECT 
    name,
    COUNT(*) as call_count,
    COUNT(*) FILTER (WHERE success = true) as success_count,
    COUNT(*) FILTER (WHERE success = false) as error_count,
    ROUND(100.0 * COUNT(*) FILTER (WHERE success = true) / NULLIF(COUNT(*), 0), 1) as success_rate,
    PERCENTILE_CONT(0.5) WITHIN GROUP (ORDER BY latency_ms) as p50_latency,
    PERCENTILE_CONT(0.9) WITHIN GROUP (ORDER BY latency_ms) as p90_latency
FROM tool_calls
WHERE created_at > NOW() - INTERVAL '7 days'
GROUP BY name
ORDER BY call_count DESC;

COMMENT ON VIEW v_tool_usage IS 'Tool usage statistics (7 days)';

-- PII detection summary
CREATE OR REPLACE VIEW v_pii_detection AS
SELECT 
    role,
    COUNT(*) as message_count,
    COUNT(*) FILTER (WHERE pii_tags != '{}'::jsonb) as messages_with_pii,
    ROUND(100.0 * COUNT(*) FILTER (WHERE pii_tags != '{}'::jsonb) / NULLIF(COUNT(*), 0), 1) as pii_rate
FROM messages
WHERE created_at > NOW() - INTERVAL '7 days'
GROUP BY role;

COMMENT ON VIEW v_pii_detection IS 'PII detection rate by role (7 days)';

-- ============================================
-- 9. INITIAL DATA / SEED
-- ============================================

-- Anonymous user for unauthenticated sessions
INSERT INTO users (id, device_id, email, name, consent_version, scopes) VALUES
    ('00000000-0000-0000-0000-000000000000', 
     '00000000-0000-0000-0000-000000000001',
     'anonymous@agent-max.local', 
     'Anonymous User',
     1,
     '{"prompts":false,"outputs":false,"tools":false,"screenshots":false}'::jsonb)
ON CONFLICT DO NOTHING;
