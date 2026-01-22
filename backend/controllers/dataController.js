// backend/controllers/dataController.js
import asyncHandler from 'express-async-handler';
import PatientData from '../models/PatientData.js';
import User from '../models/User.js';

/**
 * @route   POST /api/data/patient
 * @desc    Add new patient data (Data Entry ONLY)
 */
const addPatientData = asyncHandler(async (req, res) => {
  const {
    patientId,
    patientName,
    email,
    phone_number,
    age,
    height,
    weight,
    bmi,
    gravidity,
    parity,
    previous_cesarean,
    previous_vaginal_birth,
    previous_assisted,
    gestational_age,
    gestational_diabetes,
    hypertension,
    estimated_fetal_weight,
    amniotic_fluid_index,
    bishop_score,
    bp_systolic,
    bp_diastolic,
    bloodPressure,
    glucoseLevel,
    fetal_presentation,
    induction_of_labor,
    oxytocin_augmentation,
  } = req.body;

  // Check if Patient ID already exists
  if (await PatientData.findOne({ patientId })) {
    res.status(400);
    throw new Error('Patient ID already exists.');
  }

  // Create and save new record
  const patient = await PatientData.create({
    patientId,
    patientName,
    email,
    phone_number,
    age,
    height,
    weight,
    bmi,
    gravidity,
    parity,
    previous_cesarean,
    previous_vaginal_birth,
    previous_assisted,
    gestational_age,
    gestational_diabetes,
    hypertension,
    estimated_fetal_weight,
    amniotic_fluid_index,
    bishop_score,
    bp_systolic,
    bp_diastolic,
    bloodPressure,
    glucoseLevel,
    fetal_presentation,
    induction_of_labor,
    oxytocin_augmentation,
    enteredBy: req.user.id,
  });

  patient.predictionResult = 'Pending';
  patient.confidenceScore = 0.0;

  const updatedPatient = await patient.save();
  res.json(updatedPatient);
});

// 💡 NEW FUNCTION: Fetch single patient by ID for prediction output
/**
 * @route   GET /api/data/patient/:id
 * @desc    Get a single patient by MongoDB ID (All roles that need to view data)
 */
const getPatientById = asyncHandler(async (req, res) => {
    // Populate enteredBy to get the name/role of the data entry user
    const patient = await PatientData.findById(req.params.id)
        .populate('enteredBy', 'name role');

    if (!patient) {
        res.status(404);
        throw new Error('Patient not found');
    }

    res.json(patient);
});


/**
 * @route   GET /api/data/patients
 * @desc    Get all patient data based on user role
 */
const getAllPatientData = asyncHandler(async (req, res) => {
  let patients;
  const userRole = req.user.role;

  if (userRole === 'data_entry') {
    // Data entry users see only their own entries
    patients = await PatientData.find({ enteredBy: req.user._id })
      .populate('enteredBy', 'name role');
  } else if (userRole === 'nurse') {
    // Nurse sees all records needing review
    patients = await PatientData.find({
      $or: [
        { reviewStatus: { $in: ['PENDING', 'APPROVED', 'DISAPPROVED'] } },
        { reviewStatus: { $exists: false } },
        { reviewStatus: null }
      ]
    }).populate('enteredBy', 'name role');
  } else if (userRole === 'doctor' || userRole === 'admin') {
    // Doctor/Admin see only approved records
    patients = await PatientData.find({ reviewStatus: 'APPROVED' })
      .populate('enteredBy', 'name role');
  } else {
    res.status(403);
    throw new Error('Unauthorized role.');
  }

  res.status(200).json(patients || []);
});

/**
 * @route   PUT /api/data/patient/:id/review
 * @desc    Approve/Disapprove patient data (Nurse, Doctor, Admin ONLY)
 */
const reviewPatientData = asyncHandler(async (req, res) => {
  const patient = await PatientData.findById(req.params.id);
  const { status, reviewNote } = req.body;

  if (!patient) {
    res.status(404);
    throw new Error('Patient data not found');
  }

  if (!['APPROVED', 'DISAPPROVED'].includes(status)) {
    res.status(400);
    throw new Error('Invalid status provided.');
  }

  if (patient.reviewStatus !== 'PENDING' && patient.reviewStatus !== undefined) {
    res.status(400);
    throw new Error(`Data is already ${patient.reviewStatus}.`);
  }

  patient.reviewStatus = status;
  patient.reviewNote = reviewNote || null;
  patient.isApproved = (status === 'APPROVED');

  const updatedPatient = await patient.save();
  res.json({ message: `Patient data set to ${status}.`, patient: updatedPatient });
});

/**
 * @route   PUT /api/data/patient/:id
 * @desc    Update patient data (Data Entry, Doctor/Admin)
 * ✅ Resubmitted disapproved records become PENDING again
 */
const updatePatientData = asyncHandler(async (req, res) => {
  const patient = await PatientData.findById(req.params.id);

  if (!patient) {
    res.status(404);
    throw new Error('Patient data not found');
  }

  // Restrict updates
  if (req.user.role === 'doctor' && patient.reviewStatus !== 'APPROVED') {
    res.status(403);
    throw new Error('Cannot update unapproved patient data.');
  }

  // Apply field updates
  Object.assign(patient, {
    patientName: req.body.patientName ?? patient.patientName,
    email: req.body.email ?? patient.email,
    phone_number: req.body.phone_number ?? patient.phone_number,
    age: req.body.age ?? patient.age,
    height: req.body.height ?? patient.height,
    weight: req.body.weight ?? patient.weight,
    bmi: req.body.bmi ?? patient.bmi,
    gravidity: req.body.gravidity ?? patient.gravidity,
    parity: req.body.parity ?? patient.parity,
    previous_cesarean: req.body.previous_cesarean ?? patient.previous_cesarean,
    previous_vaginal_birth: req.body.previous_vaginal_birth ?? patient.previous_vaginal_birth,
    previous_assisted: req.body.previous_assisted ?? patient.previous_assisted,
    gestational_age: req.body.gestational_age ?? patient.gestational_age,
    gestational_diabetes: req.body.gestational_diabetes ?? patient.gestational_diabetes,
    hypertension: req.body.hypertension ?? patient.hypertension,
    estimated_fetal_weight: req.body.estimated_fetal_weight ?? patient.estimated_fetal_weight,
    amniotic_fluid_index: req.body.amniotic_fluid_index ?? patient.amniotic_fluid_index,
    bishop_score: req.body.bishop_score ?? patient.bishop_score,
    bp_systolic: req.body.bp_systolic ?? patient.bp_systolic,
    bp_diastolic: req.body.bp_diastolic ?? patient.bp_diastolic,
    bloodPressure: req.body.bloodPressure ?? patient.bloodPressure,
    glucoseLevel: req.body.glucoseLevel ?? patient.glucoseLevel,
    // 💡 FIX: Include new fields in the update logic
    fetal_presentation: req.body.fetal_presentation ?? patient.fetal_presentation,
    induction_of_labor: req.body.induction_of_labor ?? patient.induction_of_labor,
    oxytocin_augmentation: req.body.oxytocin_augmentation ?? patient.oxytocin_augmentation,
  });

  // ✅ Reset review status on data-entry resubmission
  if (req.user.role === 'data_entry') {
    patient.reviewStatus = 'PENDING';
    patient.reviewNote = '';
    patient.isApproved = false;
  }

  patient.predictionResult = 'Pending';
  patient.confidenceScore = 0.0;

  const updatedPatient = await patient.save();
  res.json(updatedPatient);
});

/**
 * @route   DELETE /api/data/patient/:id
 * @desc    Delete patient data (Admin only)
 */
const deletePatientData = asyncHandler(async (req, res) => {
  const patient = await PatientData.findById(req.params.id);
  if (patient) {
    await PatientData.deleteOne({ _id: req.params.id });
    res.json({ message: 'Patient data removed' });
  } else {
    res.status(404);
    throw new Error('Patient data not found');
  }
});

/**
 * @route   DELETE /api/data/user/:id
 * @desc    Delete user (Admin only)
 */
const deleteUser = asyncHandler(async (req, res) => {
  const user = await User.findById(req.params.id);

  if (!user) {
    res.status(404);
    throw new Error('User not found');
  }

  if (user.role === 'admin' && req.user.id !== user.id) {
    res.status(403);
    throw new Error('Cannot delete another Admin.');
  }

  await User.deleteOne({ _id: req.params.id });
  res.json({ message: 'User removed' });
});

/**
 * @route   GET /api/data/users
 * @desc    Get all users (Admin only)
 */
const getAllUsers = asyncHandler(async (req, res) => {
  const users = await User.find({}).select('-password');
  res.json(users);
});

export {
  addPatientData,
  getAllPatientData,
  updatePatientData,
  deletePatientData,
  getAllUsers,
  reviewPatientData,
  deleteUser,
  // 💡 EXPORT THE NEW FUNCTION
  getPatientById
};