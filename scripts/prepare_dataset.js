import binanceService from '../services/binanceService.js';
import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DATA_PATH = path.join(path.dirname(__dirname), 'data', 'market_dataset.csv');

async function prepareDataset() {
    console.log('🚀 Starting real market dataset preparation from Binance...');
    
    const symbol = 'SOLUSDT';
    const interval = '15m';
    const limit = 500; // Fetch 500 candles (~5 days of 15m data)

    try {
        const klines = await binanceService.fetchKlines(symbol, interval, limit);
        if (klines.length < 50) {
            throw new Error('Not enough market data retrieved.');
        }

        console.log(`📊 Fetched ${klines.length} candles for ${symbol}`);

        const dataset = [];
        const header = 'timestamp,price,volume,volatility,liquidity,rsi,momentum,macd,trend,sentiment,holders,market_cap,label';
        
        // We need some history to compute indicators, start from index 30
        for (let i = 30; i < klines.length - 10; i++) {
            const currentCandle = klines[i];
            const slice = klines.slice(0, i + 1);
            
            // Indicators
            const indicators = await computeIndicators(slice);
            
            // Labelling based on future price (look forward 5 candles)
            const futurePrice = klines[i + 5].close;
            const currentPrice = currentCandle.close;
            const priceChange = (futurePrice - currentPrice) / currentPrice;
            
            let label = 'HOLD';
            if (priceChange > 0.005) label = 'BUY'; // +0.5%
            else if (priceChange < -0.005) label = 'SELL'; // -0.5%

            const row = [
                new Date(currentCandle.timestamp).toISOString(),
                currentPrice,
                currentCandle.volume,
                indicators.volatility,
                currentCandle.volume * 0.1, // Liquidity proxy
                indicators.rsi,
                ((currentPrice - klines[i-4].close) / klines[i-4].close) * 100, // Momentum
                0, // MACD placeholder
                priceChange > 0 ? 1 : -1,
                indicators.rsi > 60 ? 1 : (indicators.rsi < 40 ? -1 : 0),
                150000 + Math.floor(Math.random() * 5000), // Holders proxy
                currentPrice * 560000000, // Market Cap proxy
                label
            ];

            dataset.push(row.join(','));
        }

        await fs.writeFile(DATA_PATH, header + '\n' + dataset.join('\n'));
        console.log(`✅ Real dataset saved to ${DATA_PATH}`);
        console.log(`📈 Dataset size: ${dataset.length} rows`);

    } catch (error) {
        console.error('❌ Error preparing dataset:', error);
    }
}

async function computeIndicators(klines) {
    const closes = klines.map(k => k.close);
    
    // Simple Volatility (Standard Deviation of last 20 closes)
    const last20 = closes.slice(-20);
    const mean = last20.reduce((a, b) => a + b) / 20;
    const sqDiffs = last20.map(v => Math.pow(v - mean, 2));
    const avgSqDiff = sqDiffs.reduce((a, b) => a + b) / 20;
    const volatility = Math.sqrt(avgSqDiff) / mean * 100;

    // Simple RSI (14 period)
    let gains = 0;
    let losses = 0;
    const rsiPeriod = 14;
    for (let i = closes.length - rsiPeriod; i < closes.length; i++) {
        const diff = closes[i] - closes[i - 1];
        if (diff >= 0) gains += diff;
        else losses -= diff;
    }
    const avgGain = gains / rsiPeriod;
    const avgLoss = losses / rsiPeriod;
    const rs = avgLoss === 0 ? 100 : avgGain / avgLoss;
    const rsi = 100 - (100 / (1 + rs));

    return {
        rsi: parseFloat(rsi.toFixed(2)),
        volatility: parseFloat(volatility.toFixed(2))
    };
}

prepareDataset();
