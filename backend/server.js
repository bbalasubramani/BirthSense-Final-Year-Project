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
const normalizeOrigin = (value = '') => value.trim().replace(/\/$/, '');

const parseOrigins = (value = '') =>
  value
    .split(',')
    .map((origin) => normalizeOrigin(origin))
    .filter(Boolean);

const allowedOrigins = new Set([
  ...parseOrigins(process.env.FRONTEND_ORIGIN || ''),
  ...parseOrigins(process.env.CORS_ALLOWED_ORIGINS || ''),
  normalizeOrigin(process.env.NETLIFY_URL || ''),
  normalizeOrigin(process.env.RENDER_EXTERNAL_URL || '')
].filter(Boolean));

// Local development defaults
allowedOrigins.add(normalizeOrigin('http://localhost:5000'));
allowedOrigins.add(normalizeOrigin('http://127.0.0.1:5000'));
allowedOrigins.add(normalizeOrigin('http://localhost:5500'));
allowedOrigins.add(normalizeOrigin('http://127.0.0.1:5500'));

const corsOptions = {
  origin: (origin, callback) => {
    // Allow non-browser clients/tools that do not send Origin
    if (!origin) return callback(null, true);

    const normalizedOrigin = normalizeOrigin(origin);

    if (allowedOrigins.has(normalizedOrigin)) return callback(null, true);

    // Allow Netlify deploy-preview and production subdomains
    try {
      const { hostname, protocol } = new URL(normalizedOrigin);
      if (protocol === 'https:' && hostname.endsWith('.netlify.app')) {
        return callback(null, true);
      }
    } catch (error) {
      // fall through to rejection
    }

    return callback(new Error(`CORS blocked for origin: ${origin}`));
  },
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization']
};

app.use(cors(corsOptions));
app.options('*', cors(corsOptions));

// API Route Definitions
app.use('/api/auth', authRoutes);
app.use('/api/data', dataRoutes);
app.use('/api/predict', predictionRoutes);
app.get('/api/health', (req, res) => {
  res.status(200).json({ status: 'ok' });
});

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
} else {
  app.get('/', (req, res) => {
    res.status(200).json({
      message: 'BirthSense backend is running',
      health: '/api/health'
    });
  });
}

// Error handling middleware (must be after routes)
app.use(errorHandler);

// EXPORT FOR VERCEL
export default app;

if (process.env.VERCEL !== '1') {
  // Start server for local development and container deployments (e.g., Render)
  app.listen(PORT, () =>
    console.log(`✅ Server running in ${process.env.NODE_ENV || 'development'} mode on port ${PORT}.`)
  );
}
