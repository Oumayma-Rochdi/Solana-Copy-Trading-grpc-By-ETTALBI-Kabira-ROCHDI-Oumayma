import os
import json
import sys
import argparse
import joblib
import numpy as np

BASE = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
MODEL_DIR = os.path.join(BASE, "models")

RF_PATH = os.path.join(MODEL_DIR, "random_forest.pkl")
DL_PATH = os.path.join(MODEL_DIR, "neural_network.pkl")
SCALER_PATH = os.path.join(MODEL_DIR, "scaler.pkl")
ENS_PATH = os.path.join(MODEL_DIR, "ensemble_meta.json")
LEGACY_MODEL_PATH = os.path.join(MODEL_DIR, "decision_model.pkl")

class EnsemblePredictor:
    def __init__(self):
        self.rf = None
        self.mlp = None
        self.scaler = None
        self.meta = None
        self.load_models()

    def load_models(self):
        # Fallback to single legacy model if new ensemble isn't trained yet
        if not os.path.exists(ENS_PATH):
            if os.path.exists(LEGACY_MODEL_PATH):
                self.rf = joblib.load(LEGACY_MODEL_PATH)
                self.meta = {
                    "rf_weight": 1.0, "mlp_weight": 0.0, "dl_available": False,
                    "classes": ["BUY", "HOLD", "SELL"],
                    "features": ["price", "volume", "volatility", "liquidity", "rsi", "momentum", "macd", "trend", "sentiment", "holders", "market_cap"]
                }
                return
            raise FileNotFoundError("No trained models found. Please run training script first.")

        with open(ENS_PATH, "r") as f:
            self.meta = json.load(f)

        self.rf = joblib.load(RF_PATH)
        if self.meta["dl_available"]:
            try:
                self.mlp = joblib.load(DL_PATH)
                self.scaler = joblib.load(SCALER_PATH)
            except Exception as e:
                # If DL model missing, fallback to 100% RF
                self.meta["dl_available"] = False
                self.meta["rf_weight"] = 1.0

    def predict(self, features_dict):
        # Build vector
        cols = self.meta["features"]
        x_raw = np.array([[features_dict[c] for c in cols]], dtype=float)

        rf_prob = self.rf.predict_proba(x_raw)[0]
        
        if self.meta["dl_available"]:
            x_scaled = self.scaler.transform(x_raw)
            mlp_prob = self.mlp.predict_proba(x_scaled)[0]
            # Average based on weights
            rf_w = self.meta["rf_weight"]
            mlp_w = self.meta["mlp_weight"]
            combined = (rf_w * rf_prob) + (mlp_w * mlp_prob)
        else:
            combined = rf_prob

        # Find best class
        idx = int(np.argmax(combined))
        decision = self.meta["classes"][idx]
        confidence = float(combined[idx]) * 100.0

        # Optional: features reasons from RF
        reasons = []
        if hasattr(self.rf, "feature_importances_"):
            importances = self.rf.feature_importances_
            ranked = sorted(zip(cols, importances), key=lambda x: x[1], reverse=True)
            reasons = [f"{name} influence: {weight:.3f}" for name, weight in ranked[:3]]

        # Extra indicator for dashboard to show which models were used
        models_used = "RF + Deep Learning (Ensemble)" if self.meta["dl_available"] else "Random Forest"

        return {
            "decision": decision,
            "score": round(confidence, 2),
            "confidence": round(confidence, 2),
            "reasons": reasons,
            "model_type": models_used
        }

def parse_args():
    parser = argparse.ArgumentParser(description="Predict BUY/HOLD/SELL decision using Ensemble ML")
    parser.add_argument("--input", help="Path to JSON file with features", default=None)
    parser.add_argument("--stdin", action="store_true", help="Read JSON features from stdin")
    return parser.parse_args()

def read_features(args):
    if args.input:
        with open(args.input, "r", encoding="utf-8") as f:
            return json.load(f)
    if args.stdin:
        data = sys.stdin.read().strip()
        if not data:
            raise ValueError("No JSON data provided via stdin")
        return json.loads(data)

    # Demo
    return {
        "price": 120.5, "volume": 25000000, "volatility": 3.2,
        "liquidity": 5000000, "rsi": 62.0, "momentum": 1.5,
        "macd": 0.3, "trend": 0.4, "sentiment": 0.2,
        "holders": 25000, "market_cap": 800000000,
    }

if __name__ == "__main__":
    args = parse_args()
    features = read_features(args)
    predictor = EnsemblePredictor()
    
    # Missing checking handled roughly by dictionary lookup
    result = predictor.predict(features)
    print(json.dumps(result, indent=2))
