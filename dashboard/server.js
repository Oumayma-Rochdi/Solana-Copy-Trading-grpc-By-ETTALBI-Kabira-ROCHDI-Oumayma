import express from 'express';
import cors from 'cors';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import { exec } from 'child_process';
import fs from 'fs/promises';
import { config } from '../config.js';
import riskManager from '../services/riskManager.js';
import notificationService from '../services/notifications.js';
import { closeAllPositions } from '../main.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const app = express();
const PORT = 3000;

app.use(cors());
app.use(express.json());
app.use(express.static(join(__dirname, 'public')));

// Generate random market data for simulation
function generateMarketData() {
  return {
    price: 100 + Math.random() * 50,
    volume: 1000000 + Math.random() * 50000000,
    volatility: 1 + Math.random() * 8,
    liquidity: 500000 + Math.random() * 9500000,
    rsi: 20 + Math.random() * 60,
    momentum: (Math.random() - 0.5) * 10,
    macd: (Math.random() - 0.5) * 5,
    trend: (Math.random() - 0.5) * 2,
    sentiment: (Math.random() - 0.5) * 2,
    holders: 10000 + Math.floor(Math.random() * 490000),
    market_cap: 50000000 + Math.random() * 4950000000
  };
}

// Endpoint to get live ML prediction stream
app.get('/api/ml/stream', (req, res) => {
  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');

  const interval = setInterval(() => {
    const features = generateMarketData();

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
            res.write(`data: ${JSON.stringify({ features, prediction })}\n\n`);
          } catch (e) {
            console.error('Parse error:', e, stdout);
          }
        });
      })
      .catch(console.error);

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

app.get('/api/risk', (req, res) => {
  res.json(riskManager.getRiskMetrics());
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
