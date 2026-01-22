import pandas as pd
import numpy as np
import joblib
import warnings
import matplotlib.pyplot as plt
import seaborn as sns
from itertools import cycle 
warnings.filterwarnings("ignore")

from sklearn.model_selection import train_test_split
from sklearn.preprocessing import StandardScaler, label_binarize
from sklearn.ensemble import RandomForestClassifier, GradientBoostingClassifier, VotingClassifier
from sklearn.metrics import accuracy_score, classification_report, confusion_matrix, roc_curve, auc, ConfusionMatrixDisplay
from sklearn.calibration import CalibratedClassifierCV

# --- Configuration ---
DATASET_FILE = 'maternal_dataset.csv'
MODEL_OUTPUT_FILE = 'delivery_model.joblib' 

def create_ensemble_model(rf, gb):
    """Creates the Hybrid Ensemble (Your Model A structure)."""
    rf_cal = CalibratedClassifierCV(rf, method='isotonic', cv=3)
    gb_cal = CalibratedClassifierCV(gb, metho
                                    
    ensemble = VotingClassifier(
        estimators=[('rf', rf_cal), ('gb', gb_cal)],
        voting='soft',
        weights=[0.65, 0.35],
        n_jobs=-1
    )
    return ensemble

def run_model_training():
    df = pd.read_csv(DATASET_FILE)
    df.columns = [c.strip().lower().replace(" ", "_") for c in df.columns]
    df = df.fillna(0)

    # ============================
    # LABEL CORRECTION
    # ============================
    df['del_type'] = df['del_type'].str.lower().replace({
        'svd': 'normal', 
        'normal_vaginal': 'normal', 
        'c_section': 'caesarean', 
        'assisted': 'assisted'
    })

    df.loc[df['prev_ceaserean'] == 1, 'del_type'] = 'caesarean'
    df.loc[(df['prev_vaginal_birth'] == 1) & (df['prev_assisted'] == 0), 'del_type'] = 'normal'
    df.loc[(df['prev_assisted'] == 1) & (df['prev_ceaserean'] == 0), 'del_type'] = 'forceps'

    label_map = {'normal': 0, 'caesarean': 1, 'forceps': 2}
    df['target'] = df['del_type'].map(label_map)

    # ============================
    # FIRST TIME PREGNANCY LOGIC
    # ============================
    first_time_mask = (
        (df['prev_ceaserean'] == 0) &
        (df['prev_vaginal_birth'] == 0) &
        (df['prev_assisted'] == 0)
    )
    
    first_time_df = df[first_time_mask].copy()

    first_time_df.loc[first_time_df['bishop_score'] >= 7, 'del_type'] = 'normal'
    first_time_df.loc[first_time_df['bishop_score'] <= 5, 'del_type'] = 'caesarean'

    first_time_df.loc[
        (first_time_df['bishop_score'] == 6) &
        (first_time_df['bmi'] >= 30),
        'del_type'
    ] = 'forceps'

    first_time_df['target'] = first_time_df['del_type'].map(label_map)

    # ============================
    # FEATURE ENGINEERING
    # ============================
    df['pulse_pressure'] = df['bp_systolic'] - df['bp_diastolic']
    df['bp_ratio'] = df['bp_systolic'] / (df['bp_diastolic'] + 1)
    df['bmi_bp_ratio'] = df['bmi'] / (df['pulse_pressure'] + 1)
    df['glucose_weight_ratio'] = df['glucose_level'] / (df['weight_kg'] + 1)
    df['gestation_risk'] = (df['gest_age_weeks'] / 40) * df['bmi']
    df['age_bmi'] = df['maternal_age'] * df['bmi']
    df['bishops_delivery_certainty'] = (df['bishop_score'] / 13) * 100
    df['bishops_delivery_certainty'] = df['bishops_delivery_certainty'].clip(upper=100)

    df['composite_risk'] = (
        df['prev_ceaserean'] * 0.35 +
        df['prev_assisted'] * 0.35 +
        df['prev_vaginal_birth'] * 0.2 +
        df['glucose_weight_ratio'] * 0.05 +
        df['bp_ratio'] * 0.05
    )

    # ============================
    # TRAIN MODEL A
    # ============================
    X_all = df.drop(columns=['del_type', 'target'], errors='ignore')
    y_all = df['target']

    cat_cols = X_all.select_dtypes(include=['object']).columns
    if len(cat_cols) > 0:
        X_all = pd.get_dummies(X_all, columns=cat_cols, drop_first=True)

    scaler = StandardScaler()
    X_scaled_all = pd.DataFrame(scaler.fit_transform(X_all), columns=X_all.columns)

    X_train_A, X_test_A, y_train_A, y_test_A = train_test_split(
        X_scaled_all, y_all, test_size=0.2, stratify=y_all, random_state=42
    )

    rf_A = RandomForestClassifier(
        n_estimators=1300, max_depth=28, min_samples_split=2, 
        min_samples_leaf=1, max_features='sqrt',
        class_weight='balanced', random_state=42, n_jobs=-1
    )

    gb_A = GradientBoostingClassifier(
        n_estimators=500, learning_rate=0.04, max_depth=6, 
        subsample=0.9, random_state=42
    )

    ensemble_A = create_ensemble_model(rf_A, gb_A)
    ensemble_A.fit(X_train_A, y_train_A)

    acc_A = accuracy_score(y_test_A, ensemble_A.predict(X_test_A))
    print(f"\n🎯 Hybrid Ensemble (Model A) Overall Accuracy: {acc_A*100:.2f}%")
    print(classification_report(y_test_A, ensemble_A.predict(X_test_A), target_names=list(label_map.keys()), digits=2))

    # -----------------------------
    # FEATURE IMPORTANCE MODEL A
    # -----------------------------
    rf_cal_model = ensemble_A.named_estimators_['rf']
    fitted_rf = rf_A

    if hasattr(rf_cal_model, "calibrated_classifiers_"):
        fitted_rf = rf_cal_model.calibrated_classifiers_[0].estimator

    importances = pd.Series(fitted_rf.feature_importances_, index=X_all.columns)
    top10 = importances.sort_values(ascending=False).head(10)
    print("\n🌟 Top 10 Most Influential Features (Model A):")
    print(top10)

    # ============================
    # TRAIN MODEL B (FIRST-TIME)
    # ============================
    MODEL_B_EXCLUDE_COLS = [
        'del_type', 'target',
        'prev_ceaserean', 'prev_vaginal_birth', 'prev_assisted',
        'composite_risk'
    ]

    X_B_base = first_time_df.drop(columns=MODEL_B_EXCLUDE_COLS, errors='ignore')
    y_B = first_time_df['target']

    cat_cols_B = X_B_base.select_dtypes(include=['object']).columns
    if len(cat_cols_B) > 0:
        X_B_base = pd.get_dummies(X_B_base, columns=cat_cols_B, drop_first=True)

    MODEL_B_TRAINING_FEATURES = X_B_base.columns.tolist()

    scaler_B = StandardScaler()
    X_B_scaled = pd.DataFrame(scaler_B.fit_transform(X_B_base), columns=X_B_base.columns)

    X_B_train, X_B_test, y_B_train, y_B_test = train_test_split(
        X_B_scaled, y_B, test_size=0.2, random_state=42, stratify=y_B
    )

    model_B = RandomForestClassifier(
        n_estimators=1000,
        max_depth=15,
        min_samples_split=2,
        min_samples_leaf=1,
        class_weight='balanced',
        random_state=42
    )

    model_B.fit(X_B_train, y_B_train)

    acc_B = accuracy_score(y_B_test, model_B.predict(X_B_test))
    print(f"\n🎯 First-time mother model (Model B) Test Accuracy: {acc_B*100:.2f}%")
    print(classification_report(y_B_test, model_B.predict(X_B_test), target_names=list(label_map.keys()), digits=2))

    importances_B = pd.Series(model_B.feature_importances_, index=X_B_base.columns)
    top10_B = importances_B.sort_values(ascending=False).head(10)

    print("\n🌟 Top 10 Most Influential Features (Model B):")
    print(top10_B)

    # ============================
    # SAVE MODEL
    # ============================
    joblib.dump({
        'model': ensemble_A,
        'scaler': scaler,
        'features': X_all.columns.tolist(),
        'label_map': label_map,
        'top_features_A': top10.to_dict(),
        'first_time_model': model_B,
        'first_time_scaler': scaler_B,
        'first_time_features': MODEL_B_TRAINING_FEATURES,
    }, MODEL_OUTPUT_FILE)

    print(f"\n💾 DUAL Model saved as '{MODEL_OUTPUT_FILE}'")

    # ======================================================
    # 📊📊📊 GRAPHICAL & CHART REPRESENTATION SECTION
    # ======================================================

    # 1. DELIVERY TYPE DISTRIBUTION
    plt.figure(figsize=(6,5))
    df['del_type'].value_counts().plot(kind='bar')
    plt.title("Distribution of Delivery Types")
    plt.xlabel("Delivery Type")
    plt.ylabel("Count")
    plt.tight_layout()
    plt.show()

    # 2. CONFUSION MATRIX (MODEL A)
    plt.figure(figsize=(6,5))
    ConfusionMatrixDisplay.from_predictions(
        y_test_A, ensemble_A.predict(X_test_A),
        display_labels=list(label_map.keys())
    )
    plt.title("Confusion Matrix – Model A")
    plt.tight_layout()
    plt.show()

    # 3. ROC CURVE
    y_test_bin = label_binarize(y_test_A, classes=[0,1,2])
    y_score = ensemble_A.predict_proba(X_test_A)

    plt.figure(figsize=(8,6))
    colors = cycle(['black','gray','silver'])
    class_names = list(label_map.keys())

    for i, color in zip(range(3), colors):
        fpr, tpr, _ = roc_curve(y_test_bin[:, i], y_score[:, i])
        roc_auc = auc(fpr, tpr)
        plt.plot(fpr, tpr, label=f"{class_names[i]} (AUC={roc_auc:.2f})")

    plt.plot([0,1], [0,1], linestyle="--")
    plt.xlabel("False Positive Rate")
    plt.ylabel("True Positive Rate")
    plt.title("ROC Curve – Model A")
    plt.legend()
    plt.tight_layout()
    plt.show()

    # 4. FEATURE IMPORTANCE MODEL A
    plt.figure(figsize=(8,5))
    plt.barh(top10.index, top10.values)
    plt.title("Top 10 Important Features – Model A")
    plt.xlabel("Importance Score")
    plt.gca().invert_yaxis()
    plt.tight_layout()
    plt.show()

    # 5. FEATURE IMPORTANCE MODEL B
    plt.figure(figsize=(8,5))
    plt.barh(top10_B.index, top10_B.values)
    plt.title("Top 10 Important Features – Model B")
    plt.xlabel("Importance Score")
    plt.gca().invert_yaxis()
    plt.tight_layout()
    plt.show()

    # 6. ACCURACY COMPARISON
    plt.figure(figsize=(6,5))
    models = ['Model A', 'Model B']
    accuracies = [acc_A*100, acc_B*100]
    plt.bar(models, accuracies)
    plt.ylabel("Accuracy (%)")
    plt.title("Model Accuracy Comparison")
    plt.tight_layout()
    plt.show()

    # 7. BISHOP SCORE VS DELIVERY TYPE
    plt.figure(figsize=(7,5))
    plt.scatter(df['bishop_score'], df['target'])
    plt.title("Bishop Score vs Delivery Outcome")
    plt.xlabel("Bishop Score")
    plt.ylabel("Delivery Type (0=Normal,1=Cesarean,2=Forceps)")
    plt.tight_layout()
    plt.show()

    # 8. BMI VS DELIVERY TYPE
    plt.figure(figsize=(7,5))
    plt.scatter(df['bmi'], df['target'])
    plt.title("BMI vs Delivery Outcome")
    plt.xlabel("BMI")
    plt.ylabel("Delivery Type (0=Normal,1=Cesarean,2=Forceps)")
    plt.tight_layout()
    plt.show()

    return acc_A 


if __name__ == "__main__":
    acc = run_model_training()
    print(f"\n✅ Training complete! Hybrid (Model A) accuracy: {acc*100:.2f}%")
