import { generateText, streamText } from 'ai'
import logger from '../utils/logger.js'
import riskManager from './riskManager.js'
import aiPersistence from './aiPersistence.js'

// AI Analysis Service
class AIAnalysisService {
  constructor() {
    this.analysisHistory = []
    this.tradeSuggestions = []
    this.maxHistorySize = 100
  }

  /**
   * Analyze market conditions and provide trading suggestions
   * Uses Claude as the AI model (accessed via Vercel AI Gateway)
   */
  async analyzeMarketConditions(marketData) {
    try {
      logger.info('[AI-Analysis] Starting market condition analysis')

      // Build context from current market data
      const context = this._buildAnalysisContext(marketData)

      const systemPrompt = `You are an expert cryptocurrency trading analyst with deep knowledge of Solana and token trading strategies. 
You analyze market conditions, identify trading opportunities, and provide actionable recommendations based on risk management principles.
Your analysis should be data-driven, considering technical indicators, market sentiment, and risk factors.
Always prioritize risk management and capital preservation over aggressive trading.`

      const userPrompt = `Analyze the following market conditions and provide trading suggestions:

${context}

Please provide:
1. Market Overview (bearish/bullish/neutral analysis)
2. Key Price Levels (support/resistance)
3. 3-5 Trading Suggestions (with entry, target, stop-loss)
4. Risk Assessment (overall market risk level)
5. Recommended Actions

Format your response as JSON with these exact keys: marketSentiment, priceAnalysis, suggestions, riskLevel, recommendations`

      const result = await generateText({
        model: 'anthropic/claude-opus-4.5', // Using Claude via AI Gateway
        system: systemPrompt,
        prompt: userPrompt,
        temperature: 0.3, // Low temperature for consistent analysis
        maxTokens: 1500,
      })

      logger.info('[AI-Analysis] Market analysis completed')

      // Parse and structure the response
      const analysisResult = this._parseAnalysisResponse(result.text)

      // Store in history
      const historyRecord = {
        timestamp: new Date(),
        type: 'market_analysis',
        input: { marketData },
        output: analysisResult,
        rawResponse: result.text,
      }
      this._addToHistory(historyRecord)

      // Persist to database
      try {
        await aiPersistence.saveMarketAnalysis({
          input: { marketData },
          output: analysisResult,
          rawResponse: result.text,
          confidence: 0.85,
        })
      } catch (dbError) {
        logger.warn('[AI-Analysis] Failed to save to database', dbError)
      }

      return analysisResult
    } catch (error) {
      logger.error('[AI-Analysis] Error analyzing market conditions', error)
      throw error
    }
  }

  /**
   * Stream real-time analysis for continuous monitoring
   */
  async *streamMarketAnalysis(marketData) {
    try {
      logger.info('[AI-Analysis] Starting streaming market analysis')

      const context = this._buildAnalysisContext(marketData)

      const systemPrompt = `You are a real-time trading analyst providing instant market insights.
Provide concise, actionable analysis focusing on immediate opportunities and risks.
Format insights as short, clear statements.`

      const userPrompt = `Provide real-time trading insights for these market conditions:

${context}

Focus on:
1. Immediate trading opportunities
2. Key risk factors
3. Quick action items`

      const stream = await streamText({
        model: 'anthropic/claude-opus-4.5',
        system: systemPrompt,
        prompt: userPrompt,
        temperature: 0.2,
        maxTokens: 1000,
      })

      for await (const chunk of stream.textStream) {
        yield chunk
      }

      logger.info('[AI-Analysis] Streaming analysis completed')
    } catch (error) {
      logger.error('[AI-Analysis] Error in streaming analysis', error)
      throw error
    }
  }

  /**
   * Get trading suggestions based on current positions and market data
   */
  async getTradingSuggestions(currentPositions, marketData) {
    try {
      logger.info('[AI-Analysis] Generating trading suggestions')

      const context = `
Current Active Positions:
${JSON.stringify(currentPositions, null, 2)}

Market Data:
${JSON.stringify(marketData, null, 2)}

Risk Manager Status:
- Total Exposure: ${riskManager.getTotalExposure()}
- Position Count: ${currentPositions.length}
- Daily Loss: ${riskManager.dailyLoss}
- Daily Profit: ${riskManager.dailyProfit}`

      const systemPrompt = `You are a professional trading advisor specializing in Solana tokens.
Provide actionable trading suggestions considering:
- Current risk exposure
- Market conditions
- Position management
- Capital preservation

Be specific with entry points, targets, and stop-losses.`

      const userPrompt = `Based on the following data, provide specific trading suggestions:

${context}

Return suggestions in JSON format with keys: action, symbol, entryPrice, targetPrice, stopLoss, riskReward, confidence, reasoning`

      const result = await generateText({
        model: 'anthropic/claude-opus-4.5',
        system: systemPrompt,
        prompt: userPrompt,
        temperature: 0.4,
        maxTokens: 2000,
      })

      const suggestions = this._parseSuggestionsResponse(result.text)

      // Store suggestions
      this.tradeSuggestions = suggestions
      
      const historyRecord = {
        timestamp: new Date(),
        type: 'trading_suggestions',
        input: { positions: currentPositions, marketData },
        output: suggestions,
      }
      this._addToHistory(historyRecord)

      // Persist to database
      try {
        const savedAnalysis = await aiPersistence.saveMarketAnalysis({
          input: { positions: currentPositions, marketData },
          output: suggestions,
          rawResponse: result.text,
          confidence: 0.8,
        })
        
        if (savedAnalysis && suggestions.length > 0) {
          await aiPersistence.saveTradingSuggestions(suggestions, savedAnalysis.id)
        }
      } catch (dbError) {
        logger.warn('[AI-Analysis] Failed to save suggestions to database', dbError)
      }

      logger.info(`[AI-Analysis] Generated ${suggestions.length} trading suggestions`)
      return suggestions
    } catch (error) {
      logger.error('[AI-Analysis] Error generating trading suggestions', error)
      throw error
    }
  }

  /**
   * Analyze a specific token for potential investment
   */
  async analyzeToken(tokenMint, tokenData) {
    try {
      logger.info(`[AI-Analysis] Analyzing token: ${tokenMint}`)

      const context = `
Token Information:
- Mint: ${tokenMint}
- Name: ${tokenData.name || 'Unknown'}
- Symbol: ${tokenData.symbol || 'N/A'}
- Price: ${tokenData.price || 'N/A'}
- Market Cap: ${tokenData.marketCap || 'N/A'}
- Volume (24h): ${tokenData.volume24h || 'N/A'}
- Liquidity: ${tokenData.liquidity || 'N/A'}
- Creation Date: ${tokenData.createdAt || 'N/A'}
- Holders: ${tokenData.holders || 'N/A'}
- Additional Data: ${JSON.stringify(tokenData.metadata || {}, null, 2)}`

      const systemPrompt = `You are an expert token analyst with expertise in evaluating Solana tokens.
Provide detailed analysis covering fundamentals, tokenomics, risk factors, and investment potential.
Be objective and highlight both opportunities and risks.`

      const userPrompt = `Perform a detailed analysis of this token:

${context}

Provide analysis covering:
1. Token Fundamentals
2. Tokenomics Assessment
3. Risk Factors
4. Investment Potential
5. Recommendation (BUY/HOLD/AVOID)

Format as JSON with keys: fundamentals, tokenomics, risks, potential, recommendation, confidence, rationale`

      const result = await generateText({
        model: 'anthropic/claude-opus-4.5',
        system: systemPrompt,
        prompt: userPrompt,
        temperature: 0.3,
        maxTokens: 2000,
      })

      const analysis = this._parseTokenAnalysis(result.text)

      const historyRecord = {
        timestamp: new Date(),
        type: 'token_analysis',
        input: { tokenMint, tokenData },
        output: analysis,
      }
      this._addToHistory(historyRecord)

      // Persist to database
      try {
        await aiPersistence.saveTokenAnalysis(tokenMint, {
          name: tokenData.name,
          symbol: tokenData.symbol,
          fundamentalsScore: analysis.fundamentals?.score || 0.5,
          tokenomicsScore: analysis.tokenomics?.score || 0.5,
          riskFactors: analysis.risks || [],
          potential: analysis.potential || 'MEDIUM',
          recommendation: analysis.recommendation || 'HOLD',
          confidence: analysis.confidence || 0.75,
          rationale: analysis.rationale || '',
        })
      } catch (dbError) {
        logger.warn('[AI-Analysis] Failed to save token analysis to database', dbError)
      }

      return analysis
    } catch (error) {
      logger.error('[AI-Analysis] Error analyzing token', error)
      throw error
    }
  }

  /**
   * Get AI-powered risk assessment
   */
  async getRiskAssessment(positions) {
    try {
      logger.info('[AI-Analysis] Performing risk assessment')

      const riskMetrics = riskManager.getRiskMetrics()
      const context = `
Active Positions: ${positions.length}
${positions.map((p) => `- ${p.symbol}: ${p.size} units at $${p.entryPrice}`).join('\n')}

Risk Metrics:
${JSON.stringify(riskMetrics, null, 2)}`

      const systemPrompt = `You are a risk management expert.
Evaluate portfolio risk and provide specific recommendations for risk mitigation.`

      const userPrompt = `Assess the risk in this portfolio:

${context}

Provide assessment with:
1. Overall Risk Score (1-10)
2. Primary Risk Factors
3. Position-level Risks
4. Mitigation Strategies
5. Recommended Actions

Format as JSON with keys: riskScore, factors, positionRisks, mitigation, actions`

      const result = await generateText({
        model: 'anthropic/claude-opus-4.5',
        system: systemPrompt,
        prompt: userPrompt,
        temperature: 0.2,
        maxTokens: 1500,
      })

      const assessment = this._parseRiskAssessment(result.text)

      const historyRecord = {
        timestamp: new Date(),
        type: 'risk_assessment',
        input: { positions, metrics: riskMetrics },
        output: assessment,
      }
      this._addToHistory(historyRecord)

      // Persist to database
      try {
        await aiPersistence.saveRiskAssessment({
          riskScore: assessment.riskScore || 5,
          factors: assessment.factors || [],
          mitigation: assessment.mitigation || [],
          actions: assessment.actions || [],
          portfolioExposure: riskMetrics.totalExposure,
          portfolioSize: positions.length,
        })
      } catch (dbError) {
        logger.warn('[AI-Analysis] Failed to save risk assessment to database', dbError)
      }

      return assessment
    } catch (error) {
      logger.error('[AI-Analysis] Error in risk assessment', error)
      throw error
    }
  }

  // ============== Helper Methods ==============

  _buildAnalysisContext(marketData) {
    return `Market Data Summary:
- Bitcoin Price: ${marketData.btcPrice || 'N/A'}
- Ethereum Price: ${marketData.ethPrice || 'N/A'}
- Solana Price: ${marketData.solPrice || 'N/A'}
- Market Cap (Top 10): ${marketData.marketCap || 'N/A'}
- 24h Volume: ${marketData.volume24h || 'N/A'}
- Market Sentiment: ${marketData.sentiment || 'Neutral'}
- Volatility Index: ${marketData.volatility || 'N/A'}
- Fear & Greed Index: ${marketData.fearGreedIndex || 'N/A'}
- Active Positions: ${marketData.activePositions || 0}
- Daily PnL: ${marketData.dailyPnL || 0}`
  }

  _parseAnalysisResponse(text) {
    try {
      // Try to extract JSON from the response
      const jsonMatch = text.match(/\{[\s\S]*\}/)
      if (jsonMatch) {
        return JSON.parse(jsonMatch[0])
      }

      // Fallback: Return structured response
      return {
        marketSentiment: 'neutral',
        priceAnalysis: text,
        suggestions: [],
        riskLevel: 'medium',
        recommendations: [text],
      }
    } catch (error) {
      logger.warn('[AI-Analysis] Could not parse analysis response as JSON')
      return {
        rawAnalysis: text,
        timestamp: new Date(),
      }
    }
  }

  _parseSuggestionsResponse(text) {
    try {
      const jsonMatch = text.match(/\[\s*\{[\s\S]*\}\s*\]/g)
      if (jsonMatch) {
        return JSON.parse(jsonMatch[0])
      }

      // Try single object
      const singleMatch = text.match(/\{[\s\S]*\}/)
      if (singleMatch) {
        const parsed = JSON.parse(singleMatch[0])
        return Array.isArray(parsed) ? parsed : [parsed]
      }

      return []
    } catch (error) {
      logger.warn('[AI-Analysis] Could not parse suggestions as JSON')
      return []
    }
  }

  _parseTokenAnalysis(text) {
    try {
      const jsonMatch = text.match(/\{[\s\S]*\}/)
      if (jsonMatch) {
        return JSON.parse(jsonMatch[0])
      }
      return { rawAnalysis: text }
    } catch (error) {
      logger.warn('[AI-Analysis] Could not parse token analysis as JSON')
      return { rawAnalysis: text }
    }
  }

  _parseRiskAssessment(text) {
    try {
      const jsonMatch = text.match(/\{[\s\S]*\}/)
      if (jsonMatch) {
        return JSON.parse(jsonMatch[0])
      }
      return { rawAssessment: text }
    } catch (error) {
      logger.warn('[AI-Analysis] Could not parse risk assessment as JSON')
      return { rawAssessment: text }
    }
  }

  _addToHistory(record) {
    this.analysisHistory.push(record)

    // Keep history size manageable
    if (this.analysisHistory.length > this.maxHistorySize) {
      this.analysisHistory.shift()
    }
  }

  // Public getter methods
  getHistory() {
    return this.analysisHistory
  }

  getLatestAnalysis() {
    return this.analysisHistory[this.analysisHistory.length - 1] || null
  }

  getTradeSuggestions() {
    return this.tradeSuggestions
  }

  clearHistory() {
    this.analysisHistory = []
    this.tradeSuggestions = []
    logger.info('[AI-Analysis] History cleared')
  }
}

export default new AIAnalysisService()
