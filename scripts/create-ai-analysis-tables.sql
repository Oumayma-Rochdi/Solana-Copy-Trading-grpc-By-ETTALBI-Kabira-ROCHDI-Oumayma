-- AI Analysis History Tables for Trading Bot

-- Create AI Analyses table
CREATE TABLE IF NOT EXISTS ai_analyses (
    id SERIAL PRIMARY KEY,
    analysis_type VARCHAR(50) NOT NULL, -- market_analysis, trading_suggestions, token_analysis, risk_assessment
    input_data JSONB NOT NULL,
    output_data JSONB NOT NULL,
    raw_response TEXT,
    confidence FLOAT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    INDEX idx_analysis_type (analysis_type),
    INDEX idx_created_at (created_at)
);

-- Create Trading Suggestions table
CREATE TABLE IF NOT EXISTS ai_trading_suggestions (
    id SERIAL PRIMARY KEY,
    analysis_id INTEGER REFERENCES ai_analyses(id),
    action VARCHAR(20) NOT NULL, -- BUY, SELL, HOLD
    symbol VARCHAR(100),
    entry_price DECIMAL(20, 8),
    target_price DECIMAL(20, 8),
    stop_loss DECIMAL(20, 8),
    risk_reward_ratio FLOAT,
    confidence FLOAT,
    reasoning TEXT,
    status VARCHAR(20) DEFAULT 'pending', -- pending, executed, closed
    executed_at TIMESTAMP,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    INDEX idx_status (status),
    INDEX idx_created_at (created_at)
);

-- Create Risk Assessments table
CREATE TABLE IF NOT EXISTS ai_risk_assessments (
    id SERIAL PRIMARY KEY,
    risk_score INTEGER NOT NULL,
    primary_factors JSONB NOT NULL,
    mitigation_strategies JSONB NOT NULL,
    recommended_actions JSONB NOT NULL,
    portfolio_exposure DECIMAL(20, 8),
    portfolio_size INTEGER,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    INDEX idx_risk_score (risk_score),
    INDEX idx_created_at (created_at)
);

-- Create Token Analyses table
CREATE TABLE IF NOT EXISTS ai_token_analyses (
    id SERIAL PRIMARY KEY,
    token_mint VARCHAR(100) NOT NULL UNIQUE,
    token_name VARCHAR(255),
    token_symbol VARCHAR(50),
    fundamentals_score FLOAT,
    tokenomics_score FLOAT,
    risk_factors JSONB NOT NULL,
    investment_potential VARCHAR(20), -- HIGH, MEDIUM, LOW
    recommendation VARCHAR(20), -- BUY, HOLD, AVOID
    confidence FLOAT,
    rationale TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    INDEX idx_token_mint (token_mint),
    INDEX idx_recommendation (recommendation)
);

-- Create AI Analysis Performance Metrics table
CREATE TABLE IF NOT EXISTS ai_analysis_metrics (
    id SERIAL PRIMARY KEY,
    analysis_type VARCHAR(50) NOT NULL,
    total_analyses INTEGER DEFAULT 0,
    accuracy_rate FLOAT DEFAULT 0,
    avg_confidence FLOAT DEFAULT 0,
    profitable_suggestions INTEGER DEFAULT 0,
    loss_suggestions INTEGER DEFAULT 0,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    INDEX idx_analysis_type (analysis_type)
);

-- Create AI Model Usage Log table
CREATE TABLE IF NOT EXISTS ai_model_usage (
    id SERIAL PRIMARY KEY,
    model_name VARCHAR(100),
    analysis_type VARCHAR(50),
    tokens_used INTEGER,
    cost_estimated DECIMAL(10, 6),
    response_time_ms INTEGER,
    success BOOLEAN DEFAULT true,
    error_message TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    INDEX idx_model_name (model_name),
    INDEX idx_created_at (created_at)
);

-- Create Trading Results from AI Suggestions table
CREATE TABLE IF NOT EXISTS ai_suggestion_results (
    id SERIAL PRIMARY KEY,
    suggestion_id INTEGER REFERENCES ai_trading_suggestions(id),
    entry_price DECIMAL(20, 8),
    exit_price DECIMAL(20, 8),
    pnl DECIMAL(20, 8),
    pnl_percentage FLOAT,
    hold_duration_seconds INTEGER,
    result_type VARCHAR(20), -- WIN, LOSS, PARTIAL
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    closed_at TIMESTAMP,
    INDEX idx_result_type (result_type),
    INDEX idx_created_at (created_at)
);
