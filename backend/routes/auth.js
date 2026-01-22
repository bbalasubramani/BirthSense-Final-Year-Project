// backend/routes/auth.js
import express from 'express';
import { signup, login, logout, protect, getMe } from '../controllers/authController.js';

const router = express.Router();

// Public
router.post('/signup', signup);
router.post('/login', login);

// Protected
router.post('/logout', protect, logout);
router.get('/me', protect, getMe);

export default router;
