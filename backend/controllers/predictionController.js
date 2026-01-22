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

    const mlFeatures = {
        // Basic Maternal Info
        "age": patient.age,
        "height": patient.height,
        "weight": patient.weight,
        "bmi": patient.bmi,

        // Obstetric History (Send Strings)
        "previous_cesarean": patient.previous_cesarean,
        "previous_vaginal_birth": patient.previous_vaginal_birth,
        "previous_assisted": patient.previous_assisted,
        "bishop_score": patient.bishop_score,

        // Current Pregnancy Details (Send Strings)
        "gestational_age": patient.gestational_age,
        "gestational_diabetes": patient.gestational_diabetes,
        "hypertension": patient.hypertension,

        // Critical Categorical Field
        "fetal_presentation": patient.fetal_presentation || 'Cephalic',

        "estimated_fetal_weight": patient.estimated_fetal_weight,
        "amniotic_fluid_index": patient.amniotic_fluid_index,

        // Labor & Delivery Info (Send Strings)
        "induction_of_labor": patient.induction_of_labor,
        "oxytocin_augmentation": patient.oxytocin_augmentation,

        "bp_systolic": patient.bp_systolic,
        "bp_diastolic": patient.bp_diastolic,
        "glucoseLevel": patient.glucoseLevel,

        // --- NEW FIELDS FOR HYBRID MODEL ---
        "prior_shoulder_dystocia": patient.prior_shoulder_dystocia || 'No',
        "placenta_location": patient.placenta_location || 'Normal',
        "fetal_heart_rate_category": patient.fetal_heart_rate_category || 'I',
        "cervical_dilation": patient.cervical_dilation || 0,
        "fetal_station": patient.fetal_station || 0,
    };

    // 2. Python-Shell configuration
    const options = {
        mode: 'text',
        pythonOptions: ['-u'],
        // FIX: Use a more robust path configuration relative to the controller
        scriptPath: path.join(__dirname, '..', 'ml_service'), // Assumes ml_model.py is in the project root
        args: [JSON.stringify(mlFeatures)]
    };

    // 3. Execute the Python script
    PythonShell.run('ml_model.py', options).then(async results => {
        if (results && results.length > 0) {
            try {
                const predictionJson = results[results.length - 1];
                const prediction = JSON.parse(predictionJson);

                let finalPredictionResult = prediction.prediction_result || 'Error: No result';
                let confidence = prediction.confidence_score || 0.0;

                if (finalPredictionResult.toLowerCase() === 'forceps') {
                    finalPredictionResult = 'Assisted';
                }

                // 4. Update the patient record with the corrected label
                patient.predictionResult = finalPredictionResult;
                patient.confidenceScore = confidence;
                // patient.reviewStatus = 'PENDING'; // REMOVED: Do not reset status, keep it APPROVED so Doctor can see it

                const updatedPatient = await patient.save();



                res.json(updatedPatient); // Return the updated patient object

            } catch (e) {
                console.error('Python Output Error:', e);
                res.status(500);
                throw new Error(`ML Prediction failed or returned malformed data: ${e.message}`);
            }
        } else {
            res.status(500);
            throw new Error('ML Prediction failed. Python script returned no output.');
        }
    }).catch(err => {
        console.error('Python Shell Execution Error:', err);
        res.status(500);
        throw new Error(`ML Script execution error: ${err.message}`);
    });
});

export { runPrediction };
