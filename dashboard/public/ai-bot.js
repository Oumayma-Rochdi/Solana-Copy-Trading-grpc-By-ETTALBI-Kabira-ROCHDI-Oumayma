// AI Trading Bot Interface
class AITradingBot {
  constructor() {
    this.suggestions = [];
    this.analysis = null;
    this.riskAssessment = null;
    this.isLoading = false;
    this.streamingActive = false;
    this.init();
  }

  init() {
    this.setupEventListeners();
    this.loadInitialData();
  }

  setupEventListeners() {
    // Market analysis button
    const analyzeMarketBtn = document.getElementById('analyzeMarketBtn');
    if (analyzeMarketBtn) {
      analyzeMarketBtn.addEventListener('click', () => this.analyzeMarket());
    }

    // Get suggestions button
    const getSuggestionsBtn = document.getElementById('getSuggestionsBtn');
    if (getSuggestionsBtn) {
      getSuggestionsBtn.addEventListener('click', () => this.getTradingSuggestions());
    }

    // Risk assessment button
    const riskAssessmentBtn = document.getElementById('riskAssessmentBtn');
    if (riskAssessmentBtn) {
      riskAssessmentBtn.addEventListener('click', () => this.getRiskAssessment());
    }

    // Clear history button
    const clearHistoryBtn = document.getElementById('clearHistoryBtn');
    if (clearHistoryBtn) {
      clearHistoryBtn.addEventListener('click', () => this.clearHistory());
    }

    // Stream analysis button
    const streamAnalysisBtn = document.getElementById('streamAnalysisBtn');
    if (streamAnalysisBtn) {
      streamAnalysisBtn.addEventListener('click', () => this.streamMarketAnalysis());
    }
  }

  async loadInitialData() {
    try {
      await this.loadAIHistory();
      await this.loadCurrentSuggestions();
    } catch (error) {
      console.error('Error loading AI initial data:', error);
    }
  }

  async analyzeMarket() {
    if (this.isLoading) return;

    this.isLoading = true;
    const btn = document.getElementById('analyzeMarketBtn');
    if (btn) btn.classList.add('loading');

    try {
      // Get current market data (you would replace with real data)
      const marketData = {
        btcPrice: 42500,
        ethPrice: 2250,
        solPrice: 150,
        sentiment: 'bullish',
        volatility: 'high',
        fearGreedIndex: 65,
        volume24h: 1000000,
        activePositions: this.getActivePositions(),
      };

      const response = await fetch('/api/ai/analyze-market', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ marketData }),
      });

      const data = await response.json();

      if (data.success) {
        this.analysis = data.analysis;
        this.displayMarketAnalysis(data.analysis);
        this.showNotification('Market analysis completed', 'success');
      } else {
        this.showNotification('Failed to analyze market', 'error');
      }
    } catch (error) {
      console.error('Error analyzing market:', error);
      this.showNotification('Error analyzing market: ' + error.message, 'error');
    } finally {
      this.isLoading = false;
      if (btn) btn.classList.remove('loading');
    }
  }

  async getTradingSuggestions() {
    if (this.isLoading) return;

    this.isLoading = true;
    const btn = document.getElementById('getSuggestionsBtn');
    if (btn) btn.classList.add('loading');

    try {
      const marketData = {
        btcPrice: 42500,
        ethPrice: 2250,
        solPrice: 150,
        sentiment: 'bullish',
        volatility: 'high',
        fearGreedIndex: 65,
        volume24h: 1000000,
      };

      const response = await fetch('/api/ai/suggestions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ marketData }),
      });

      const data = await response.json();

      if (data.success) {
        this.suggestions = data.suggestions;
        this.displayTradingSuggestions(data.suggestions);
        this.showNotification(`Generated ${data.count} trading suggestions`, 'success');
      } else {
        this.showNotification('Failed to generate suggestions', 'error');
      }
    } catch (error) {
      console.error('Error getting trading suggestions:', error);
      this.showNotification('Error getting suggestions: ' + error.message, 'error');
    } finally {
      this.isLoading = false;
      if (btn) btn.classList.remove('loading');
    }
  }

  async getRiskAssessment() {
    if (this.isLoading) return;

    this.isLoading = true;
    const btn = document.getElementById('riskAssessmentBtn');
    if (btn) btn.classList.add('loading');

    try {
      const response = await fetch('/api/ai/risk-assessment', {
        method: 'GET',
        headers: { 'Content-Type': 'application/json' },
      });

      const data = await response.json();

      if (data.success) {
        this.riskAssessment = data.assessment;
        this.displayRiskAssessment(data.assessment);
        this.showNotification('Risk assessment completed', 'success');
      } else {
        this.showNotification('Failed to assess risk', 'error');
      }
    } catch (error) {
      console.error('Error getting risk assessment:', error);
      this.showNotification('Error assessing risk: ' + error.message, 'error');
    } finally {
      this.isLoading = false;
      if (btn) btn.classList.remove('loading');
    }
  }

  async streamMarketAnalysis() {
    if (this.streamingActive) {
      this.streamingActive = false;
      return;
    }

    this.streamingActive = true;
    const btn = document.getElementById('streamAnalysisBtn');
    if (btn) {
      btn.classList.add('loading');
      btn.textContent = 'Stop Analysis';
    }

    try {
      const marketData = {
        btcPrice: 42500,
        ethPrice: 2250,
        solPrice: 150,
        sentiment: 'bullish',
        volatility: 'high',
        fearGreedIndex: 65,
      };

      const response = await fetch('/api/ai/analyze-market-stream', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ marketData }),
      });

      const analysisDiv = document.getElementById('streamingAnalysis');
      if (analysisDiv) {
        analysisDiv.innerHTML = '<div class="text-gray-400">Streaming analysis...</div>';
      }

      const reader = response.body.getReader();
      const decoder = new TextDecoder();

      while (this.streamingActive) {
        const { done, value } = await reader.read();
        if (done) break;

        const chunk = decoder.decode(value);
        const lines = chunk.split('\n');

        for (const line of lines) {
          if (line.startsWith('data:')) {
            const data = line.slice(5).trim();
            if (data === '[DONE]') {
              this.streamingActive = false;
              break;
            }

            try {
              const parsed = JSON.parse(data);
              if (parsed.chunk) {
                this.appendStreamingContent(parsed.chunk);
              }
            } catch (e) {
              // Skip parsing errors
            }
          }
        }
      }
    } catch (error) {
      console.error('Error streaming analysis:', error);
      this.showNotification('Error streaming analysis: ' + error.message, 'error');
    } finally {
      this.streamingActive = false;
      if (btn) {
        btn.classList.remove('loading');
        btn.textContent = 'Stream Analysis';
      }
    }
  }

  appendStreamingContent(content) {
    const analysisDiv = document.getElementById('streamingAnalysis');
    if (analysisDiv) {
      const currentContent = analysisDiv.innerHTML || '';
      analysisDiv.innerHTML = currentContent + content;
      // Auto-scroll to bottom
      analysisDiv.scrollTop = analysisDiv.scrollHeight;
    }
  }

  displayMarketAnalysis(analysis) {
    const container = document.getElementById('analysisResults');
    if (!container) return;

    const html = `
      <div class="bg-gray-800 p-6 rounded-lg space-y-4">
        <h3 class="text-xl font-bold">Market Analysis</h3>
        
        <div class="grid grid-cols-2 gap-4">
          <div class="bg-gray-700 p-4 rounded">
            <div class="text-sm text-gray-400">Market Sentiment</div>
            <div class="text-lg font-semibold">${analysis.marketSentiment || 'N/A'}</div>
          </div>
          <div class="bg-gray-700 p-4 rounded">
            <div class="text-sm text-gray-400">Risk Level</div>
            <div class="text-lg font-semibold">${analysis.riskLevel || 'N/A'}</div>
          </div>
        </div>
        
        <div class="bg-gray-700 p-4 rounded">
          <div class="text-sm text-gray-400 mb-2">Price Analysis</div>
          <div class="text-sm whitespace-pre-wrap">${analysis.priceAnalysis || 'N/A'}</div>
        </div>
        
        <div class="bg-gray-700 p-4 rounded">
          <div class="text-sm text-gray-400 mb-2">Recommendations</div>
          <ul class="text-sm space-y-1">
            ${(analysis.recommendations || []).map((rec) => `<li>• ${rec}</li>`).join('')}
          </ul>
        </div>

        <div class="text-xs text-gray-500">
          Generated: ${new Date().toLocaleString()}
        </div>
      </div>
    `;

    container.innerHTML = html;
  }

  displayTradingSuggestions(suggestions) {
    const container = document.getElementById('suggestionsResults');
    if (!container) return;

    if (suggestions.length === 0) {
      container.innerHTML = '<div class="text-gray-400">No suggestions available</div>';
      return;
    }

    const html = `
      <div class="space-y-4">
        ${suggestions.map((suggestion, idx) => `
          <div class="bg-gray-800 p-4 rounded-lg border-l-4 border-blue-500">
            <div class="flex justify-between items-start mb-2">
              <h4 class="font-bold">Suggestion ${idx + 1}</h4>
              <span class="text-sm px-2 py-1 rounded ${this.getConfidenceColor(suggestion.confidence)}">
                ${suggestion.confidence || 'N/A'}
              </span>
            </div>
            
            <div class="grid grid-cols-2 gap-2 text-sm mb-3">
              <div>
                <span class="text-gray-400">Action:</span>
                <div class="font-semibold">${suggestion.action || 'N/A'}</div>
              </div>
              <div>
                <span class="text-gray-400">Symbol:</span>
                <div class="font-semibold">${suggestion.symbol || 'N/A'}</div>
              </div>
              <div>
                <span class="text-gray-400">Entry:</span>
                <div class="font-semibold">$${suggestion.entryPrice || 'N/A'}</div>
              </div>
              <div>
                <span class="text-gray-400">Target:</span>
                <div class="font-semibold">$${suggestion.targetPrice || 'N/A'}</div>
              </div>
              <div>
                <span class="text-gray-400">Stop Loss:</span>
                <div class="font-semibold">$${suggestion.stopLoss || 'N/A'}</div>
              </div>
              <div>
                <span class="text-gray-400">Risk/Reward:</span>
                <div class="font-semibold">${suggestion.riskReward || 'N/A'}</div>
              </div>
            </div>
            
            <div class="text-xs text-gray-400">
              ${suggestion.reasoning || ''}
            </div>
          </div>
        `).join('')}
      </div>
    `;

    container.innerHTML = html;
  }

  displayRiskAssessment(assessment) {
    const container = document.getElementById('riskResults');
    if (!container) return;

    const html = `
      <div class="bg-gray-800 p-6 rounded-lg space-y-4">
        <h3 class="text-xl font-bold">Risk Assessment</h3>
        
        <div class="bg-gray-700 p-4 rounded">
          <div class="flex items-center justify-between mb-2">
            <span class="text-gray-400">Risk Score</span>
            <span class="text-2xl font-bold">${assessment.riskScore || 'N/A'}/10</span>
          </div>
          <div class="w-full bg-gray-600 rounded-full h-2">
            <div class="bg-red-500 h-2 rounded-full" style="width: ${(assessment.riskScore || 0) * 10}%"></div>
          </div>
        </div>
        
        <div class="bg-gray-700 p-4 rounded">
          <div class="text-sm text-gray-400 mb-2">Primary Risk Factors</div>
          <ul class="text-sm space-y-1">
            ${(assessment.factors || []).map((factor) => `<li class="text-yellow-400">• ${factor}</li>`).join('')}
          </ul>
        </div>
        
        <div class="bg-gray-700 p-4 rounded">
          <div class="text-sm text-gray-400 mb-2">Mitigation Strategies</div>
          <ul class="text-sm space-y-1">
            ${(assessment.mitigation || []).map((strategy) => `<li class="text-green-400">• ${strategy}</li>`).join('')}
          </ul>
        </div>
        
        <div class="bg-gray-700 p-4 rounded">
          <div class="text-sm text-gray-400 mb-2">Recommended Actions</div>
          <ul class="text-sm space-y-1">
            ${(assessment.actions || []).map((action) => `<li class="text-blue-400">• ${action}</li>`).join('')}
          </ul>
        </div>

        <div class="text-xs text-gray-500">
          Generated: ${new Date().toLocaleString()}
        </div>
      </div>
    `;

    container.innerHTML = html;
  }

  async loadAIHistory() {
    try {
      const response = await fetch('/api/ai/history');
      const data = await response.json();

      const historyDiv = document.getElementById('aiHistory');
      if (historyDiv && data.history && data.history.length > 0) {
        historyDiv.innerHTML = `
          <div class="bg-gray-800 p-4 rounded text-sm">
            <div class="font-semibold mb-2">Latest Analysis (${data.total} total)</div>
            ${data.history.map((item) => `
              <div class="text-xs text-gray-400 mb-1">
                ${item.type}: ${new Date(item.timestamp).toLocaleString()}
              </div>
            `).join('')}
          </div>
        `;
      }
    } catch (error) {
      console.error('Error loading AI history:', error);
    }
  }

  async loadCurrentSuggestions() {
    try {
      const response = await fetch('/api/ai/current-suggestions');
      const data = await response.json();

      if (data.suggestions && data.suggestions.length > 0) {
        this.suggestions = data.suggestions;
        const suggestionsDiv = document.getElementById('currentSuggestions');
        if (suggestionsDiv) {
          suggestionsDiv.innerHTML = `
            <div class="text-sm text-gray-400">
              ${data.count} suggestions loaded
            </div>
          `;
        }
      }
    } catch (error) {
      console.error('Error loading current suggestions:', error);
    }
  }

  async clearHistory() {
    if (!confirm('Are you sure you want to clear all AI analysis history?')) {
      return;
    }

    try {
      const response = await fetch('/api/ai/clear-history', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
      });

      const data = await response.json();

      if (data.success) {
        this.showNotification('History cleared', 'success');
        this.loadAIHistory();
      }
    } catch (error) {
      console.error('Error clearing history:', error);
      this.showNotification('Error clearing history', 'error');
    }
  }

  getActivePositions() {
    // Get active positions from the main dashboard if available
    if (window.dashboard) {
      return window.dashboard.getActivePositions ? window.dashboard.getActivePositions() : [];
    }
    return [];
  }

  getConfidenceColor(confidence) {
    if (!confidence) return 'bg-gray-600';
    const conf = parseFloat(confidence);
    if (conf >= 0.8) return 'bg-green-600';
    if (conf >= 0.6) return 'bg-yellow-600';
    return 'bg-red-600';
  }

  showNotification(message, type) {
    const notification = document.createElement('div');
    notification.className = `fixed bottom-4 right-4 p-4 rounded-lg shadow-lg z-50 ${
      type === 'success' ? 'bg-green-600' : 'bg-red-600'
    }`;
    notification.textContent = message;

    document.body.appendChild(notification);

    setTimeout(() => {
      notification.remove();
    }, 3000);
  }
}

// Initialize AI bot when page loads
document.addEventListener('DOMContentLoaded', () => {
  window.aiBot = new AITradingBot();
});
