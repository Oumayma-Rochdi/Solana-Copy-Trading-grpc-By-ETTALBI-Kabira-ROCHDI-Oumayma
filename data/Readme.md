# 🧠 NeuralTrade: AI Trading Intelligence Engine

A cutting-edge Machine Learning and Deep Learning-powered trading intelligence platform. NeuralTrade analyzes live market conditions and delivers high-confidence trading suggestions via a spectacular "Human-in-the-loop" dashboard.

> **Note:** This project has evolved from an automated copy-trading bot (v1) into a sophisticated AI-assisted decision engine (v2). It prioritizes intelligent market analysis over blind automated execution.

## ✨ Key Features

- **🤖 Ensemble ML Architecture**: Combines **Random Forest** (for robust feature analysis & explanations) and a **Deep Learning Neural Network** (MLP for pattern recognition) to generate highly accurate trading signals.
- **⚡ Real-Time Streaming**: Server-Sent Events (SSE) feed continuous market telemetry and AI inference data straight to the UI.
- **🛡️ Human-in-the-Loop Concept**: The AI never trades without your consent. It presents `BUY`, `SELL`, or `HOLD` suggestions with confidence scores and reasoning, leaving you to click **EXECUTE** or **SKIP**.
- **🌌 Breathtaking Dashboard**: A fully responsive, glassmorphism-styled UI with neon accents, dynamic animations, and live data feeds.
- **📊 Feature Extraction & Explainability**: See exactly *why* the AI made a decision with live display of Neural Pathway Weights (feature importances).

## 🏗️ Architecture

```
┌─────────────────┐       ┌──────────────────┐
│  Market Data    │       │ Python ML Engine │
│  Aggregator     │       │ (Scikit-Learn)   │
└─────────────────┘       └──────────────────┘
         │                          │
        (1)                        (2)
         ▼                          ▼
┌────────────────────────────────────────────┐
│              Node.js Server                │
│       (Predictive API & SSE Stream)        │
└────────────────────────────────────────────┘
         │
        (3)
         ▼
┌────────────────────────────────────────────┐
│            Spectacular Web UI              │
│       (Glassmorphism Dashboard)            │
└────────────────────────────────────────────┘
```

1. The Node.js server aggregates/simulates market data (Price, Volume, RSI, MACD, etc.).
2. It pushes features to the Python backend (`predict.py`), which loads the trained Random Forest and Deep Learning ensemble models.
3. The server streams the prediction (Decision, Confidence, Reasons) via Server-Sent Events to the sleek frontend.

## 🚀 Quick Start

### 1. Prerequisites

- **Python 3.8+** (with `pip`)
- **Node.js 18+** (with `npm`)

### 2. Installation Setup

First, clone the repository.

**Install Node Dependencies:**
```bash
npm install
# or if you experience powershell script execution errors on Windows:
cmd.exe /c "npm install"
```

**Install Python Dependencies:**
```bash
pip install pandas numpy scikit-learn joblib
```

### 3. Train the AI Models

Before starting the server, you need to train the Machine Learning models on the dataset (`data/market_dataset.csv`).

```bash
python scripts/train_model_advanced.py
```
*This will generate `random_forest.pkl`, `neural_network.pkl`, `scaler.pkl`, and `ensemble_meta.json` inside the `models/` directory.*

### 4. Start the Application

Start the Express backend and ML inference server:

```bash
node dashboard/server.js
```

Then, open your browser and navigate to:
**http://localhost:3000**

## 🖥️ Live Dashboard Overview

The NeuralTrade Dashboard offers:

- **Ensemble AI Decision Banner:** Flashes `BUY` (Neon Green), `SELL` (Neon Red), or `HOLD` (Amber) alongside a real-time confidence percentage.
- **Raw Feature Matrix:** A live terminal showing the JSON data passed to the Python predictor.
- **Neural Pathway Weights:** Explains which indicators (e.g., RSI, Volatility, Momentum) influenced the AI's decision the most.
- **Action Buttons:** `EXECUTE` the trade to route it to execution logic, or `SKIP` to pass on the opportunity.

## 🛠️ Modifying the Data Model

If you wish to add new technical indicators or alternative data sources to the AI:
1. Update `data/market_dataset.csv` with your new columns.
2. Edit `scripts/train_model_advanced.py` to include your new features in the `FEATURE_COLS` list.
3. Edit the `generateMarketData()` logic inside `dashboard/server.js` to feed those new data points.
4. Retrain the model.

## 🤝 Contributing & Customization

- To alter the visual aesthetics, simply modify the CSS variables and Tailwind classes in `dashboard/public/index.html`.
- To attach authentic on-chain execution logic, connect your Solana Trading logic directly to the "EXECUTE" button handler inside the dashboard's javascript.

## 📄 License

This project is licensed under the MIT License.
