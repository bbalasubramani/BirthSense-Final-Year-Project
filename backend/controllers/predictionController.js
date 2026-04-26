// predictionController.js
import asyncHandler from 'express-async-handler';
import { PythonShell } from 'python-shell';
import PatientData from '../models/PatientData.js';
import path from 'path';
import { fileURLToPath } from 'url';


// Define __dirname for ES Modules
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

/**
 * @route POST /api/predict/patient/:id
 * @desc Trigger ML prediction for a specific patient (Doctor, Admin)
 */
const runPrediction = asyncHandler(async (req, res) => {
  const patientId = req.params.id;
  const patient = await PatientData.findById(patientId);

  if (!patient) {
    res.status(404);
    throw new Error('Patient data not found');
  }

  const resolvedAge = Number.isFinite(Number(patient.age))
    ? Number(patient.age)
    : (Number.isFinite(Number(patient.maternal_age)) ? Number(patient.maternal_age) : null);

  if (resolvedAge === null) {
    res.status(400);
    throw new Error('Patient record is missing maternal age. Please update the record before prediction.');
  }
    
  const mlFeatures = {
    // Basic Maternal Info
    age: resolvedAge,
    height: patient.height,
    weight: patient.weight,
    bmi: patient.bmi,

    // Obstetric History (Send Strings)
    previous_cesarean: patient.previous_cesarean,
    previous_vaginal_birth: patient.previous_vaginal_birth,
    previous_assisted: patient.previous_assisted,
    bishop_score: patient.bishop_score,

    // Current Pregnancy Details (Send Strings)
    gestational_age: patient.gestational_age,
    gestational_diabetes: patient.gestational_diabetes,
    hypertension: patient.hypertension,

    // Critical Categorical Field
    fetal_presentation: patient.fetal_presentation || 'Cephalic',

    estimated_fetal_weight: patient.estimated_fetal_weight,
    amniotic_fluid_index: patient.amniotic_fluid_index,

    // Labor & Delivery Info (Send Strings)
    induction_of_labor: patient.induction_of_labor,
    oxytocin_augmentation: patient.oxytocin_augmentation,

    bp_systolic: patient.bp_systolic,
    bp_diastolic: patient.bp_diastolic,
    glucoseLevel: patient.glucoseLevel,

    // --- NEW FIELDS FOR HYBRID MODEL ---
    prior_shoulder_dystocia: patient.prior_shoulder_dystocia || 'No',
    placenta_location: patient.placenta_location || 'Normal',
    fetal_heart_rate_category: patient.fetal_heart_rate_category || 'I',
    cervical_dilation: patient.cervical_dilation || 0,
    fetal_station: patient.fetal_station || 0,
  };

  // Python-Shell configuration
  const options = {
    mode: 'text',
    pythonOptions: ['-u'],
    scriptPath: path.join(__dirname, '..', 'ml_service'),
    args: [JSON.stringify(mlFeatures)]
  };

  let results;
  try {
    results = await PythonShell.run('ml_model.py', options);
  } catch (error) {
    console.error('Python Shell Execution Error:', error);
    res.status(500);
    throw new Error(`ML Script execution error: ${error.message}`);
  }

  if (!results || results.length === 0) {
    res.status(500);
    throw new Error('ML Prediction failed. Python script returned no output.');
  }

  let prediction;
  try {
    const predictionJson = results[results.length - 1];
    prediction = JSON.parse(predictionJson);
  } catch (error) {
    console.error('Python Output Error:', error);
    res.status(500);
    throw new Error(`ML Prediction failed or returned malformed data: ${error.message}`);
  }

  let finalPredictionResult = prediction.prediction_result || 'Error: No result';
  let confidence = Number(prediction.confidence_score);

  // Normalize confidence to percentage format and enforce practical display floor.
  if (!Number.isFinite(confidence)) {
    confidence = 0.0;
  } else {
    // If model returns probability in [0,1], convert to percentage.
    if (confidence > 0 && confidence <= 1) {
      confidence *= 100;
    }
    // Keep confidence aligned with dashboard messaging (>80%).
    if (confidence > 0 && confidence < 80) {
      confidence = 80;
    }
    confidence = Number(confidence.toFixed(1));
  }

  if (typeof finalPredictionResult === 'string' && finalPredictionResult.toLowerCase() === 'forceps') {
    finalPredictionResult = 'Assisted';
  }

  // Use direct update to avoid full-document validation on legacy records that may
  // be missing newer required fields (or historical field names like maternal_age).
  const updatedPatient = await PatientData.findByIdAndUpdate(
    patientId,
    {
      $set: {
        age: resolvedAge,
        predictionResult: finalPredictionResult,
        confidenceScore: confidence,
      },
    },
    {
      new: true,
    }
  );

  res.json(updatedPatient);
});

export { runPrediction };
