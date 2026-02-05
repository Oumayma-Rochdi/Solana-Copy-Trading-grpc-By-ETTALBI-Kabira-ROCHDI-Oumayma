import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import compression from 'compression';
import { RateLimiterMemory } from 'rate-limiter-flexible';
import { config } from '../config.js';
import logger from '../utils/logger.js';
import riskManager from '../services/riskManager.js';
import notificationService from '../services/notifications.js';
import { copyTradingAPI } from '../services/copyTradingDashboard.js';
import aiAnalysis from '../services/aiAnalysis.js';
import aiPersistence from '../services/aiPersistence.js';

const app = express();
const PORT = process.env.DASHBOARD_PORT || 3000;

// Rate limiting
const rateLimiter = new RateLimiterMemory({
  keyGenerator: (req) => req.ip,
  points: config.security.maxRequestsPerMinute,
  duration: 60,
});

// Middleware
app.use(helmet());
app.use(cors());
app.use(compression());
app.use(express.json());
app.use(express.static('dashboard/public'));

// Rate limiting middleware
app.use(async (req, res, next) => {
  try {
    await rateLimiter.consume(req.ip);
    next();
  } catch (rejRes) {
    res.status(429).json({
      error: 'Too many requests',
      retryAfter: Math.round(rejRes.msBeforeNext / 1000),
    });
  }
});

// Health check endpoint
app.get('/api/health', (req, res) => {
  res.json({
    status: 'healthy',
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
  });
});

// Copy Trading Routes
app.get('/api/copy-trading/wallets', copyTradingAPI.getTrackedWallets);
app.post('/api/copy-trading/wallets', copyTradingAPI.addWalletToTrack);
app.delete('/api/copy-trading/wallets/:walletAddress', copyTradingAPI.removeWalletFromTrack);
app.get('/api/copy-trading/stats', copyTradingAPI.getStats);
app.get('/api/copy-trading/stats/:walletAddress', copyTradingAPI.getWalletStats);
app.post('/api/copy-trading/toggle', copyTradingAPI.toggleCopyTrading);

// Get bot status and configuration
app.get('/api/status', (req, res) => {
  try {
    const status = {
      bot: {
        status: 'running',
        uptime: process.uptime(),
        version: '2.0.0',
        timestamp: new Date().toISOString(),
      },
      config: {
        trading: config.trading,
        risk: config.risk,
        pools: config.pools,
      },
    };
    
    res.json(status);
  } catch (error) {
    logger.error('Error getting bot status', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Get risk metrics
app.get('/api/risk', (req, res) => {
  try {
    const riskMetrics = riskManager.getRiskMetrics();
    res.json(riskMetrics);
  } catch (error) {
    logger.error('Error getting risk metrics', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Get active positions
app.get('/api/positions', (req, res) => {
  try {
    const positions = riskManager.getActivePositions();
    const summary = riskManager.getPositionSummary();
    
    res.json({
      positions,
      summary,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    logger.error('Error getting positions', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Get trading history
app.get('/api/history', (req, res) => {
  try {
    const history = riskManager.tradeHistory || [];
    const dailyStats = riskManager.getDailyStats();
    
    res.json({
      history,
      dailyStats,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    logger.error('Error getting trading history', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Get daily statistics
app.get('/api/stats', (req, res) => {
  try {
    const dailyStats = riskManager.getDailyStats();
    res.json(dailyStats);
  } catch (error) {
    logger.error('Error getting daily stats', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Emergency actions
app.post('/api/emergency/close-all', async (req, res) => {
  try {
    const { reason } = req.body;
    const results = await riskManager.emergencyCloseAll(reason || 'dashboard_request');
    
    res.json({
      success: true,
      message: 'Emergency closure initiated',
      results,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    logger.error('Error initiating emergency closure', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Send test notification
app.post('/api/notifications/test', async (req, res) => {
  try {
    const { message, type } = req.body;
    await notificationService.sendNotification(
      message || 'Test notification from dashboard',
      type || 'info',
      { source: 'dashboard' }
    );
    
    res.json({
      success: true,
      message: 'Test notification sent',
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    logger.error('Error sending test notification', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Update configuration (read-only for now, could be extended)
app.get('/api/config', (req, res) => {
  try {
    // Return safe configuration (no sensitive data)
    const safeConfig = {
      trading: config.trading,
      risk: config.risk,
      pools: config.pools,
      swap: config.swap,
      logging: config.logging,
    };
    
    res.json(safeConfig);
  } catch (error) {
    logger.error('Error getting configuration', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// WebSocket endpoint for real-time updates (placeholder)
app.get('/api/ws', (req, res) => {
  res.json({
    message: 'WebSocket endpoint - implement with Socket.IO for real-time updates',
    timestamp: new Date().toISOString(),
  });
});

// ============== AI Analysis Endpoints ==============

// Get market analysis
app.post('/api/ai/analyze-market', async (req, res) => {
  try {
    const { marketData } = req.body;

    if (!marketData) {
      return res.status(400).json({
        error: 'Missing marketData',
        timestamp: new Date().toISOString(),
      });
    }

    const analysis = await aiAnalysis.analyzeMarketConditions(marketData);

    res.json({
      success: true,
      analysis,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    logger.error('Error in market analysis endpoint', error);
    res.status(500).json({
      error: 'Failed to analyze market',
      message: error.message,
      timestamp: new Date().toISOString(),
    });
  }
});

// Stream market analysis
app.post('/api/ai/analyze-market-stream', async (req, res) => {
  try {
    const { marketData } = req.body;

    if (!marketData) {
      return res.status(400).json({
        error: 'Missing marketData',
        timestamp: new Date().toISOString(),
      });
    }

    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');

    for await (const chunk of aiAnalysis.streamMarketAnalysis(marketData)) {
      res.write(`data: ${JSON.stringify({ chunk })}\n\n`);
    }

    res.write('data: [DONE]\n\n');
    res.end();
  } catch (error) {
    logger.error('Error in streaming analysis endpoint', error);
    res.status(500).json({
      error: 'Failed to stream analysis',
      message: error.message,
      timestamp: new Date().toISOString(),
    });
  }
});

// Get trading suggestions
app.post('/api/ai/suggestions', async (req, res) => {
  try {
    const positions = riskManager.getActivePositions();
    const { marketData } = req.body;

    if (!marketData) {
      return res.status(400).json({
        error: 'Missing marketData',
        timestamp: new Date().toISOString(),
      });
    }

    const suggestions = await aiAnalysis.getTradingSuggestions(positions, marketData);

    res.json({
      success: true,
      suggestions,
      count: suggestions.length,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    logger.error('Error generating trading suggestions', error);
    res.status(500).json({
      error: 'Failed to generate suggestions',
      message: error.message,
      timestamp: new Date().toISOString(),
    });
  }
});

// Analyze specific token
app.post('/api/ai/analyze-token', async (req, res) => {
  try {
    const { tokenMint, tokenData } = req.body;

    if (!tokenMint || !tokenData) {
      return res.status(400).json({
        error: 'Missing tokenMint or tokenData',
        timestamp: new Date().toISOString(),
      });
    }

    const analysis = await aiAnalysis.analyzeToken(tokenMint, tokenData);

    res.json({
      success: true,
      analysis,
      tokenMint,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    logger.error('Error analyzing token', error);
    res.status(500).json({
      error: 'Failed to analyze token',
      message: error.message,
      timestamp: new Date().toISOString(),
    });
  }
});

// Get risk assessment
app.get('/api/ai/risk-assessment', async (req, res) => {
  try {
    const positions = riskManager.getActivePositions();
    const assessment = await aiAnalysis.getRiskAssessment(positions);

    res.json({
      success: true,
      assessment,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    logger.error('Error in risk assessment endpoint', error);
    res.status(500).json({
      error: 'Failed to assess risk',
      message: error.message,
      timestamp: new Date().toISOString(),
    });
  }
});

// Get AI analysis history
app.get('/api/ai/history', (req, res) => {
  try {
    const history = aiAnalysis.getHistory();
    const latest = aiAnalysis.getLatestAnalysis();

    res.json({
      success: true,
      total: history.length,
      latest,
      history: history.slice(-10), // Return last 10 entries
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    logger.error('Error getting AI history', error);
    res.status(500).json({
      error: 'Failed to get history',
      message: error.message,
      timestamp: new Date().toISOString(),
    });
  }
});

// Get current trading suggestions from AI
app.get('/api/ai/current-suggestions', (req, res) => {
  try {
    const suggestions = aiAnalysis.getTradeSuggestions();

    res.json({
      success: true,
      suggestions,
      count: suggestions.length,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    logger.error('Error getting current suggestions', error);
    res.status(500).json({
      error: 'Failed to get suggestions',
      message: error.message,
      timestamp: new Date().toISOString(),
    });
  }
});

// Clear AI analysis history
app.post('/api/ai/clear-history', (req, res) => {
  try {
    aiAnalysis.clearHistory();

    res.json({
      success: true,
      message: 'AI analysis history cleared',
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    logger.error('Error clearing AI history', error);
    res.status(500).json({
      error: 'Failed to clear history',
      message: error.message,
      timestamp: new Date().toISOString(),
    });
  }
});

// Get AI statistics from database
app.get('/api/ai/statistics', async (req, res) => {
  try {
    const stats = await aiPersistence.getStatistics();

    res.json({
      success: true,
      statistics: stats,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    logger.error('Error getting AI statistics', error);
    res.status(500).json({
      error: 'Failed to get statistics',
      message: error.message,
      timestamp: new Date().toISOString(),
    });
  }
});

// Get AI analysis from database history
app.get('/api/ai/db-history', async (req, res) => {
  try {
    const type = req.query.type || 'all';
    const limit = parseInt(req.query.limit) || 50;

    const history = await aiPersistence.getAnalysisHistory(type, limit);

    res.json({
      success: true,
      history,
      count: history.length,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    logger.error('Error getting DB history', error);
    res.status(500).json({
      error: 'Failed to get history',
      message: error.message,
      timestamp: new Date().toISOString(),
    });
  }
});

// Get trading suggestions from database
app.get('/api/ai/db-suggestions', async (req, res) => {
  try {
    const limit = parseInt(req.query.limit) || 50;
    const suggestions = await aiPersistence.getTradingSuggestionsHistory(limit);

    res.json({
      success: true,
      suggestions,
      count: suggestions.length,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    logger.error('Error getting DB suggestions', error);
    res.status(500).json({
      error: 'Failed to get suggestions',
      message: error.message,
      timestamp: new Date().toISOString(),
    });
  }
});

// Get token analysis from database
app.get('/api/ai/token/:tokenMint', async (req, res) => {
  try {
    const { tokenMint } = req.params;
    const analysis = await aiPersistence.getTokenAnalysis(tokenMint);

    res.json({
      success: true,
      analysis,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    logger.error('Error getting token analysis', error);
    res.status(500).json({
      error: 'Failed to get token analysis',
      message: error.message,
      timestamp: new Date().toISOString(),
    });
  }
});

// Error handling middleware
app.use((error, req, res, next) => {
  logger.error('Dashboard error', error);
  res.status(500).json({
    error: 'Internal server error',
    message: error.message,
    timestamp: new Date().toISOString(),
  });
});

// 404 handler
app.use('*', (req, res) => {
  res.status(404).json({
    error: 'Endpoint not found',
    timestamp: new Date().toISOString(),
  });
});

// Start server
const server = app.listen(PORT, () => {
  logger.info(`Dashboard server started on port ${PORT}`);
  logger.info(`Dashboard available at: http://localhost:${PORT}`);
});

// Graceful shutdown
process.on('SIGTERM', () => {
  logger.info('SIGTERM received, shutting down dashboard server');
  server.close(() => {
    logger.info('Dashboard server closed');
    process.exit(0);
  });
});

process.on('SIGINT', () => {
  logger.info('SIGINT received, shutting down dashboard server');
  server.close(() => {
    logger.info('Dashboard server closed');
    process.exit(0);
  });
});

export default app;
