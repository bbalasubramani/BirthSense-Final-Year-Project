// backend/server.js
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
const PORT = process.env.PORT || 5000;

// Resolve paths for static serving in development
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Middlewares
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(cookieParser());

// CORS Configuration
// Allows your Vercel frontend to communicate with the backend
const allowedOrigin = process.env.FRONTEND_ORIGIN || 'http://localhost:5000';
app.use(cors({
  origin: allowedOrigin,
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

// EXPORT FOR VERCEL
export default app;

if (process.env.NODE_ENV !== 'production' && process.env.VERCEL !== '1') {
  // Start server for local development
  app.listen(PORT, () =>
    console.log(`✅ Server running in ${process.env.NODE_ENV} mode on port ${PORT}. Access frontend at http://localhost:${PORT}/index.html`)
  );
}
