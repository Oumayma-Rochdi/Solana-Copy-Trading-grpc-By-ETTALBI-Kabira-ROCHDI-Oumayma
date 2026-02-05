/**
 * AI Bot Integration Tests
 * Tests the AI analysis service and API endpoints
 */

import aiAnalysis from '../services/aiAnalysis.js'
import aiPersistence from '../services/aiPersistence.js'
import logger from '../utils/logger.js'

// Test configuration
const TEST_CONFIG = {
  timeout: 30000,
  marketData: {
    btcPrice: 42500,
    ethPrice: 2250,
    solPrice: 150,
    sentiment: 'bullish',
    volatility: 'high',
    fearGreedIndex: 65,
    volume24h: 1000000,
  },
  tokenMint: 'EPjFWaLb3cwQB6L2AgJCm53wrguZoJRUeKT7WD4kqmQ',
  tokenData: {
    name: 'USDC',
    symbol: 'USDC',
    price: 1.0,
    marketCap: 25000000000,
    holders: 1000000,
  },
}

// Test suite
class AIBotTestSuite {
  constructor() {
    this.results = {
      passed: 0,
      failed: 0,
      skipped: 0,
      tests: [],
    }
  }

  async runAllTests() {
    console.log('\n========== AI Trading Bot Test Suite ==========\n')

    try {
      // Test 1: Market Analysis
      await this.testMarketAnalysis()

      // Test 2: Trading Suggestions
      await this.testTradingSuggestions()

      // Test 3: Token Analysis
      await this.testTokenAnalysis()

      // Test 4: Risk Assessment
      await this.testRiskAssessment()

      // Test 5: Database Persistence
      await this.testDatabasePersistence()

      // Test 6: History Management
      await this.testHistoryManagement()
    } catch (error) {
      this.logError('Fatal test suite error', error)
    }

    this.printResults()
  }

  async testMarketAnalysis() {
    const testName = 'Market Analysis'
    console.log(`\n[TEST] ${testName}`)

    try {
      console.log('  -> Analyzing market conditions...')
      const result = await aiAnalysis.analyzeMarketConditions(TEST_CONFIG.marketData)

      if (result && result.marketSentiment) {
        console.log(`  ✓ Market sentiment: ${result.marketSentiment}`)
        console.log(`  ✓ Risk level: ${result.riskLevel}`)
        this.pass(testName)
      } else {
        console.log('  ✗ Invalid market analysis response')
        this.fail(testName)
      }
    } catch (error) {
      this.logError(`${testName} failed`, error)
      this.fail(testName)
    }
  }

  async testTradingSuggestions() {
    const testName = 'Trading Suggestions'
    console.log(`\n[TEST] ${testName}`)

    try {
      console.log('  -> Generating trading suggestions...')
      const suggestions = await aiAnalysis.getTradingSuggestions([], TEST_CONFIG.marketData)

      if (Array.isArray(suggestions) && suggestions.length > 0) {
        console.log(`  ✓ Generated ${suggestions.length} suggestions`)
        console.log(`  ✓ First suggestion: ${suggestions[0].action} ${suggestions[0].symbol}`)
        this.pass(testName)
      } else if (Array.isArray(suggestions)) {
        console.log('  ⚠ Generated 0 suggestions (this is valid)')
        this.pass(testName)
      } else {
        console.log('  ✗ Invalid suggestions response')
        this.fail(testName)
      }
    } catch (error) {
      this.logError(`${testName} failed`, error)
      this.fail(testName)
    }
  }

  async testTokenAnalysis() {
    const testName = 'Token Analysis'
    console.log(`\n[TEST] ${testName}`)

    try {
      console.log(`  -> Analyzing token: ${TEST_CONFIG.tokenData.symbol}...`)
      const analysis = await aiAnalysis.analyzeToken(
        TEST_CONFIG.tokenMint,
        TEST_CONFIG.tokenData
      )

      if (analysis && (analysis.recommendation || analysis.rawAnalysis)) {
        const recommendation = analysis.recommendation || 'N/A'
        console.log(`  ✓ Token recommendation: ${recommendation}`)
        this.pass(testName)
      } else {
        console.log('  ✗ Invalid token analysis response')
        this.fail(testName)
      }
    } catch (error) {
      this.logError(`${testName} failed`, error)
      this.fail(testName)
    }
  }

  async testRiskAssessment() {
    const testName = 'Risk Assessment'
    console.log(`\n[TEST] ${testName}`)

    try {
      console.log('  -> Assessing portfolio risk...')
      const assessment = await aiAnalysis.getRiskAssessment([])

      if (assessment && (assessment.riskScore !== undefined || assessment.rawAssessment)) {
        const score = assessment.riskScore || 'N/A'
        console.log(`  ✓ Risk score: ${score}/10`)
        this.pass(testName)
      } else {
        console.log('  ✗ Invalid risk assessment response')
        this.fail(testName)
      }
    } catch (error) {
      this.logError(`${testName} failed`, error)
      this.fail(testName)
    }
  }

  async testDatabasePersistence() {
    const testName = 'Database Persistence'
    console.log(`\n[TEST] ${testName}`)

    try {
      console.log('  -> Testing database connection...')
      await aiPersistence.initialize()

      console.log('  -> Saving test data to database...')
      const savedAnalysis = await aiPersistence.saveMarketAnalysis({
        input: TEST_CONFIG.marketData,
        output: { test: true },
        rawResponse: 'Test response',
        confidence: 0.95,
      })

      if (savedAnalysis && savedAnalysis.id) {
        console.log(`  ✓ Saved analysis with ID: ${savedAnalysis.id}`)

        // Test retrieval
        const history = await aiPersistence.getAnalysisHistory('market_analysis', 1)
        if (history && history.length > 0) {
          console.log(`  ✓ Retrieved analysis from database`)
          this.pass(testName)
        } else {
          console.log('  ✗ Could not retrieve saved analysis')
          this.fail(testName)
        }
      } else {
        console.log('  ✗ Failed to save analysis')
        this.fail(testName)
      }
    } catch (error) {
      this.logError(`${testName} failed`, error)
      this.fail(testName)
    }
  }

  async testHistoryManagement() {
    const testName = 'History Management'
    console.log(`\n[TEST] ${testName}`)

    try {
      console.log('  -> Checking in-memory history...')
      const history = aiAnalysis.getHistory()

      if (Array.isArray(history)) {
        console.log(`  ✓ History loaded: ${history.length} entries`)

        const latest = aiAnalysis.getLatestAnalysis()
        if (latest) {
          console.log(`  ✓ Latest analysis type: ${latest.type}`)
        }

        this.pass(testName)
      } else {
        console.log('  ✗ Invalid history format')
        this.fail(testName)
      }
    } catch (error) {
      this.logError(`${testName} failed`, error)
      this.fail(testName)
    }
  }

  // Helper methods
  pass(testName) {
    this.results.passed++
    this.results.tests.push({ name: testName, status: 'PASSED' })
  }

  fail(testName) {
    this.results.failed++
    this.results.tests.push({ name: testName, status: 'FAILED' })
  }

  skip(testName) {
    this.results.skipped++
    this.results.tests.push({ name: testName, status: 'SKIPPED' })
  }

  logError(message, error) {
    console.error(`  ✗ Error: ${message}`)
    if (error.message) {
      console.error(`    ${error.message}`)
    }
  }

  printResults() {
    console.log('\n========== Test Results ==========\n')
    console.log(`Passed:  ${this.results.passed}`)
    console.log(`Failed:  ${this.results.failed}`)
    console.log(`Skipped: ${this.results.skipped}`)
    console.log(`Total:   ${this.results.tests.length}`)

    if (this.results.failed > 0) {
      console.log('\nFailed Tests:')
      this.results.tests
        .filter((t) => t.status === 'FAILED')
        .forEach((t) => console.log(`  - ${t.name}`))
    }

    console.log('\n==================================\n')

    const success = this.results.failed === 0
    console.log(success ? '✓ All tests passed!' : '✗ Some tests failed')

    process.exit(success ? 0 : 1)
  }
}

// Run tests
const suite = new AIBotTestSuite()
suite.runAllTests().catch((error) => {
  console.error('Fatal error running tests:', error)
  process.exit(1)
})

export default AIBotTestSuite
