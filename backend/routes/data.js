// backend/routes/data.js
import express from 'express';
import {
    addPatientData,
    getAllPatientData,
    updatePatientData,
    deletePatientData,
    getAllUsers,
    reviewPatientData,
    getPatientById,
    deleteUser
} from '../controllers/dataController.js';

import { protect, authorize } from '../controllers/authController.js';

const router = express.Router();

// Role-Based Access Control (RBAC) applied using authorize([roles])

// Data Entry: POST permission (Data Entry & Admin & Nurse & Doctor)
router.post('/patient', protect, authorize(['data_entry', 'admin', 'nurse', 'doctor']), addPatientData);

// Data Viewing: Single Patient Lookup for output page
router.get('/patient/:id', protect, authorize(['nurse', 'doctor', 'admin', 'data_entry']), getPatientById);

// Data Viewing: All roles allowed, filtering is in the controller
router.get('/patients', protect, authorize(['nurse', 'doctor', 'admin', 'data_entry']), getAllPatientData);

// Data Approval/Disapproval
router.put('/patient/:id/review', protect, authorize(['nurse', 'doctor', 'admin']), reviewPatientData);

// Data Update: Doctor, Admin, Data Entry AND Nurse (for resubmission)
router.put('/patient/:id', protect, authorize(['doctor', 'admin', 'data_entry', 'nurse']), updatePatientData);

// Data Deletion: Admin only
router.delete('/patient/:id', protect, authorize('admin'), deletePatientData);
router.delete('/users/:id', protect, authorize('admin'), deleteUser);

// User Management: Admin only
router.get('/users', protect, authorize('admin'), getAllUsers);

export default router;