-- =========================================
-- AI Analysis History Tables for Trading Bot
-- PostgreSQL / Neon compatible
-- =========================================

-- =========================
-- AI Analyses
-- =========================
CREATE TABLE IF NOT EXISTS ai_analyses (
    id SERIAL PRIMARY KEY,
    analysis_type VARCHAR(50) NOT NULL,
    input_data JSONB NOT NULL,
    output_data JSONB NOT NULL,
    raw_response TEXT,
    confidence FLOAT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_ai_analyses_analysis_type
ON ai_analyses (analysis_type);

CREATE INDEX IF NOT EXISTS idx_ai_analyses_created_at
ON ai_analyses (created_at);

-- =========================
-- Trading Suggestions
-- =========================
CREATE TABLE IF NOT EXISTS ai_trading_suggestions (
    id SERIAL PRIMARY KEY,
    analysis_id INTEGER REFERENCES ai_analyses(id) ON DELETE CASCADE,
    action VARCHAR(20) NOT NULL,
    symbol VARCHAR(100),
    entry_price DECIMAL(20, 8),
    target_price DECIMAL(20, 8),
    stop_loss DECIMAL(20, 8),
    risk_reward_ratio FLOAT,
    confidence FLOAT,
    reasoning TEXT,
    status VARCHAR(20) DEFAULT 'pending',
    executed_at TIMESTAMP,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_ai_trading_suggestions_status
ON ai_trading_suggestions (status);

CREATE INDEX IF NOT EXISTS idx_ai_trading_suggestions_created_at
ON ai_trading_suggestions (created_at);

-- =========================
-- Risk Assessments
-- =========================
CREATE TABLE IF NOT EXISTS ai_risk_assessments (
    id SERIAL PRIMARY KEY,
    risk_score INTEGER NOT NULL,
    primary_factors JSONB NOT NULL,
    mitigation_strategies JSONB NOT NULL,
    recommended_actions JSONB NOT NULL,
    portfolio_exposure DECIMAL(20, 8),
    portfolio_size INTEGER,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_ai_risk_assessments_risk_score
ON ai_risk_assessments (risk_score);

CREATE INDEX IF NOT EXISTS idx_ai_risk_assessments_created_at
ON ai_risk_assessments (created_at);

-- =========================
-- Token Analyses
-- =========================
CREATE TABLE IF NOT EXISTS ai_token_analyses (
    id SERIAL PRIMARY KEY,
    token_mint VARCHAR(100) NOT NULL UNIQUE,
    token_name VARCHAR(255),
    token_symbol VARCHAR(50),
    fundamentals_score FLOAT,
    tokenomics_score FLOAT,
    risk_factors JSONB NOT NULL,
    investment_potential VARCHAR(20),
    recommendation VARCHAR(20),
    confidence FLOAT,
    rationale TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_ai_token_analyses_token_mint
ON ai_token_analyses (token_mint);

CREATE INDEX IF NOT EXISTS idx_ai_token_analyses_recommendation
ON ai_token_analyses (recommendation);

-- =========================
-- Analysis Metrics
-- =========================
CREATE TABLE IF NOT EXISTS ai_analysis_metrics (
    id SERIAL PRIMARY KEY,
    analysis_type VARCHAR(50) NOT NULL,
    total_analyses INTEGER DEFAULT 0,
    accuracy_rate FLOAT DEFAULT 0,
    avg_confidence FLOAT DEFAULT 0,
    profitable_suggestions INTEGER DEFAULT 0,
    loss_suggestions INTEGER DEFAULT 0,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_ai_analysis_metrics_analysis_type
ON ai_analysis_metrics (analysis_type);

-- =========================
-- Model Usage Logs
-- =========================
CREATE TABLE IF NOT EXISTS ai_model_usage (
    id SERIAL PRIMARY KEY,
    model_name VARCHAR(100),
    analysis_type VARCHAR(50),
    tokens_used INTEGER,
    cost_estimated DECIMAL(10, 6),
    response_time_ms INTEGER,
    success BOOLEAN DEFAULT true,
    error_message TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_ai_model_usage_model_name
ON ai_model_usage (model_name);

CREATE INDEX IF NOT EXISTS idx_ai_model_usage_created_at
ON ai_model_usage (created_at);

-- =========================
-- Trading Results
-- =========================
CREATE TABLE IF NOT EXISTS ai_suggestion_results (
    id SERIAL PRIMARY KEY,
    suggestion_id INTEGER REFERENCES ai_trading_suggestions(id) ON DELETE CASCADE,
    entry_price DECIMAL(20, 8),
    exit_price DECIMAL(20, 8),
    pnl DECIMAL(20, 8),
    pnl_percentage FLOAT,
    hold_duration_seconds INTEGER,
    result_type VARCHAR(20),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    closed_at TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_ai_suggestion_results_result_type
ON ai_suggestion_results (result_type);

CREATE INDEX IF NOT EXISTS idx_ai_suggestion_results_created_at
ON ai_suggestion_results (created_at);
