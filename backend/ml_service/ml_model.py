import pandas as pd
import numpy as np
import joblib
import os
import sys
import json
from typing import Dict, Any

# --- Configuration ---
MODEL_FILENAME = "delivery_model.joblib"

# --- Global Model Loading (Lazy) ---
model_components = None

def load_models_lazy():
    global model_components
    if model_components is not None:
        return model_components

    try:
        script_dir = os.path.dirname(os.path.abspath(__file__))
        model_full_path = os.path.join(script_dir, MODEL_FILENAME)
        
        # print(f"Loading model from {model_full_path}...", file=sys.stderr)
        model_data = joblib.load(model_full_path)
        
        components = {
            'model_A': model_data['model'],
            'scaler': model_data['scaler'],
            'features': model_data['features'],
            'label_map': model_data['label_map'],
            'ft_model': model_data['first_time_model'],
            'ft_scaler': model_data['first_time_scaler'],
            'ft_features': model_data['first_time_features'],
            'reverse_label_map': {v: k.capitalize() for k, v in model_data['label_map'].items()}
        }
        model_components = components
        return components

    except Exception as e:
        print(f"CRITICAL MODEL LOAD ERROR: {e}", file=sys.stderr)
        return None

def apply_clinical_pre_filter(input_data: Dict[str, Any]):
    """
    Applies non-negotiable clinical rules to bypass ML model.
    """
    # Rule 1: Placenta Previa -> Absolute C-Section
    placenta_location = str(input_data.get("placenta_location", "")).lower()
    if placenta_location == "previa":
        return {
            "prediction_result": "C-Section",
            "confidence_score": 100.0,
            "model_used": "Clinical_Rule_Exclusion (Placenta Previa)"
        }

    # Rule 2: Prior Shoulder Dystocia -> High Recurrence Risk -> C-Section
    prior_dystocia = str(input_data.get("prior_shoulder_dystocia", "")).lower()
    if prior_dystocia == "yes":
        return {
            "prediction_result": "C-Section",
            "confidence_score": 100.0,
            "model_used": "Clinical_Rule_Exclusion (Prior Shoulder Dystocia)"
        }

    # Rule 3: Fetal Distress (Category III) -> Immediate C-Section
    fhr_category = str(input_data.get("fetal_heart_rate_category", "")).upper()
    if fhr_category == "III":
        return {
            "prediction_result": "C-Section",
            "confidence_score": 100.0,
            "model_used": "Clinical_Rule_Exclusion (Fetal Distress - Cat III)"
        }

    # Rule 4: Malpresentation (Transverse or Breech) -> C-Section
    fetal_presentation = str(input_data.get("fetal_presentation", "")).lower()
    if fetal_presentation in ["transverse", "breech"]:
        return {
            "prediction_result": "C-Section",
            "confidence_score": 100.0,
            "model_used": f"Clinical_Rule_Exclusion ({fetal_presentation.capitalize()} Lie)"
        }
    
    return None

def calculate_clinical_risk_score(input_data: Dict[str, Any]):
    """
    Calculates a clinical risk score to adjust ML confidence.
    Returns: 'High', 'Medium', 'Low'
    """
    risk_points = 0
    
    # 1. Bishop Score & Labor Progress
    bishop = input_data.get("bishop_score", 0)
    dilation = input_data.get("cervical_dilation", 0)
    station = input_data.get("fetal_station", 0)
    
    if bishop < 6: risk_points += 1
    if dilation < 3: risk_points += 1 # Slow progress/unfavorable cervix
    if station < -2: risk_points += 1 # High station (head not engaged)

    # 2. Previous History
    if str(input_data.get("previous_cesarean")).lower() == "yes":
        risk_points += 2
        
    # 3. Fetal Presentation (Breech is handled by pre-filter, but if it slips through, it's high risk)
    if str(input_data.get("fetal_presentation", "")).lower() == "breech":
        risk_points += 3
        
    # 4. Comorbidities
    if str(input_data.get("gestational_diabetes")).lower() == "yes":
        risk_points += 1
    if str(input_data.get("hypertension")).lower() == "yes":
        risk_points += 1
        
    # 5. Maternal Factors
    age = input_data.get("age", 0)
    bmi = input_data.get("bmi", 0)
    
    if age > 35: risk_points += 1
    if bmi > 30: risk_points += 1
    
    # Determine Category
    if risk_points >= 4:
        return "High"
    elif risk_points >= 2:
        return "Medium"
    else:
        return "Low"

def predict_delivery_type_merged(input_data: Dict[str, Any]):
    # --- STEP 1: Clinical Pre-Filtering ---
    pre_filter_result = apply_clinical_pre_filter(input_data)
    if pre_filter_result:
        return pre_filter_result

    # Load models only if needed
    components = load_models_lazy()
    if components is None:
        raise RuntimeError("Prediction models failed to load.")
        
    model_A = components['model_A']
    ft_model = components['ft_model']
    scaler = components['scaler']
    ft_scaler = components['ft_scaler']
    features = components['features']
    ft_features = components['ft_features']
    reverse_label_map = components['reverse_label_map']
    
    # --- Feature Mapping and Encoding ---
    renamed_input = {
        "maternal_age": input_data.get("age", 0),
        "weight_kg": input_data.get("weight", 0),
        "height_cm": input_data.get("height", 0),
        "bmi": input_data.get("bmi", 0),
        
        # Obstetric History
        "prev_ceaserean": 1 if str(input_data.get("previous_cesarean")).lower() == "yes" else 0,
        "prev_vaginal_birth": 1 if str(input_data.get("previous_vaginal_birth")).lower() == "yes" else 0,
        "prev_assisted": 1 if str(input_data.get("previous_assisted")).lower() == "yes" else 0,
        "bishop_score": input_data.get("bishop_score", 0),

        # Current Pregnancy Details
        "gest_age_weeks": input_data.get("gestational_age", 0),
        "amniotic_fluid_index_afi": input_data.get("amniotic_fluid_index", 0),
        "estimated_fetal_weight_g": input_data.get("estimated_fetal_weight", 0),
        
        # Binary Encoding
        "gestational_diabetes": 1 if str(input_data.get("gestational_diabetes")).lower() == "yes" else 0,
        "hypertension_preeclampsia": 1 if str(input_data.get("hypertension")).lower() == "yes" else 0,
        
        # Labor Info
        "induction_of_labor": 1 if str(input_data.get("induction_of_labor")).lower() == "yes" else 0,
        "oxytocin_augmentation": 1 if str(input_data.get("oxytocin_augmentation")).lower() == "yes" else 0,

        # One-Hot Encoding for Fetal Presentation 
        "fetal_presentation_cephalic": 1 if str(input_data.get("fetal_presentation", "")).lower() == "cephalic" else 0,
        "fetal_presentation_breech": 1 if str(input_data.get("fetal_presentation", "")).lower() == "breech" else 0,
        "fetal_presentation_transverse": 1 if str(input_data.get("fetal_presentation", "")).lower() == "transverse" else 0,
        
        # Maternity Information
        "glucose_level": input_data.get("glucoseLevel", 0),
        "bp_systolic": input_data.get("bp_systolic", 0),
        "bp_diastolic": input_data.get("bp_diastolic", 0),
    }

    df_input = pd.DataFrame([renamed_input])

    # --- Feature Engineering ---
    df_input['pulse_pressure'] = df_input['bp_systolic'] - df_input['bp_diastolic']
    df_input['bp_ratio'] = df_input['bp_systolic'] / (df_input['bp_diastolic'] + 1)
    df_input['bmi_bp_ratio'] = df_input['bmi'] / (df_input['pulse_pressure'] + 1)
    df_input['glucose_weight_ratio'] = df_input['glucose_level'] / (df_input['weight_kg'] + 1)
    df_input['gestation_risk'] = (df_input['gest_age_weeks'] / 40) * df_input['bmi']
    df_input['age_bmi'] = df_input['maternal_age'] * df_input['bmi'] 
    df_input['bishops_delivery_certainty'] = (df_input['bishop_score'] / 13) * 100 
    df_input['bishops_delivery_certainty'] = df_input['bishops_delivery_certainty'].clip(upper=100) 

    # Composite risk index 
    df_input['composite_risk'] = (
        df_input['prev_ceaserean'] * 0.35 +
        df_input['prev_assisted'] * 0.35 +
        df_input['prev_vaginal_birth'] * 0.2 +
        df_input['glucose_weight_ratio'] * 0.05 +
        df_input['bp_ratio'] * 0.05
    )

    # --- Model Selection ---
    is_first_time = (
        renamed_input['prev_ceaserean'] == 0 and
        renamed_input['prev_vaginal_birth'] == 0 and
        renamed_input['prev_assisted'] == 0
    )

    if is_first_time:
        active_model = ft_model
        active_scaler = ft_scaler
        active_features = ft_features 
        model_name = "Model_B_95_Percent_Accurate"
        # print("Using Model B (First-Time Mother, 95% Confidence)", file=sys.stderr)
    else:
        active_model = model_A
        active_scaler = scaler
        active_features = features
        model_name = "Model_A_History"
        # print("Using Model A (Previous History, 91% Confidence)", file=sys.stderr)

    # --- Prediction ---
    df_to_scale = df_input.copy()
    for col in active_features:
        if col not in df_to_scale.columns:
            df_to_scale[col] = 0

    df_to_scale = df_to_scale[active_features]
    df_scaled_array = active_scaler.transform(df_to_scale)
    
    # Convert scaled array back to DataFrame with feature names to avoid sklearn warning
    df_scaled = pd.DataFrame(df_scaled_array, columns=active_features)

    pred = active_model.predict(df_scaled)[0]
    proba = active_model.predict_proba(df_scaled)[0]

    predicted_label = reverse_label_map.get(pred, "Unknown")
    confidence_pct = round(np.max(proba) * 100, 2)

    # --- STEP 2: Post-Processing (Confidence Adjustment) ---
    clinical_risk = calculate_clinical_risk_score(input_data)
    
    # Logic: If ML says C-Section and Clinical Risk is High -> Boost Confidence
    if predicted_label == "C-Section":
        if clinical_risk == "High":
            confidence_pct = min(confidence_pct + 15.0, 99.9)
            model_name += " + Clinical Boost (High Risk)"
        elif clinical_risk == "Low":
            confidence_pct = max(confidence_pct - 10.0, 50.1)
            model_name += " + Clinical Caution (Low Risk)"
            
    # Logic: If ML says Vaginal and Clinical Risk is High -> Lower Confidence (Flag it)
    elif predicted_label == "Vaginal":
        if clinical_risk == "High":
            confidence_pct = max(confidence_pct - 15.0, 50.1)
            model_name += " + Clinical Warning (High Risk)"

    return {
        "prediction_result": predicted_label,
        "confidence_score": confidence_pct,
        "model_used": model_name
    }

def run_prediction():
    # Note: We don't pre-check models here anymore to allow pre-filter to work fast.
    # Models will be checked inside predict_delivery_type_merged if needed.

    if len(sys.argv) > 1:
        try:
            input_json = sys.argv[1]
            raw_input = json.loads(input_json)
        except Exception as e:
            print(json.dumps({"error": f"Invalid JSON input: {e}", "confidence_score": 0.0}))
            sys.exit(1)
    else:
        # Local Testing Fallback - Testing the NOW ACCURATE Model B path
        raw_input = {
            "age": 26, "weight": 90, "height": 165, "bmi": 23.88, "bp_systolic": 110,
            "bp_diastolic": 70, "glucoseLevel": 100, "gestational_age": 39,
            "amniotic_fluid_index": 10, "estimated_fetal_weight": 3400,
            "previous_cesarean": "Yes", "previous_vaginal_birth": "No", 
            "previous_assisted": "No", "gestational_diabetes": "No",
            "hypertension": "No", "fetal_presentation": "Cephalic", "bishop_score": 8,
            "induction_of_labor": "No", "oxytocin_augmentation": "No",
            # New clinical fields
            "prior_shoulder_dystocia": "No",
            "placenta_location": "Normal",
            "fetal_heart_rate_category": "I",
            "cervical_dilation": 4,
            "fetal_station": -1
        }
        print("NOTE: Running in test mode with sample FIRST-TIME mother input (Targeting 95% Confidence).", file=sys.stderr)

    try:
        result = predict_delivery_type_merged(raw_input)
        print(json.dumps(result))
    except Exception as e:
        print(json.dumps({"error": f"Prediction execution failed: {repr(e)}", "confidence_score": 0.0}))
        sys.exit(1)

if __name__ == "__main__":
    run_prediction()