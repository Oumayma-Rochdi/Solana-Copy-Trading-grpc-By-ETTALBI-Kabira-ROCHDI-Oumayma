import axios from 'axios';
import logger from '../utils/logger.js';

class BinanceService {
  constructor() {
    this.baseUrl = 'https://api.binance.com/api/v3';
    this.symbols = ['SOLUSDT', 'BTCUSDT', 'ETHUSDT'];
  }

  /**
   * Fetch current ticker data for a symbol
   */
  async fetchTicker(symbol) {
    try {
      const response = await axios.get(`${this.baseUrl}/ticker/24hr`, {
        params: { symbol }
      });
      return {
        symbol: response.data.symbol,
        price: parseFloat(response.data.lastPrice),
        volume: parseFloat(response.data.volume),
        priceChange: parseFloat(response.data.priceChange),
        priceChangePercent: parseFloat(response.data.priceChangePercent),
        high: parseFloat(response.data.highPrice),
        low: parseFloat(response.data.lowPrice),
        quoteVolume: parseFloat(response.data.quoteVolume)
      };
    } catch (error) {
      logger.error(`[BinanceService] Error fetching ticker for ${symbol}:`, error.message);
      return null;
    }
  }

  /**
   * Fetch market summary for SOL, BTC, ETH
   */
  async fetchMarketSummary() {
    try {
      const promises = this.symbols.map(symbol => this.fetchTicker(symbol));
      const results = await Promise.all(promises);
      
      const summary = {};
      results.forEach(res => {
        if (res) {
          summary[res.symbol] = res;
        }
      });
      
      return summary;
    } catch (error) {
      logger.error('[BinanceService] Error fetching market summary:', error.message);
      return {};
    }
  }

  /**
   * Fetch Klines (candlestick) data
   */
  async fetchKlines(symbol, interval = '1h', limit = 100) {
    try {
      const response = await axios.get(`${this.baseUrl}/klines`, {
        params: { symbol, interval, limit }
      });
      
      return response.data.map(k => ({
        timestamp: k[0],
        open: parseFloat(k[1]),
        high: parseFloat(k[2]),
        low: parseFloat(k[3]),
        close: parseFloat(k[4]),
        volume: parseFloat(k[5])
      }));
    } catch (error) {
      logger.error(`[BinanceService] Error fetching klines for ${symbol}:`, error.message);
      return [];
    }
  }

  /**
   * Calculate basic indicators like RSI and Volatility
   */
  async calculateIndicators(symbol) {
    const klines = await this.fetchKlines(symbol, '15m', 50);
    if (klines.length < 20) return null;

    const closes = klines.map(k => k.close);
    
    // Simple Volatility (Standard Deviation of last 20 closes)
    const last20 = closes.slice(-20);
    const mean = last20.reduce((a, b) => a + b) / 20;
    const sqDiffs = last20.map(v => Math.pow(v - mean, 2));
    const avgSqDiff = sqDiffs.reduce((a, b) => a + b) / 20;
    const volatility = Math.sqrt(avgSqDiff) / mean * 100; // Percentage

    // Simple RSI (14 period)
    let gains = 0;
    let losses = 0;
    for (let i = closes.length - 14; i < closes.length; i++) {
        const diff = closes[i] - closes[i - 1];
        if (diff >= 0) gains += diff;
        else losses -= diff;
    }
    const avgGain = gains / 14;
    const avgLoss = losses / 14;
    const rs = avgLoss === 0 ? 100 : avgGain / avgLoss;
    const rsi = 100 - (100 / (1 + rs));

    return {
        rsi: parseFloat(rsi.toFixed(2)),
        volatility: parseFloat(volatility.toFixed(2))
    };
  }
  
  async getAggregatedMarketData() {
    const summary = await this.fetchMarketSummary();
    const solData = summary['SOLUSDT'] || {};
    const indicators = await this.calculateIndicators('SOLUSDT');
    
    return {
      price: solData.price || 0,
      solPrice: solData.price || 0,
      btcPrice: summary['BTCUSDT']?.price || 0,
      ethPrice: summary['ETHUSDT']?.price || 0,
      volume: solData.quoteVolume || 0,
      volume24h: solData.quoteVolume || 0,
      volatility: indicators?.volatility || 5,
      rsi: indicators?.rsi || 50,
      momentum: solData.priceChangePercent || 0,
      macd: 0, // Placeholder for prediction script
      liquidity: solData.quoteVolume * 0.1, 
      trend: solData.priceChangePercent > 0 ? 1 : -1,
      sentiment: indicators?.rsi > 60 ? 1 : (indicators?.rsi < 40 ? -1 : 0),
      holders: 153240, 
      market_cap: solData.price * 560000000 
    };
  }
}

export default new BinanceService();
