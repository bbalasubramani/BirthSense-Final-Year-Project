// backend/server.js
import express from 'express';
import dotenv from 'dotenv';
import connectDB from './config/config.js';
import cookieParser from 'cookie-parser';
import cors from 'cors';
import authRoutes from './routes/auth.js';
import dataRoutes from './routes/data.js';
import predictionRoutes from './routes/prediction.js';

import errorHandler from './utils/errorHandler.js';
import path from 'path'; // 💡 Core Node.js module for path manipulation
import { fileURLToPath } from 'url';

// Load environment variables
dotenv.config();
connectDB();

const app = express();
const PORT = process.env.PORT || 5000;

// 💡 NEW: Define __dirname equivalent and Frontend Path for ES Modules
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
// Assuming the frontend files are in the directory above the 'backend' folder
const frontendPath = path.resolve(__dirname, '..');


// Middleware
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(cookieParser());

// CORS (simplified as the proxy fix makes it Same-Origin, but kept for security)
app.use(cors({
  origin: 'http://localhost:5000',
  credentials: true
}));


// Route Definitions
app.use('/api/auth', authRoutes);
app.use('/api/data', dataRoutes);
app.use('/api/predict', predictionRoutes);



// 👇👇👇 FIX: SERVE FRONTEND STATIC FILES FROM THE API PORT (5000) 👇👇👇

if (process.env.NODE_ENV === 'development') {
  // 1. Set the static directory (serves script.js, styles.css, images, etc.)
  app.use(express.static(frontendPath));

  // 2. Explicitly handle the root and HTML files (ensures all .html routes work)
  app.get('/', (req, res) => {
    res.sendFile(path.join(frontendPath, 'index.html'));
  });

  // Fallback for any request that looks like an HTML file (doctor.html, login.html)
  app.get('/*.html', (req, res) => {
    res.sendFile(path.join(frontendPath, req.path));
  });
}

// Error handler
app.use(errorHandler);

// Start server
app.listen(PORT, () =>
  console.log(`✅ Server running in ${process.env.NODE_ENV} mode on port ${PORT}. Access frontend at http://localhost:${PORT}/index.html`)
);