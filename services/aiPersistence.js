import pkg from 'pg'
import logger from '../utils/logger.js'

const { Pool } = pkg

// Create connection pool to Neon database
let pool = null

function getPool() {
  if (!pool) {
    pool = new Pool({
      connectionString: process.env.DATABASE_URL,
      max: 10,
      idleTimeoutMillis: 30000,
      connectionTimeoutMillis: 2000,
    })

    pool.on('error', (err) => {
      logger.error('[AI-Persistence] Unexpected error on idle client', err)
    })
  }

  return pool
}

// AI Persistence Service
class AIPersistenceService {
  constructor() {
    this.initialized = false
  }

  async initialize() {
    try {
      const client = await getPool().connect()
      client.release()
      this.initialized = true
      logger.info('[AI-Persistence] Database connection initialized')
    } catch (error) {
      logger.error('[AI-Persistence] Failed to initialize database', error)
      throw error
    }
  }

  // Save market analysis
  async saveMarketAnalysis(analysisData) {
    try {
      const pool = getPool()
      const result = await pool.query(
        `INSERT INTO ai_analyses (analysis_type, input_data, output_data, raw_response, confidence)
         VALUES ($1, $2, $3, $4, $5)
         RETURNING id, created_at`,
        [
          'market_analysis',
          JSON.stringify(analysisData.input),
          JSON.stringify(analysisData.output),
          analysisData.rawResponse,
          analysisData.confidence || null,
        ]
      )

      logger.info('[AI-Persistence] Market analysis saved to database')
      return result.rows[0]
    } catch (error) {
      logger.error('[AI-Persistence] Error saving market analysis', error)
      throw error
    }
  }

  // Save trading suggestions
  async saveTradingSuggestions(suggestions, analysisId) {
    try {
      const pool = getPool()
      const values = []
      let queryStr = `INSERT INTO ai_trading_suggestions 
        (analysis_id, action, symbol, entry_price, target_price, stop_loss, risk_reward_ratio, confidence, reasoning)
        VALUES `

      suggestions.forEach((suggestion, idx) => {
        const offset = idx * 9
        queryStr += `($${offset + 1}, $${offset + 2}, $${offset + 3}, $${offset + 4}, $${offset + 5}, $${offset + 6}, $${offset + 7}, $${offset + 8}, $${offset + 9}),`

        values.push(
          analysisId,
          suggestion.action || 'BUY',
          suggestion.symbol || '',
          suggestion.entryPrice || null,
          suggestion.targetPrice || null,
          suggestion.stopLoss || null,
          suggestion.riskReward || null,
          suggestion.confidence || null,
          suggestion.reasoning || ''
        )
      })

      queryStr = queryStr.slice(0, -1) + ' RETURNING id'

      if (suggestions.length > 0) {
        const result = await pool.query(queryStr, values)
        logger.info(`[AI-Persistence] Saved ${result.rows.length} trading suggestions`)
        return result.rows
      }

      return []
    } catch (error) {
      logger.error('[AI-Persistence] Error saving trading suggestions', error)
      throw error
    }
  }

  // Save token analysis
  async saveTokenAnalysis(tokenMint, analysisData) {
    try {
      const pool = getPool()
      const result = await pool.query(
        `INSERT INTO ai_token_analyses 
         (token_mint, token_name, token_symbol, fundamentals_score, tokenomics_score, risk_factors, investment_potential, recommendation, confidence, rationale)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
         ON CONFLICT (token_mint) DO UPDATE SET
           fundamentals_score = EXCLUDED.fundamentals_score,
           tokenomics_score = EXCLUDED.tokenomics_score,
           risk_factors = EXCLUDED.risk_factors,
           investment_potential = EXCLUDED.investment_potential,
           recommendation = EXCLUDED.recommendation,
           confidence = EXCLUDED.confidence,
           rationale = EXCLUDED.rationale,
           updated_at = CURRENT_TIMESTAMP
         RETURNING id, created_at, updated_at`,
        [
          tokenMint,
          analysisData.name || '',
          analysisData.symbol || '',
          analysisData.fundamentalsScore || null,
          analysisData.tokenomicsScore || null,
          JSON.stringify(analysisData.riskFactors || []),
          analysisData.potential || 'MEDIUM',
          analysisData.recommendation || 'HOLD',
          analysisData.confidence || null,
          analysisData.rationale || '',
        ]
      )

      logger.info(`[AI-Persistence] Token analysis saved for ${tokenMint}`)
      return result.rows[0]
    } catch (error) {
      logger.error('[AI-Persistence] Error saving token analysis', error)
      throw error
    }
  }

  // Save risk assessment
  async saveRiskAssessment(assessmentData) {
    try {
      const pool = getPool()
      const result = await pool.query(
        `INSERT INTO ai_risk_assessments 
         (risk_score, primary_factors, mitigation_strategies, recommended_actions, portfolio_exposure, portfolio_size)
         VALUES ($1, $2, $3, $4, $5, $6)
         RETURNING id, created_at`,
        [
          assessmentData.riskScore || 5,
          JSON.stringify(assessmentData.factors || []),
          JSON.stringify(assessmentData.mitigation || []),
          JSON.stringify(assessmentData.actions || []),
          assessmentData.portfolioExposure || null,
          assessmentData.portfolioSize || null,
        ]
      )

      logger.info('[AI-Persistence] Risk assessment saved to database')
      return result.rows[0]
    } catch (error) {
      logger.error('[AI-Persistence] Error saving risk assessment', error)
      throw error
    }
  }

  // Get analysis history
  async getAnalysisHistory(analysisType, limit = 50) {
    try {
      const pool = getPool()
      const query =
        analysisType === 'all'
          ? `SELECT * FROM ai_analyses ORDER BY created_at DESC LIMIT $1`
          : `SELECT * FROM ai_analyses WHERE analysis_type = $1 ORDER BY created_at DESC LIMIT $2`

      const params = analysisType === 'all' ? [limit] : [analysisType, limit]
      const result = await pool.query(query, params)

      return result.rows
    } catch (error) {
      logger.error('[AI-Persistence] Error getting analysis history', error)
      return []
    }
  }

  // Get trading suggestions history
  async getTradingSuggestionsHistory(limit = 50) {
    try {
      const pool = getPool()
      const result = await pool.query(
        `SELECT * FROM ai_trading_suggestions ORDER BY created_at DESC LIMIT $1`,
        [limit]
      )

      return result.rows
    } catch (error) {
      logger.error('[AI-Persistence] Error getting trading suggestions history', error)
      return []
    }
  }

  // Get token analysis
  async getTokenAnalysis(tokenMint) {
    try {
      const pool = getPool()
      const result = await pool.query(
        `SELECT * FROM ai_token_analyses WHERE token_mint = $1 ORDER BY updated_at DESC LIMIT 1`,
        [tokenMint]
      )

      return result.rows[0] || null
    } catch (error) {
      logger.error('[AI-Persistence] Error getting token analysis', error)
      return null
    }
  }

  // Get recent risk assessments
  async getRecentRiskAssessments(limit = 10) {
    try {
      const pool = getPool()
      const result = await pool.query(
        `SELECT * FROM ai_risk_assessments ORDER BY created_at DESC LIMIT $1`,
        [limit]
      )

      return result.rows
    } catch (error) {
      logger.error('[AI-Persistence] Error getting risk assessments', error)
      return []
    }
  }

  // Update suggestion with execution result
  async updateSuggestionResult(suggestionId, resultData) {
    try {
      const pool = getPool()

      // Update the suggestion status
      await pool.query(
        `UPDATE ai_trading_suggestions SET status = $1, executed_at = $2 WHERE id = $3`,
        ['executed', new Date(), suggestionId]
      )

      // Insert result record
      const result = await pool.query(
        `INSERT INTO ai_suggestion_results 
         (suggestion_id, entry_price, exit_price, pnl, pnl_percentage, hold_duration_seconds, result_type)
         VALUES ($1, $2, $3, $4, $5, $6, $7)
         RETURNING id`,
        [
          suggestionId,
          resultData.entryPrice,
          resultData.exitPrice,
          resultData.pnl,
          resultData.pnlPercentage,
          resultData.holdDuration,
          resultData.resultType,
        ]
      )

      logger.info(`[AI-Persistence] Suggestion result updated: ${suggestionId}`)
      return result.rows[0]
    } catch (error) {
      logger.error('[AI-Persistence] Error updating suggestion result', error)
      throw error
    }
  }

  // Get AI performance metrics
  async getPerformanceMetrics(analysisType) {
    try {
      const pool = getPool()
      const result = await pool.query(
        `SELECT * FROM ai_analysis_metrics WHERE analysis_type = $1`,
        [analysisType]
      )

      return result.rows[0] || null
    } catch (error) {
      logger.error('[AI-Persistence] Error getting performance metrics', error)
      return null
    }
  }

  // Log model usage
  async logModelUsage(usageData) {
    try {
      const pool = getPool()
      await pool.query(
        `INSERT INTO ai_model_usage 
         (model_name, analysis_type, tokens_used, cost_estimated, response_time_ms, success, error_message)
         VALUES ($1, $2, $3, $4, $5, $6, $7)`,
        [
          usageData.modelName,
          usageData.analysisType,
          usageData.tokensUsed || 0,
          usageData.costEstimated || null,
          usageData.responseTimeMs || 0,
          usageData.success !== false,
          usageData.errorMessage || null,
        ]
      )

      logger.info('[AI-Persistence] Model usage logged')
    } catch (error) {
      logger.error('[AI-Persistence] Error logging model usage', error)
    }
  }

  // Get statistics
  async getStatistics() {
    try {
      const pool = getPool()

      const [analyses, suggestions, tokens, risks] = await Promise.all([
        pool.query(`SELECT COUNT(*) as count FROM ai_analyses`),
        pool.query(`SELECT COUNT(*) as count FROM ai_trading_suggestions`),
        pool.query(`SELECT COUNT(*) as count FROM ai_token_analyses`),
        pool.query(`SELECT COUNT(*) as count FROM ai_risk_assessments`),
      ])

      return {
        totalAnalyses: parseInt(analyses.rows[0].count),
        totalSuggestions: parseInt(suggestions.rows[0].count),
        totalTokensAnalyzed: parseInt(tokens.rows[0].count),
        totalRiskAssessments: parseInt(risks.rows[0].count),
      }
    } catch (error) {
      logger.error('[AI-Persistence] Error getting statistics', error)
      return {
        totalAnalyses: 0,
        totalSuggestions: 0,
        totalTokensAnalyzed: 0,
        totalRiskAssessments: 0,
      }
    }
  }

  // Cleanup old records (keep only last 1000)
  async cleanup() {
    try {
      const pool = getPool()

      await pool.query(`
        DELETE FROM ai_analyses
        WHERE id NOT IN (
          SELECT id FROM ai_analyses ORDER BY created_at DESC LIMIT 1000
        )
      `)

      logger.info('[AI-Persistence] Database cleanup completed')
    } catch (error) {
      logger.error('[AI-Persistence] Error during cleanup', error)
    }
  }

  // Close database connection
  async close() {
    if (pool) {
      await pool.end()
      logger.info('[AI-Persistence] Database pool closed')
    }
  }
}

export default new AIPersistenceService()
