import { Connection, PublicKey, LAMPORTS_PER_SOL, Keypair } from '@solana/web3.js';
import bs58 from 'bs58';
import { config } from '../config.js';
import logger from '../utils/logger.js';
import notificationService from './notifications.js';
import binanceService from './binanceService.js';

class RiskManager {
  constructor() {
    this.dailyStats = {
      totalTrades: 0,
      profitableTrades: 0,
      losingTrades: 0,
      totalProfit: 0,
      totalLoss: 0,
      netPnL: 0,
      startTime: new Date(),
    };

    this.simulatedCashDelta = 0;
    this.activePositions = new Map();
    this.tradeHistory = [];
    this.lastTradeTime = 0;
    this.realBalance = 0;
    this.virtualBalance = 0;
    this.simulatedRealizedPnL = 0; // For stats

    // Initialize connection
    this.connection = new Connection(config.wallet.rpcUrl, 'confirmed');
    try {
      const decoded = bs58.decode(config.wallet.privateKey);
      this.publicKey = Keypair.fromSecretKey(decoded).publicKey;
    } catch (err) {
      logger.error('[RiskManager] Invalid private key in config', err);
    }

    // Initial balance sync (one-time initialization)
    this.isInitialized = false;
    this.syncWalletBalance();

    // Reset daily stats at midnight
    this.scheduleDailyReset();
  }

  // Sync realBalance with real Solana wallet balance
  async syncWalletBalance() {
    if (!this.publicKey) return;

    try {
      const balanceLamports = await this.connection.getBalance(this.publicKey);
      this.realBalance = balanceLamports / LAMPORTS_PER_SOL;
      
      // Update virtualBalance (Equity) = Real Balance + Simulated Cash Delta + Total Position Value
      const positions = this.getActivePositions();
      const totalPositionValue = positions.reduce((sum, pos) => {
        const pnlRatio = pos.currentPrice / pos.entryPrice;
        return sum + (pos.entryAmount * pnlRatio);
      }, 0);

      this.virtualBalance = this.realBalance + this.simulatedCashDelta + totalPositionValue;
      
      logger.debug(`[RiskManager] Balance synced - Real: ${this.realBalance}, Equity: ${this.virtualBalance}`);
    } catch (err) {
      logger.error('[RiskManager] Error syncing wallet balance', err);
    }
  }

  // Check if a new trade is allowed
  canExecuteTrade(amount, tokenMint) {
    const now = Date.now();
    const errors = [];

    // Check daily loss limit
    if (this.dailyStats.netPnL <= -config.risk.maxDailyLoss) {
      errors.push(`Daily loss limit reached: ${this.dailyStats.netPnL.toFixed(4)} SOL`);
    }

    // Check single trade loss limit
    if (amount > config.risk.maxSingleLoss) {
      errors.push(`Trade amount ${amount} SOL exceeds single trade limit ${config.risk.maxSingleLoss} SOL`);
    }

    // Check position limit
    if (this.activePositions.size >= config.trading.maxPositions) {
      errors.push(`Maximum positions limit reached: ${this.activePositions.size}/${config.trading.maxPositions}`);
    }

    // Check cooldown period
    if (now - this.lastTradeTime < config.risk.tradeCooldown) {
      const remainingCooldown = config.risk.tradeCooldown - (now - this.lastTradeTime);
      errors.push(`Trade cooldown active: ${Math.ceil(remainingCooldown / 1000)}s remaining`);
    }

    // Check if token is already in active positions
    if (this.activePositions.has(tokenMint)) {
      errors.push(`Token ${tokenMint} already has an active position`);
    }

    if (errors.length > 0) {
      logger.warn('Trade blocked by risk manager', { errors, amount, tokenMint });
      return { allowed: false, errors };
    }

    return { allowed: true, errors: [] };
  }

  // Record a new trade
  recordTrade(tradeType, tokenMintOrTradeId, amount, price, txHash) {
    const now = Date.now();
    this.lastTradeTime = now;

    const trade = {
      type: tradeType,
      amount,
      price,
      txHash,
      timestamp: now,
      status: 'pending',
    };

    if (tradeType === 'buy') {
      const tokenMint = tokenMintOrTradeId;
      trade.tokenMint = tokenMint;
      trade.id = `${tokenMint}-${now}`;

      this.activePositions.set(trade.id, {
        tokenMint: tokenMint,
        entryPrice: price,
        entryAmount: amount, // Assuming amount is in SOL
        entryTime: now,
        entryValue: amount, // Value in SOL
        currentPrice: price,
        tradeId: trade.id,
        txHash: txHash
      });

      // If it's a simulated trade, subtract cost from sim cash delta to reflect "spent" SOL
      if (!txHash || txHash.startsWith('sim_')) {
        this.simulatedCashDelta -= amount;
      }
      
      logger.info(`Position opened: ${tokenMint}`, {
        entryPrice: price,
        entryAmount: amount,
        entryValue: amount * price,
      });

      notificationService.notifyPositionUpdate('opened', tokenMint, {
        entryPrice: price,
        entryAmount: amount,
        entryValue: amount * price,
      });
    } else if (tradeType === 'sell') {
      const tradeIdOrMint = tokenMintOrTradeId;
      // Try to find by key (tradeId) or by tokenMint
      let tradeId = tradeIdOrMint;
      let position = this.activePositions.get(tradeId);
      
      if (!position) {
        // Fallback: search by tokenMint in values
        for (const [key, pos] of this.activePositions.entries()) {
          if (pos.tokenMint === tradeIdOrMint || pos.mint === tradeIdOrMint) {
            tradeId = key;
            position = pos;
            break;
          }
        }
      }

      if (position) {
        const tokenMint = position.tokenMint || position.mint;
        trade.tokenMint = tokenMint;
        trade.id = `${tokenMint}-sell-${now}`;

        const pnlRatio = price / position.entryPrice;
        const pnl = position.entryAmount * (pnlRatio - 1);
        
        trade.pnl = pnl;
        trade.pnlRatio = pnlRatio;
        trade.entryPrice = position.entryPrice;
        trade.entryValue = position.entryAmount;

        // If it was a simulated trade, add back result (cost + PnL) to sim cash delta
        if (!position.txHash || position.txHash.startsWith('sim_')) {
          this.simulatedCashDelta += position.entryAmount * pnlRatio;
        }

        this.simulatedRealizedPnL += pnl; // Keep for history/stats
        this.updateDailyStats(pnl, pnlRatio > 1);

        // Remove from active positions
        this.activePositions.delete(tradeId);

        logger.info(`Position closed: ${tokenMint}`, {
          pnl,
          pnlRatio: pnlRatio.toFixed(2),
          entryPrice: position.entryPrice,
          exitPrice: price,
        });

        // Send appropriate notification
        if (pnlRatio >= config.trading.profitTarget) {
          notificationService.notifyProfitTarget(tokenMint, pnlRatio, amount);
        } else if (pnlRatio <= config.trading.stopLoss) {
          notificationService.notifyStopLoss(tokenMint, pnlRatio, amount);
        } else {
          notificationService.notifyPositionUpdate('closed', tokenMint, {
            pnl,
            pnlRatio: pnlRatio.toFixed(2),
            reason: 'manual',
          });
        }
      }
    }

    this.tradeHistory.push(trade);
    logger.debug('Trade recorded', trade);

    return trade;
  }

  // Update position price
  updatePositionPrice(tokenMint, newPrice) {
    const position = this.activePositions.get(tokenMint);
    if (position) {
      position.currentPrice = newPrice;
      const pnlRatio = newPrice / position.entryPrice;
      position.pnl = position.entryAmount * (pnlRatio - 1); // SOL PnL
    }
  }

  // Check if position should be closed based on risk parameters
  shouldClosePosition(tokenMint) {
    const position = this.activePositions.get(tokenMint);
    if (!position) return { shouldClose: false, reason: null };

    const now = Date.now();
    const holdTime = now - position.entryTime;

    // Check profit target
    if (position.pnlRatio >= config.trading.profitTarget) {
      return { shouldClose: true, reason: 'profit_target', pnlRatio: position.pnlRatio };
    }

    // Check stop loss
    if (position.pnlRatio <= config.trading.stopLoss) {
      return { shouldClose: true, reason: 'stop_loss', pnlRatio: position.pnlRatio };
    }

    // Check max hold time
    if (holdTime >= config.trading.maxHoldTime) {
      return { shouldClose: true, reason: 'max_hold_time', holdTime };
    }

    return { shouldClose: false, reason: null };
  }

  // Get position information
  getPosition(tokenMint) {
    return this.activePositions.get(tokenMint);
  }

  // Get sequence of positions 
  getActivePositions() {
    return Array.from(this.activePositions.entries()).map(([key, position]) => ({
      ...position,
      tradeId: position.tradeId || key, // Ensure we have the map key
      mint: position.tokenMint || position.mint || (key.includes('-') ? key.split('-')[0] : key),
      holdTime: Date.now() - position.entryTime,
    }));
  }

  // Get position summary
  getPositionSummary() {
    const positions = this.getActivePositions();
    const totalPnL = positions.reduce((sum, pos) => sum + (pos.pnl || 0), 0);
    const totalExposure = positions.reduce((sum, pos) => sum + pos.entryAmount, 0);

    return {
      activePositions: positions.length,
      totalPnL,
      totalExposure,
      averagePnL: positions.length > 0 ? totalPnL / positions.length : 0,
    };
  }

  // Get daily statistics
  getDailyStats() {
    const now = new Date();
    const startOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const uptime = now - this.dailyStats.startTime;

    return {
      ...this.dailyStats,
      virtualBalance: this.virtualBalance,
      uptime,
      winRate: this.dailyStats.totalTrades > 0
        ? (this.dailyStats.profitableTrades / this.dailyStats.totalTrades * 100).toFixed(2)
        : 0,
      averageProfit: this.dailyStats.profitableTrades > 0
        ? this.dailyStats.totalProfit / this.dailyStats.profitableTrades
        : 0,
      averageLoss: this.dailyStats.losingTrades > 0
        ? this.dailyStats.totalLoss / this.dailyStats.losingTrades
        : 0,
    };
  }

  // Update daily statistics
  updateDailyStats(pnl, isProfitable) {
    this.dailyStats.totalTrades++;

    if (isProfitable) {
      this.dailyStats.profitableTrades++;
      this.dailyStats.totalProfit += pnl;
    } else {
      this.dailyStats.losingTrades++;
      this.dailyStats.totalLoss += Math.abs(pnl);
    }

    this.dailyStats.netPnL += pnl;

    // Log daily stats update
    logger.debug('Daily stats updated', {
      totalTrades: this.dailyStats.totalTrades,
      netPnL: this.dailyStats.netPnL.toFixed(4),
    });

    // Check if daily loss limit is approaching
    if (this.dailyStats.netPnL <= -config.risk.maxDailyLoss * 0.8) {
      notificationService.sendNotification(
        `⚠️ Daily loss limit approaching: ${this.dailyStats.netPnL.toFixed(4)} SOL`,
        'warning',
        { dailyStats: this.dailyStats }
      );
    }
  }

  // Reset daily statistics
  resetDailyStats() {
    const previousStats = { ...this.dailyStats };

    this.dailyStats = {
      totalTrades: 0,
      profitableTrades: 0,
      losingTrades: 0,
      totalProfit: 0,
      totalLoss: 0,
      netPnL: 0,
      startTime: new Date(),
    };

    logger.info('Daily stats reset', { previousStats });
    notificationService.sendNotification(
      `📊 Daily trading session ended. Net PnL: ${previousStats.netPnL.toFixed(4)} SOL`,
      'info',
      { previousStats }
    );
  }

  // Schedule daily reset at midnight
  scheduleDailyReset() {
    const now = new Date();
    const tomorrow = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1);
    const timeUntilMidnight = tomorrow - now;

    setTimeout(() => {
      this.resetDailyStats();
      // Schedule next reset
      this.scheduleDailyReset();
    }, timeUntilMidnight);
  }

  // Emergency close all positions
  async emergencyCloseAll(reason = 'emergency') {
    logger.warn('Emergency closing all positions', { reason });

    const positions = Array.from(this.activePositions.keys());
    const results = [];

    for (const mint of positions) {
      try {
        const position = this.activePositions.get(mint);
        if (position) {
          // Mark position for emergency closure
          position.emergencyClose = true;
          position.emergencyReason = reason;

          results.push({
            mint,
            status: 'marked_for_closure',
            reason,
          });
        }
      } catch (error) {
        logger.error('Error marking position for emergency closure', { mint, error });
        results.push({
          mint,
          status: 'error',
          error: error.message,
        });
      }
    }

    notificationService.sendNotification(
      `🚨 Emergency closure initiated for ${positions.length} positions`,
      'warning',
      { reason, results }
    );

    return results;
  }

  // Get total exposure across all positions
  getTotalExposure() {
    const positions = this.getActivePositions();
    return positions.reduce((sum, pos) => sum + pos.currentValue, 0);
  }

  // Get risk metrics
  async getRiskMetrics() {
    // Sync balance before returning metrics
    await this.syncWalletBalance();

    const dailyStats = this.getDailyStats();
    const positionSummary = this.getPositionSummary();

    return {
      dailyStats,
      positionSummary,
      riskLevel: await this.calculateRiskLevel(),
      recommendations: this.getRiskRecommendations(),
    };
  }

  // Calculate overall risk level
  async calculateRiskLevel() {
    const dailyStats = this.getDailyStats();
    const positionSummary = this.getPositionSummary();

    let riskScore = 0;

    // Market Volatility (Binance Integration)
    try {
      const marketData = await binanceService.getAggregatedMarketData();
      if (marketData.volatility > 5) {
        riskScore += 20; // High market volatility
      } else if (marketData.volatility > 3) {
        riskScore += 10; // Moderate market volatility
      }
    } catch (error) {
      logger.warn('Failed to fetch volatility for risk score', error);
    }

    // Daily loss proximity
    if (dailyStats.netPnL <= -config.risk.maxDailyLoss * 0.9) {
      riskScore += 30;
    } else if (dailyStats.netPnL <= -config.risk.maxDailyLoss * 0.7) {
      riskScore += 20;
    } else if (dailyStats.netPnL <= -config.risk.maxDailyLoss * 0.5) {
      riskScore += 10;
    }

    // Position concentration
    if (positionSummary.activePositions >= config.trading.maxPositions * 0.8) {
      riskScore += 20;
    }

    // Win rate
    if (dailyStats.winRate < 30) {
      riskScore += 25;
    } else if (dailyStats.winRate < 50) {
      riskScore += 15;
    }

    if (riskScore >= 60) return 'HIGH';
    if (riskScore >= 30) return 'MEDIUM';
    return 'LOW';
  }

  // Get risk recommendations
  getRiskRecommendations() {
    const recommendations = [];
    const dailyStats = this.getDailyStats();
    const positionSummary = this.getPositionSummary();

    if (dailyStats.netPnL <= -config.risk.maxDailyLoss * 0.8) {
      recommendations.push('Consider reducing position sizes or stopping trading for the day');
    }

    if (positionSummary.activePositions >= config.trading.maxPositions * 0.8) {
      recommendations.push('Approaching maximum position limit - consider closing some positions');
    }

    if (dailyStats.winRate < 40) {
      recommendations.push('Low win rate - review trading strategy and risk parameters');
    }

    if (positionSummary.totalPnL < 0) {
      recommendations.push('Overall portfolio in loss - consider implementing stricter stop losses');
    }

    return recommendations;
  }
}

// Create singleton instance
const riskManager = new RiskManager();

export default riskManager;
