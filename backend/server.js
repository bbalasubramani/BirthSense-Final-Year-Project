import express from 'express';
import dotenv from 'dotenv';
import connectDB from './config/config.js';
import cookieParser from 'cookie-parser';
import cors from 'cors';
import path from 'path';
import { fileURLToPath } from 'url';

// Routes
import authRoutes from './routes/auth.js';
import dataRoutes from './routes/data.js';
import predictionRoutes from './routes/prediction.js';
import errorHandler from './utils/errorHandler.js';

// Configuration
dotenv.config();
connectDB();

const app = express();
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Middlewares
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(cookieParser());

// CORS Configuration
// Allows your Vercel frontend to communicate with the backend
app.use(cors({
  origin: process.env.NODE_ENV === 'production' 
    ? true // Allows the production domain
    : 'http://localhost:5000',
  credentials: true
}));

// API Route Definitions
app.use('/api/auth', authRoutes);
app.use('/api/data', dataRoutes);
app.use('/api/predict', predictionRoutes);

/**
 * STATIC FILE SERVING
 * In production (Vercel), vercel.json handles routing.
 * In development, we serve the frontend folder manually.
 */
if (process.env.NODE_ENV !== 'production') {
  const frontendPath = path.resolve(__dirname, '..', 'frontend'); 
  app.use(express.static(frontendPath));
  
  app.get('/', (req, res) => {
    res.sendFile(path.join(frontendPath, 'index.html'));
  });

  app.get('/*.html', (req, res) => {
    res.sendFile(path.join(frontendPath, req.path));
  });
}

// Error handling middleware (must be after routes)
app.use(errorHandler);

// START SERVER (Local only)
const PORT = process.env.PORT || 5000;
if (process.env.NODE_ENV !== 'production') {
  app.listen(PORT, () => {
    console.log(`✅ Server running locally on http://localhost:${PORT}`);
  });
}

// EXPORT FOR VERCEL
export default app;
