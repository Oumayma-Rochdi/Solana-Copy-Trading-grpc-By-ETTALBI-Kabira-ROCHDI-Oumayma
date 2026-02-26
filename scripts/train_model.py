import os
import pandas as pd
from sklearn.model_selection import train_test_split
from sklearn.ensemble import RandomForestClassifier
from sklearn.metrics import classification_report, accuracy_score
import joblib

BASE = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
DATA = os.path.join(BASE, "data", "market_dataset.csv")
MODEL_DIR = os.path.join(BASE, "models")
REPORT_PATH = os.path.join(MODEL_DIR, "training_report.txt")
MODEL_PATH = os.path.join(MODEL_DIR, "decision_model.pkl")

_df = pd.read_csv(DATA)

X = _df.drop(columns=["label", "timestamp"])
y = _df["label"]

X_train, X_test, y_train, y_test = train_test_split(
    X, y, test_size=0.2, random_state=42, stratify=y
)

model = RandomForestClassifier(
    n_estimators=200,
    max_depth=12,
    random_state=42,
    class_weight="balanced"
)

model.fit(X_train, y_train)

pred = model.predict(X_test)
acc = accuracy_score(y_test, pred)
report = classification_report(y_test, pred)

os.makedirs(MODEL_DIR, exist_ok=True)
joblib.dump(model, MODEL_PATH)

with open(REPORT_PATH, "w", encoding="utf-8") as f:
    f.write(f"Accuracy: {acc:.4f}\n\n")
    f.write(report)

print(f"Model saved to: {MODEL_PATH}")
print(f"Report saved to: {REPORT_PATH}")
