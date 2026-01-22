// backend/controllers/authController.js
import asyncHandler from 'express-async-handler';
import jwt from 'jsonwebtoken';
import User from '../models/User.js';

/**
 * Helper to generate JWT and store it as HTTP-only cookie
 */
const generateToken = (res, userId) => {
  const token = jwt.sign({ userId }, process.env.JWT_SECRET, {
    expiresIn: process.env.JWT_COOKIE_EXPIRES_IN || '30d',
  });

  res.cookie('jwt', token, {
    httpOnly: true,                // prevents JS access
    secure: process.env.NODE_ENV !== 'development',
    sameSite: 'strict',
    maxAge: 30 * 24 * 60 * 60 * 1000, // 30 days
  });
};

/**
 * @route POST /api/auth/signup
 * @desc Register a new user
 * @access Public
 */
export const signup = asyncHandler(async (req, res) => {
  const { name, email, password, role = 'nurse' } = req.body;

  const allowedRoles = ['admin', 'doctor', 'nurse', 'data_entry'];
  if (!allowedRoles.includes(role)) {
    res.status(400);
    throw new Error(`Invalid role. Must be one of: ${allowedRoles.join(', ')}`);
  }

  const userExists = await User.findOne({ email });
  if (userExists) {
    res.status(400);
    throw new Error('User already exists');
  }

  const user = await User.create({ name, email, password, role });
  generateToken(res, user._id);

  res.status(201).json({
    _id: user._id,
    name: user.name,
    email: user.email,
    role: user.role,
  });
});

/**
 * @route POST /api/auth/login
 * @desc Authenticate user & issue cookie
 * @access Public
 */
export const login = asyncHandler(async (req, res) => {
  const { email, password } = req.body;

  const user = await User.findOne({ email });

  if (user && (await user.matchPassword(password))) {
    generateToken(res, user._id);
    res.json({
      _id: user._id,
      name: user.name,
      email: user.email,
      role: user.role,
    });
  } else {
    res.status(401);
    throw new Error('Invalid email or password');
  }
});

/**
 * @route POST /api/auth/logout
 * @desc Logout user & clear cookie
 * @access Private
 */
export const logout = asyncHandler(async (req, res) => {
  res.cookie('jwt', '', {
    httpOnly: true,
    expires: new Date(0),
    sameSite: 'strict',
    secure: process.env.NODE_ENV !== 'development',
  });
  res.status(200).json({ message: 'Logged out successfully' });
});

/**
 * @desc Middleware — Protect routes via JWT verification
 */
export const protect = asyncHandler(async (req, res, next) => {
  const token = req.cookies.jwt;

  if (!token) {
    res.status(401);
    throw new Error('Not authorized, no token');
  }

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    const user = await User.findById(decoded.userId).select('-password');

    if (!user) {
      res.status(401);
      throw new Error('User not found');
    }

    req.user = user;
    next();
  } catch (err) {
    res.status(401);
    throw new Error('Not authorized, token failed');
  }
});

/**
 * @desc Middleware — Role-based access control
 */
export const authorize = (roles = []) => {
  if (typeof roles === 'string') roles = [roles];
  return (req, res, next) => {
    console.log(`[Auth Debug] User Role: ${req.user ? req.user.role : 'No User'}, Required: ${roles}`);
    if (!req.user || (roles.length && !roles.includes(req.user.role))) {
      res.status(403);
      throw new Error(`Not authorized — requires: ${roles.join(', ')}`);
    }
    next();
  };
};

/**
 * @route GET /api/auth/me
 * @desc Get current logged-in user info
 * @access Private
 */
export const getMe = asyncHandler(async (req, res) => {
  res.json(req.user);
});
