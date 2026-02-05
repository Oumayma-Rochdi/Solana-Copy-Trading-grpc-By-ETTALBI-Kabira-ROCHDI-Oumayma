# AI Trading Bot Integration Setup Guide

## Overview

This guide walks you through integrating the intelligent AI trading bot with your Solana Copy Trading gRPC bot. The AI bot provides market analysis, trading suggestions, token analysis, and risk assessment powered by Claude AI via Vercel AI Gateway.

## Features

- **Market Analysis**: Analyze current market conditions and sentiment
- **Trading Suggestions**: Get AI-powered trading recommendations with entry/exit points
- **Token Analysis**: Deep dive analysis of specific tokens with scoring and recommendations
- **Risk Assessment**: Portfolio risk evaluation with mitigation strategies
- **Stream Analysis**: Real-time streaming analysis updates
- **Database Persistence**: All analyses saved to Neon PostgreSQL for history and performance tracking

## Prerequisites

- Node.js 16+ installed
- Neon PostgreSQL database configured (via environment variables)
- Vercel AI Gateway access (automatic with Vercel deployment)
- Claude API access (via Vercel AI Gateway)

## Installation Steps

### 1. Create Database Tables

Run the migration script to create the required database tables:

```bash
psql -d your_database_url -f scripts/create-ai-analysis-tables.sql
```

Or if using Neon directly:

```bash
# Connect to your Neon database and run the SQL from scripts/create-ai-analysis-tables.sql
```

### 2. Environment Variables

Ensure the following environment variables are set:

```bash
# Database Configuration (Neon)
DATABASE_URL=postgresql://[user]:[password]@[host]/[database]

# Vercel AI Gateway (automatically available on Vercel)
# No additional setup needed - the AI SDK uses the gateway by default

# Dashboard Configuration
ENABLE_DASHBOARD=true
DASHBOARD_PORT=3000
```

### 3. Install Dependencies

```bash
npm install ai @ai-sdk/react
```

These packages are already in your project, but ensure they're installed.

### 4. Start the Dashboard

```bash
npm start
```

The dashboard will be available at `http://localhost:3000`

## Usage

### Via Dashboard Web Interface

1. **Access the Dashboard**: Open `http://localhost:3000` in your browser
2. **Navigate to AI Analysis Tab**: Click on the dashboard interface
3. **Use AI Controls**:
   - **Analyze Market**: Get current market analysis
   - **Get Suggestions**: Generate trading recommendations
   - **Risk Assessment**: Evaluate portfolio risk
   - **Stream Analysis**: Get real-time streaming insights
   - **Clear History**: Remove analysis history

### Via API Endpoints

#### Market Analysis

```bash
curl -X POST http://localhost:3000/api/ai/analyze-market \
  -H "Content-Type: application/json" \
  -d '{
    "marketData": {
      "btcPrice": 42000,
      "ethPrice": 2200,
      "solPrice": 150,
      "sentiment": "bullish",
      "volatility": "high",
      "fearGreedIndex": 65
    }
  }'
```

#### Trading Suggestions

```bash
curl -X POST http://localhost:3000/api/ai/suggestions \
  -H "Content-Type: application/json" \
  -d '{
    "marketData": {
      "btcPrice": 42000,
      "ethPrice": 2200,
      "solPrice": 150,
      "sentiment": "bullish"
    }
  }'
```

#### Token Analysis

```bash
curl -X POST http://localhost:3000/api/ai/analyze-token \
  -H "Content-Type: application/json" \
  -d '{
    "tokenMint": "EPjFWaLb3cwQB6L2AgJCm53wrguZoJRUeKT7WD4kqmQ",
    "tokenData": {
      "name": "USDC",
      "symbol": "USDC",
      "price": 1.0,
      "marketCap": 25000000000,
      "holders": 1000000
    }
  }'
```

#### Risk Assessment

```bash
curl -X GET http://localhost:3000/api/ai/risk-assessment \
  -H "Content-Type: application/json"
```

#### Get AI History

```bash
curl -X GET http://localhost:3000/api/ai/history
```

#### Get Statistics

```bash
curl -X GET http://localhost:3000/api/ai/statistics
```

## Database Queries

### View Analysis History

```sql
SELECT * FROM ai_analyses ORDER BY created_at DESC LIMIT 10;
```

### View Trading Suggestions

```sql
SELECT * FROM ai_trading_suggestions ORDER BY created_at DESC LIMIT 10;
```

### View Token Analyses

```sql
SELECT * FROM ai_token_analyses ORDER BY updated_at DESC;
```

### View Risk Assessments

```sql
SELECT * FROM ai_risk_assessments ORDER BY created_at DESC LIMIT 10;
```

### Get AI Performance Metrics

```sql
SELECT 
  analysis_type,
  COUNT(*) as total,
  AVG(confidence) as avg_confidence
FROM ai_analyses
GROUP BY analysis_type
ORDER BY total DESC;
```

## Architecture

### Service Structure

```
services/
├── aiAnalysis.js           # Main AI analysis service
├── aiPersistence.js        # Database persistence layer
├── copyTrading.js          # Copy trading service
├── riskManager.js          # Risk management
└── notifications.js        # Notifications
```

### API Routes

```
/api/ai/analyze-market       POST    - Market analysis
/api/ai/analyze-market-stream POST   - Streaming market analysis
/api/ai/suggestions          POST    - Trading suggestions
/api/ai/analyze-token        POST    - Token analysis
/api/ai/risk-assessment      GET     - Risk assessment
/api/ai/history              GET     - Analysis history
/api/ai/current-suggestions  GET     - Current trading suggestions
/api/ai/clear-history        POST    - Clear analysis history
/api/ai/statistics           GET     - Database statistics
/api/ai/db-history          GET     - Database analysis history
/api/ai/db-suggestions      GET     - Database trading suggestions
/api/ai/token/:tokenMint    GET     - Token analysis from database
```

## AI Model Configuration

The system uses **Claude Opus 4.5** via Vercel AI Gateway for analysis:

- **Model**: `anthropic/claude-opus-4.5`
- **Temperature**: 0.2-0.4 (low for consistency)
- **Max Tokens**: 1000-2000 per request
- **Provider**: Vercel AI Gateway (zero-config)

## Performance Considerations

1. **Rate Limiting**: Dashboard has built-in rate limiting (100 requests/minute by default)
2. **Database Cleanup**: Automatic cleanup keeps only last 1000 records
3. **Caching**: Analysis results cached in memory for 5 minutes
4. **Streaming**: Use streaming endpoints for long analyses to avoid timeouts

## Troubleshooting

### Database Connection Issues

```javascript
// Check database connection in logs
logger.info('[AI-Persistence] Database connection initialized')

// If connection fails, verify:
// 1. DATABASE_URL is set correctly
// 2. Network can reach Neon database
// 3. Database credentials are valid
```

### AI Gateway Issues

- Ensure you're deploying on Vercel for automatic API key management
- Check Vercel project settings for integration status
- The AI SDK will use the gateway automatically without additional config

### Dashboard Not Loading

1. Ensure `ENABLE_DASHBOARD=true` in environment
2. Check that dashboard server is running on configured port
3. Verify no firewall blocks the dashboard port

## Deployment

### Deploy to Vercel

1. Connect your GitHub repository to Vercel
2. Set environment variables in Vercel project settings:
   - `DATABASE_URL`
   - `ENABLE_DASHBOARD=true`
3. Deploy:

```bash
vercel deploy
```

### Docker Deployment

Create a `Dockerfile`:

```dockerfile
FROM node:18-alpine
WORKDIR /app
COPY package*.json ./
RUN npm install
COPY . .
ENV ENABLE_DASHBOARD=true
EXPOSE 3000
CMD ["npm", "start"]
```

Build and run:

```bash
docker build -t solana-trading-bot .
docker run -p 3000:3000 \
  -e DATABASE_URL=$DATABASE_URL \
  solana-trading-bot
```

## Monitoring

### Log Important Metrics

The AI bot logs the following:

- Analysis completion status
- Database save operations
- API error responses
- Performance metrics
- Model usage

Monitor logs for:

```
[AI-Analysis] Market analysis completed
[AI-Persistence] Database connection initialized
[AI-Analysis] Generated X trading suggestions
[AI-Persistence] Failed to save to database
```

## Best Practices

1. **Regular Analysis**: Run market analysis every 5-10 minutes
2. **Risk Management**: Always run risk assessment before trading
3. **Token Due Diligence**: Analyze tokens before trading
4. **Performance Tracking**: Review statistics regularly
5. **Database Maintenance**: Monitor database size and cleanup old data
6. **Error Handling**: Always catch and log API errors

## Future Enhancements

- WebSocket support for real-time updates
- ML model training on historical data
- Advanced technical indicator analysis
- Multi-model support (Grok, DeepInfra)
- Sentiment analysis from social media
- On-chain data integration

## Support

For issues or questions:

1. Check application logs
2. Review database connection settings
3. Verify environment variables are set
4. Check Vercel deployment logs
5. Review API response errors

## License

Same as parent project (Solana Copy Trading gRPC)
