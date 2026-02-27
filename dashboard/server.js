import express from 'express';
import cors from 'cors';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import { exec } from 'child_process';
import fs from 'fs/promises';
import { config } from '../config.js';
import riskManager from '../services/riskManager.js';
import binanceService from '../services/binanceService.js';
import aiAnalysisService from '../services/aiAnalysis.js';
import { closeAllPositions } from '../main.js';
import { token_buy, token_sell } from '../fuc.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const app = express();
const PORT = 3000;

app.use(cors());
app.use(express.json());
app.use(express.static(join(__dirname, 'public')));


// Endpoint to get live ML prediction stream
app.get('/api/ml/stream', (req, res) => {
  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');

  const interval = setInterval(async () => {
    try {
      const features = await binanceService.getAggregatedMarketData();

      // Write temp features file to pass to python script
      const tempFile = join(__dirname, `temp_features_${Date.now()}.json`);

      fs.writeFile(tempFile, JSON.stringify(features))
        .then(() => {
          const scriptPath = join(dirname(__dirname), 'scripts', 'predict.py');
          exec(`python "${scriptPath}" --input "${tempFile}"`, (error, stdout, stderr) => {
            // Cleanup
            fs.unlink(tempFile).catch(console.error);

            if (error) {
              console.error('Python error:', error);
              return;
            }

            try {
              const prediction = JSON.parse(stdout);
              res.write(`data: ${JSON.stringify({ features, prediction, timestamp: Date.now() })}\n\n`);
            } catch (e) {
              console.error('Parse error:', e, stdout);
            }
          });
        })
        .catch(console.error);
    } catch (error) {
      console.error('Stream error:', error);
    }
  }, 3000); // New prediction every 3 seconds

  req.on('close', () => clearInterval(interval));
});

// Dashboard Monitoring Endpoints
app.get('/api/status', (req, res) => {
  res.json({
    bot: {
      status: 'active', // You might want to make this dynamic later
      uptime: riskManager.getDailyStats().uptime || 0
    }
  });
});

app.get('/api/risk', async (req, res) => {
  res.json(await riskManager.getRiskMetrics());
});

app.get('/api/positions', (req, res) => {
  res.json({
    positions: riskManager.getActivePositions()
  });
});

app.get('/api/history', (req, res) => {
  res.json({
    history: riskManager.tradeHistory
  });
});

app.get('/api/config', (req, res) => {
  res.json({
    trading: config.trading,
    risk: config.risk,
    swap: config.swap
  });
});

app.get('/api/market-data', async (req, res) => {
  try {
    const data = await binanceService.getAggregatedMarketData();
    res.json(data);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// AI Analysis Endpoints
app.post('/api/ai/analyze-market', async (req, res) => {
  try {
    const { marketData } = req.body;
    const analysis = await aiAnalysisService.analyzeMarketConditions(marketData);
    res.json({ success: true, analysis });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

app.post('/api/ai/suggestions', async (req, res) => {
  try {
    const { marketData } = req.body;
    const positions = riskManager.getActivePositions();
    const suggestions = await aiAnalysisService.getTradingSuggestions(positions, marketData);
    res.json({ success: true, suggestions, count: suggestions.length });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

app.get('/api/ai/risk-assessment', async (req, res) => {
  try {
    const positions = riskManager.getActivePositions();
    const assessment = await aiAnalysisService.getRiskAssessment(positions);
    res.json({ success: true, assessment });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

app.get('/api/ai/history', (req, res) => {
  const history = aiAnalysisService.getHistory();
  res.json({ history, total: history.length });
});

app.get('/api/ai/current-suggestions', (req, res) => {
  const suggestions = aiAnalysisService.getTradeSuggestions();
  res.json({ suggestions, count: suggestions.length });
});

app.post('/api/ai/clear-history', (req, res) => {
  aiAnalysisService.clearHistory();
  res.json({ success: true });
});

app.post('/api/ai/analyze-market-stream', async (req, res) => {
  try {
    const { marketData } = req.body;
    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');

    const stream = aiAnalysisService.streamMarketAnalysis(marketData);
    for await (const chunk of stream) {
      res.write(`data: ${JSON.stringify({ chunk })}\n\n`);
    }
    res.write('data: [DONE]\n\n');
    res.end();
  } catch (error) {
    console.error('AI Stream error:', error);
    res.end();
  }
});

app.post('/api/trade/execute', async (req, res) => {
  try {
    const { action, symbol, amount, price } = req.body;
    const SOL_MINT = 'So11111111111111111111111111111111111111112';
    
    console.log(`Manual trade execution: ${action} ${symbol} for ${amount} SOL equivalent`);
    
    // Prevent SOL-to-SOL swaps which Jupiter API rejects
    if (symbol === 'SOL' || symbol === SOL_MINT) {
      return res.status(400).json({ 
        success: false, 
        error: `Invalid swap: Cannot ${action} SOL using SOL as the base. Please provide a different token mint address to trade.` 
      });
    }

    let result;
    if (action === 'BUY') {
      result = await token_buy(symbol, amount);
    } else if (action === 'SELL') {
      result = await token_sell(symbol, amount);
    }
    
    if (result) {
      res.json({ success: true, txHash: result });
    } else {
      res.status(500).json({ success: false, error: 'Transaction failed or rejected by the network.' });
    }
  } catch (error) {
    console.error('Manual trade error:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

app.post('/api/emergency/close-all', async (req, res) => {
  try {
    const { reason } = req.body;
    // Notify via risk manager that emergency close is starting
    await riskManager.emergencyCloseAll(reason);

    // Call the actual trading engine to close all positions via swap
    const results = await closeAllPositions();
    res.json({ success: true, results });
  } catch (error) {
    console.error('Emergency close error:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// Start server
app.listen(PORT, () => {
  console.log(`🚀 Neural/RF ML Server running on port ${PORT}`);
  console.log(`👉 Open http://localhost:${PORT} in your browser`);
});
