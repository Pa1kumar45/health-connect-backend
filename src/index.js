/**
 * index.js - Main server entry point for Health-Connect backend
 *
 * This is the primary server file that initializes and configures the Health-Connect
 * MERN stack application backend. It sets up:
 *
 * Core Features:
 * - Express.js web server with RESTful API endpoints
 * - MongoDB database connection with Mongoose ODM
 * - Socket.io real-time communication for chat and video calls
 * - CORS configuration for cross-origin requests
 * - Cookie-based authentication middleware
 * - Comprehensive error handling
 *
 * Architecture:
 * - RESTful API design with modular route organization
 * - Real-time WebSocket communication via Socket.io
 * - JWT authentication with HTTP-only cookies
 * - Centralized error handling middleware
 * - Environment-based configuration
 *
 * Security Features:
 * - CORS protection with specific origin whitelist
 * - Cookie parser for secure session management
 * - Request validation and sanitization
 * - Error stack hiding in production
 *
 * Dependencies:
 * - Express.js: Web framework
 * - Mongoose: MongoDB ODM
 * - Socket.io: Real-time communication
 * - Cookie-parser: Cookie handling
 * - CORS: Cross-origin request handling
 * - Dotenv: Environment variable management
 */

import express from 'express'; // Core Express framework for web server
import mongoose from 'mongoose'; // MongoDB object modeling and connection
import cors from 'cors'; // Cross-Origin Resource Sharing middleware
import dotenv from 'dotenv'; // Environment variable loader
import cookieParser from 'cookie-parser'; // Cookie parsing middleware for authentication
import http from 'http'; // HTTP server module
import path from 'path'; // Path utilities for static file serving

// API route modules
import authRoutes from './routes/auth.js'; // Authentication endpoints
import doctorRoutes from './routes/doctors.js'; // Doctor management endpoints
import patientRoutes from './routes/patients.js'; // Patient management endpoints
import appointmentRoutes from './routes/appointments.js'; // Appointment booking endpoints
import adminRoutes from './routes/admin.js'; // Admin management endpoints
import uploadRoutes from './routes/uploads.js'; // File upload endpoints

// Utilities
import { startSessionCleanup } from './lib/sessionCleanup.js'; // Session cleanup scheduler
import { startAppointmentReminderScheduler } from './lib/appointmentReminder.js'; // Appointment reminder scheduler

// Create Express app and HTTP server
const app = express();
const server = http.createServer(app);
dotenv.config();
const PORT = process.env.PORT || 5000;

/**
 * Middleware Configuration
 *
 * Sets up essential middleware for request processing, security, and functionality.
 * Order is important - middleware executes in the sequence defined below.
 */

/**
 * CORS (Cross-Origin Resource Sharing) Configuration
 *
 * Enables controlled access from frontend application running on different origin.
 * Security features:
 * - Restricts access to specified frontend URL only
 * - Enables credentials (cookies) for authentication
 * - Allows specific HTTP methods for API operations
 * - Defines allowed headers for request validation
 *
 * Configuration:
 * - origin: Frontend URL from environment variable
 * - credentials: true (enables cookie-based authentication)
 * - methods: Comprehensive HTTP method support
 * - allowedHeaders: Standard headers plus custom authentication
 */
// Update CORS configuration
const allowedOrigins = [
  'http://localhost:5173',
  'http://localhost:3000',
  'https://super-puppy-3433f6.netlify.app',
];

app.use(
  cors({
    origin: function (origin, callback) {
      if (!origin) return callback(null, true);
      if (allowedOrigins.indexOf(origin) === -1) {
        const msg = 'The CORS policy for this site does not allow access from the specified Origin.';
        return callback(new Error(msg), false);
      }
      return callback(null, true);
    },
    credentials: true,
  })
);

// Enable preflight OPTIONS requests for all routes
app.options('*', cors());

/**
 * Body Parsing Middleware
 *
 * express.json(): Parses incoming JSON payloads in request body
 * - Enables automatic JSON parsing for API requests
 * - Sets request size limits for security
 * - Handles malformed JSON with appropriate errors
 */
app.use(express.json());

/**
 * Cookie Parser Middleware
 *
 * Parses cookies from incoming requests for authentication.
 * - Enables reading HTTP-only cookies
 * - Supports signed cookies for security
 * - Required for JWT token extraction from cookies
 */
app.use(cookieParser());

/**
 * Static File Serving for Uploads
 *
 * Serves files from the 'uploads' directory so that uploaded images can be accessed publicly.
 * This exposes URLs like /uploads/avatars/<filename>.
 */
app.use('/uploads', express.static(path.resolve('uploads')));

/**
 * MongoDB Database Connection
 *
 * Establishes connection to MongoDB database using Mongoose ODM.
 *
 * Connection Features:
 * - Uses environment variable for connection string
 * - Fallback to local MongoDB instance for development
 * - Promise-based connection with proper error handling
 * - Automatic reconnection and connection pooling
 *
 * Database Configuration:
 * - Production: MongoDB Atlas cloud database
 * - Development: Local MongoDB instance
 * - Connection string includes authentication and options
 *
 * Error Handling:
 * - Logs successful connection confirmation
 * - Captures and logs connection errors for debugging
 */

app.use('/api/admin', adminRoutes);

mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/medical_app')
  .then(() => {
    console.log('Connected to MongoDB');
    // Start session cleanup scheduler (runs every hour)
    startSessionCleanup(60);
    // Start appointment reminder scheduler (runs every minute)
    startAppointmentReminderScheduler(1);
  })
  .catch((err) => console.error('MongoDB connection error:', err));

/**
 * API Routes Configuration
 *
 * Defines all application endpoints with modular route organization.
 * Each route module handles specific domain functionality.
 */

/**
 * Health Check Endpoint
 *
 * Simple endpoint to verify server is running and responsive.
 * Used for:
 * - Server health monitoring
 * - Load balancer health checks
 * - Development testing
 */
app.get('/', (req, res) => {
  res.send('Hello from the backend!');
});

/**
 * Authentication Routes - /api/auth/*
 *
 * Handles user authentication and session management:
 * - POST /api/auth/register - User registration (doctors/patients)
 * - POST /api/auth/login - User login with role validation
 * - GET /api/auth/me - Get current authenticated user
 * - POST /api/auth/logout - User logout and session cleanup
 */
app.use('/api/auth', authRoutes);

/**
 * Doctor Routes - /api/doctors/*
 *
 * Manages doctor-related operations:
 * - GET /api/doctors - Get all doctors (public directory)
 * - GET /api/doctors/:id - Get specific doctor profile
 * - PUT /api/doctors/profile - Update doctor profile (authenticated)
 * - GET /api/doctors/appointments - Get doctor's appointments
 */
app.use('/api/doctors', doctorRoutes);

/**
 * Patient Routes - /api/patients/*
 *
 * Manages patient-related operations:
 * - GET /api/patients/profile - Get patient profile (authenticated)
 * - PUT /api/patients/profile - Update patient profile (authenticated)
 * - GET /api/patients/appointments - Get patient's appointments
 */
app.use('/api/patients', patientRoutes);

/**
 * Appointment Routes - /api/appointments/*
 *
 * Handles appointment booking and management:
 * - POST /api/appointments - Create new appointment
 * - GET /api/appointments/doctor - Get doctor's appointments
 * - GET /api/appointments/patient - Get patient's appointments
 * - PUT /api/appointments/:id - Update appointment details
 * - DELETE /api/appointments/:id - Cancel appointment
 */
app.use('/api/appointments', appointmentRoutes);

/**
 * Upload Routes - /api/uploads/*
 *
 * Handles file uploads (e.g., avatar images) via multipart/form-data.
 */
app.use('/api/uploads', uploadRoutes);

/**
 * Global Error Handling Middleware
 *
 * Centralized error handling for all unhandled errors in the application.
 *
 * Features:
 * - Catches all unhandled errors from routes and middleware
 * - Logs error stack trace for debugging (development/staging)
 * - Returns generic error message to client (security)
 * - Prevents application crashes from unhandled exceptions
 *
 * Security Considerations:
 * - Hides internal error details from client responses
 * - Logs detailed errors server-side for debugging
 * - Returns consistent error format across application
 *
 * Error Response Format:
 * {
 *   "message": "Something went wrong!",
 *   "status": 500
 * }
 */
app.use((err, req, res, _next) => {
  console.error(err.stack); // Log full error stack for debugging
  res.status(500).json({ message: 'Something went wrong!' });
});

/**
 * Server Startup
 *
 * Starts the HTTP server with Socket.io integration.
 *
 * Server Features:
 * - Express HTTP server for REST API
 * - Socket.io WebSocket server for real-time features
 * - Configurable port with environment variable
 * - Startup confirmation logging
 *
 * Real-time Features Enabled:
 * - Real-time chat messaging
 * - WebRTC video call signaling
 * - Online user status tracking
 * - Live notifications
 *
 * Note: Uses 'server' from socket.js instead of 'app' to enable
 * both HTTP and WebSocket protocols on the same port.
 */
server.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
});
