"""
Advanced ML Training Script
Trains two models on market_dataset.csv:
  1. Random Forest Classifier (robust baseline)
  2. Deep Learning Neural Network (MLP via TensorFlow/Keras)
Saves an ensemble model that averages probabilities from both.
"""

import os
import json
import warnings
warnings.filterwarnings("ignore")

import numpy as np
import pandas as pd
from sklearn.model_selection import train_test_split, StratifiedKFold
from sklearn.ensemble import RandomForestClassifier, GradientBoostingClassifier
from sklearn.preprocessing import LabelEncoder, StandardScaler
from sklearn.metrics import classification_report, accuracy_score, confusion_matrix
from sklearn.pipeline import Pipeline
import joblib

# ───────────────────────────── paths ─────────────────────────────
BASE       = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
DATA_PATH  = os.path.join(BASE, "data", "market_dataset.csv")
MODEL_DIR  = os.path.join(BASE, "models")
os.makedirs(MODEL_DIR, exist_ok=True)

RF_PATH    = os.path.join(MODEL_DIR, "random_forest.pkl")
DL_PATH    = os.path.join(MODEL_DIR, "neural_network.pkl")    # scikit-learn MLP
ENS_PATH   = os.path.join(MODEL_DIR, "ensemble_meta.json")
SCALER_PATH = os.path.join(MODEL_DIR, "scaler.pkl")
REPORT_PATH = os.path.join(MODEL_DIR, "training_report.txt")
LEGACY_PATH = os.path.join(MODEL_DIR, "decision_model.pkl")   # keep backward compat

FEATURE_COLS = [
    "price", "volume", "volatility", "liquidity",
    "rsi", "momentum", "macd", "trend", "sentiment",
    "holders", "market_cap"
]

# ────────────────────────── load data ────────────────────────────
print("Loading dataset...")
df = pd.read_csv(DATA_PATH)
print(f"   Rows: {len(df):,}  |  Columns: {list(df.columns)}")

X = df[FEATURE_COLS].astype(float)
y = df["label"].astype(str)

le = LabelEncoder()
y_enc = le.fit_transform(y)          # BUY→0  HOLD→1  SELL→2
classes = list(le.classes_)
print(f"   Classes: {classes}")
print(f"   Label distribution:\n{y.value_counts()}\n")

X_train, X_test, y_train, y_test = train_test_split(
    X, y_enc, test_size=0.2, random_state=42, stratify=y_enc
)

# scale for the neural network
scaler = StandardScaler()
X_train_s = scaler.fit_transform(X_train)
X_test_s  = scaler.transform(X_test)
joblib.dump(scaler, SCALER_PATH)
print(f"Scaler saved -> {SCALER_PATH}")

# ──────────────────── 1. Random Forest ───────────────────────────
print("Training Random Forest...")
rf = RandomForestClassifier(
    n_estimators=300,
    max_depth=12,
    min_samples_leaf=2,
    class_weight="balanced",
    random_state=42,
    n_jobs=-1,
)
rf.fit(X_train, y_train)
rf_preds = rf.predict(X_test)
rf_acc = accuracy_score(y_test, rf_preds)
print(f"   Accuracy: {rf_acc:.4f}")
print(classification_report(y_test, rf_preds, target_names=classes))
joblib.dump(rf, RF_PATH)
print(f"Random Forest saved -> {RF_PATH}")

# ──────────────────── 2. Neural Network (MLP) ────────────────────
print("Training Neural Network (MLP)...")
try:
    from sklearn.neural_network import MLPClassifier

    mlp = MLPClassifier(
        hidden_layer_sizes=(256, 128, 64, 32),
        activation="relu",
        solver="adam",
        learning_rate_init=0.001,
        max_iter=500,
        early_stopping=True,
        validation_fraction=0.1,
        n_iter_no_change=20,
        random_state=42,
        batch_size=64,
        alpha=0.0001,          # L2 regularisation
        tol=1e-4,
    )
    mlp.fit(X_train_s, y_train)
    mlp_preds = mlp.predict(X_test_s)
    mlp_acc = accuracy_score(y_test, mlp_preds)
    print(f"   Accuracy: {mlp_acc:.4f}")
    print(classification_report(y_test, mlp_preds, target_names=classes))
    joblib.dump(mlp, DL_PATH)
    print(f"Neural Network saved -> {DL_PATH}")
    dl_available = True
except Exception as e:
    print(f"⚠️  Neural Network training failed: {e}")
    mlp = None
    mlp_acc = 0.0
    dl_available = False

# ──────────────────── 3. Ensemble ────────────────────────────────
print("Building ensemble...")

def ensemble_predict_proba(rf_model, mlp_model, X_raw, X_scaled, rf_weight=0.55, mlp_weight=0.45):
    """Weighted average of probabilities from both models."""
    rf_proba = rf_model.predict_proba(X_raw)
    if mlp_model is not None:
        mlp_proba = mlp_model.predict_proba(X_scaled)
        combined  = rf_weight * rf_proba + mlp_weight * mlp_proba
    else:
        combined  = rf_proba
    return combined

ens_proba  = ensemble_predict_proba(rf, mlp, X_test, X_test_s)
ens_preds = np.argmax(ens_proba, axis=1)
ens_acc = accuracy_score(y_test, ens_preds)

print(f"\n   Ensemble (RF 55% + MLP 45%) Accuracy: {ens_acc:.4f}")
print(classification_report(y_test, ens_preds, target_names=classes))

# ──────────────────── 4. Save & Report ───────────────────────────
ens_meta = {
    "rf_weight": 0.55,
    "mlp_weight": 0.45,
    "dl_available": dl_available,
    "classes": classes,
    "features": FEATURE_COLS
}

with open(ENS_PATH, "w") as f:
    json.dump(ens_meta, f, indent=4)

# Keep a symlink or copy to the legacy name if needed by other parts of the code
# But since they're different formats now, we'll save the ensemble predict wrapper in predicting script later.

try:
    with open(REPORT_PATH, "w", encoding="utf-8") as f:
        f.write(f"RF Accuracy: {rf_acc:.4f}\n")
        f.write(f"MLP Accuracy: {mlp_acc:.4f}\n")
        f.write(f"Ensemble Accuracy: {ens_acc:.4f}\n\n")
        f.write("=== Ensemble Classification Report ===\n")
        f.write(classification_report(y_test, ens_preds, target_names=classes))
    print(f"Report saved -> {REPORT_PATH}")
except Exception as e:
    print(f"Failed to write report: {e}")

print("Training complete. Next -> Update prediction script to use this ensemble.")
