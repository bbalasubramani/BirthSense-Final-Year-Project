// backend/routes/prediction.js
import express from 'express';
import { runPrediction } from '../controllers/predictionController.js';
import { protect, authorize } from '../controllers/authController.js';

const router = express.Router();

// Prediction: Doctor, Admin only
router.post('/patient/:id', protect, authorize(['doctor', 'admin']), runPrediction);

export default router;