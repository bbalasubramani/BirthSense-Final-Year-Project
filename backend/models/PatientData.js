import mongoose from 'mongoose';

const patientDataSchema = mongoose.Schema({
    patientId: {
        type: String,
        required: [true, "Patient ID is required."],
        unique: true,
    },
    enteredBy: {
        type: mongoose.Schema.Types.ObjectId,
        required: true,
        ref: 'User',
    },
    patientName: {
        type: String,
        required: [true, "Patient Name is required."],
    },
    height: {
        type: Number,
        required: true,
        min: [100, "Height should be between 100 and 250 cm."],
        max: [250, "Height should be between 100 and 250 cm."],
    },
    weight: {
        type: Number,
        required: true,
        min: [30, "Weight should be between 30 and 200 kg."],
        max: [200, "Weight should be between 30 and 200 kg."],
    },
    bmi: {
        type: Number,
        required: true,
        min: [15, "BMI should be between 15 and 40."],
        max: [40, "BMI should be between 15 and 40."],
    },
    gravidity: {
        type: Number,
        required: true,
        min: [0, "Gravidity should be between 0 and 20."],
        max: [20, "Gravidity should be between 0 and 20."],
    },
    parity: {
        type: Number,
        required: true,
        min: [0, "Parity should be between 0 and 15."],
        max: [15, "Parity should be between 0 and 15."],
    },
    gestational_age: {
        type: Number,
        required: true,
        min: [1, "Gestational Age should be between 1 and 42 weeks."],
        max: [42, "Gestational Age should be between 1 and 42 weeks."],
    },
    estimated_fetal_weight: {
        type: Number,
        required: true,
        min: [500, "Fetal Weight should be between 500 g and 6000 g."],
        max: [6000, "Fetal Weight should be between 500 g and 6000 g."],
    },
    amniotic_fluid_index: {
        type: Number,
        required: true,
        min: [5, "AFI should be between 5 and 25 cm."],
        max: [25, "AFI should be between 5 and 25 cm."],
    },
    bishop_score: {
        type: Number,
        required: true,
        min: [0, "Bishop Score should be between 0 and 13."],
        max: [13, "Bishop Score should be between 0 and 13."],
    },
    bp_systolic: {
        type: Number,
        required: true,
        min: [80, "Systolic BP should be between 80 and 200 mmHg."],
        max: [200, "Systolic BP should be between 80 and 200 mmHg."],
    },
    bp_diastolic: {
        type: Number,
        required: true,
        min: [40, "Diastolic BP should be between 40 and 120 mmHg."],
        max: [120, "Diastolic BP should be between 40 and 120 mmHg."],
    },
    previous_cesarean: {
        type: String,
        required: true,
        enum: ['Yes', 'No'],
    },
    previous_vaginal_birth: {
        type: String,
        required: true,
        enum: ['Yes', 'No'],
    },
    previous_assisted: {
        type: String,
        required: true,
        enum: ['Yes', 'No'],
    },


    gestational_diabetes: {
        type: String,
        required: true,
        enum: ['Yes', 'No'],
    },
    hypertension: {
        type: String,
        required: true,
        enum: ['Yes', 'No'],
    },
    fetal_presentation: {
        type: String,
        required: true,
        enum: ['Cephalic', 'Breech', 'Transverse', 'Other'],
        default: 'Cephalic',
    },
    // --- NEW FIELDS FOR HYBRID MODEL ---
    prior_shoulder_dystocia: {
        type: String,
        required: true,
        enum: ['Yes', 'No'],
        default: 'No',
    },
    placenta_location: {
        type: String,
        required: true,
        enum: ['Normal', 'Previa'],
        default: 'Normal',
    },
    fetal_heart_rate_category: {
        type: String,
        required: true,
        enum: ['I', 'II', 'III'],
        default: 'I',
    },
    cervical_dilation: {
        type: Number,
        required: true,
        min: [0, "Dilation must be between 0 and 10 cm."],
        max: [10, "Dilation must be between 0 and 10 cm."],
        default: 0,
    },
    fetal_station: {
        type: Number,
        required: true,
        min: [-5, "Station must be between -5 and +5."],
        max: [5, "Station must be between -5 and +5."],
        default: 0,
    },
    // -----------------------------------
    bloodPressure: {
        type: Number,
        required: false,
    },
    induction_of_labor: {
        type: String,
        required: true,
        enum: ['Yes', 'No'],
        default: 'No',
    },
    oxytocin_augmentation: {
        type: String,
        required: true,
        enum: ['Yes', 'No'],
        default: 'No',
    },
    glucoseLevel: {
        type: Number,
        required: true,
    },
    isApproved: {
        type: Boolean,
        default: false,
    },
    reviewStatus: {
        type: String,
        enum: ['PENDING', 'APPROVED', 'DISAPPROVED'],
        default: 'PENDING',
    },
    reviewNote: {
        type: String,
        default: null,
    },
    predictionResult: {
        type: String,
        default: 'Pending',
    },
    confidenceScore: {
        type: Number,
        default: 0.0,
    }
}, {
    timestamps: true,
});

const PatientData = mongoose.model('PatientData', patientDataSchema);

export default PatientData;