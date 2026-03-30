const express = require('express');
const dotenv = require('dotenv');
const cors = require('cors');

// Load environment variables
dotenv.config();

const fs = require('fs');

process.on('uncaughtException', (err) => {
  console.error('UNCAUGHT EXCEPTION:', err);
  fs.writeFileSync('server_crash.log', `Uncaught Exception: ${err.message}\n${err.stack}`);
  process.exit(1);
});

process.on('unhandledRejection', (reason, promise) => {
  console.error('UNHANDLED REJECTION:', reason);
  fs.writeFileSync('server_crash.log', `Unhandled Rejection: ${reason}\n`);
  process.exit(1);
});

const { connectDB } = require('./src/config/database');
const routes = require('./src/routes');
const logActivity = require('./src/middleware/logger');
const { checkOverdueBorrowings } = require('./src/controllers/borrowingController');

// Load all models before setting up associations
require('./src/models/User');
require('./src/models/Category');
require('./src/models/Item');
require('./src/models/Borrowing');
require('./src/models/Notification');
require('./src/models/ActivityLog');

const setupAssociations = require('./src/models/associations');

const http = require('http');
const { initSocket } = require('./src/utils/socket');

const helmet = require('helmet');
const compression = require('compression');
const rateLimit = require('express-rate-limit');

const app = express();
const server = http.createServer(app);

// Custom CORS Middleware
app.use((req, res, next) => {
  const origin = req.headers.origin;
  // Reflect the origin if it exists, otherwise allow all (for mobile/curl)
  res.setHeader('Access-Control-Allow-Origin', origin || '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS, PATCH');
  res.setHeader('Access-Control-Allow-Headers', 'Origin, X-Requested-With, Content-Type, Accept, Authorization');
  res.setHeader('Access-Control-Allow-Credentials', 'true');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }
  next();
});

// Security Middleware (Modified for development)
app.use(helmet({
  contentSecurityPolicy: false,
  crossOriginResourcePolicy: { policy: "cross-origin" }
}));

// Rate Limiting (Increased for development)
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 1000,
  message: 'Too many requests from this IP, please try again after 15 minutes',
  standardHeaders: true,
  legacyHeaders: false,
});
app.use('/api', limiter);

// Stricter limiter for Login (Increased to allow more attempts during testing)
const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 25,
  message: { message: 'Terlalu banyak percobaan login, silakan coba lagi dalam 15 menit' },
  standardHeaders: true,
  legacyHeaders: false,
});
app.use('/api/auth/login', loginLimiter);

// Performance Middleware
app.use(compression());

// Body Parsers
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

const path = require('path');

// Activity logging middleware
app.use(logActivity);

// Routes
app.use('/api', routes);
app.use('/uploads', express.static('uploads'));

// Serve static files from the React app
app.use(express.static(path.join(__dirname, 'office-equipment-frontend/dist')));

// The "catchall" handler: for any request that doesn't
// match one above (and isn't an API or upload request), 
// send back React's index.html file.
app.get(/^(?!\/(api|uploads)).*/, (req, res) => {
  res.sendFile(path.join(__dirname, 'office-equipment-frontend/dist/index.html'));
});

// Error handling middleware
app.use((err, req, res, next) => {
  console.error(err.stack);
  try {
    fs.appendFileSync('error.log', `${new Date().toISOString()} - ${req.method} ${req.url} - ${err.message}\n${err.stack}\n\n`);
  } catch (logErr) {
    console.error('Failed to write to error.log:', logErr);
  }
  res.status(500).json({
    message: 'Something went wrong!',
    error: process.env.NODE_ENV === 'development' ? err.message : {}
  });
});

// Bind address: gunakan env HOST, atau flag --host, atau default 0.0.0.0 (development)
const args = process.argv.slice(2);
const HOST = process.env.HOST || (args.includes('--host') ? '0.0.0.0' : '0.0.0.0');
const PORT = process.env.PORT || 5000;



const startServer = async () => {
  try {
    setupAssociations();
    await connectDB();

    // Data Migration: Set isActivated = true for existing users with passwords
    try {
      const User = require('./src/models/User');
      const { Op } = require('sequelize');
      await User.update(
        { isActivated: true },
        { where: { password: { [Op.ne]: null }, isActivated: false } }
      );
      console.log('Migration: isActivated set for existing accounts');
    } catch (migErr) {
      console.warn('Migration warning (isActivated):', migErr.message);
      // Don't crash the server for this
    }

    initSocket(server);

    server.listen(PORT, HOST, () => {
      console.log(`Server running on http://${HOST}:${PORT} in ${process.env.NODE_ENV} mode`);
      console.log('Server restarted successfully with Socket.io');
    });

    // Run overdue check every hour
    if (typeof checkOverdueBorrowings === 'function') {
      checkOverdueBorrowings(); // Run once immediately
      setInterval(checkOverdueBorrowings, 60 * 60 * 1000);
    } else {
      console.error('Error: checkOverdueBorrowings is not a function upon server start');
    }

  } catch (err) {
    console.error('Failed to start server:', err);
    fs.writeFileSync('server_error.log', `Server start error: ${err.message}\n${err.stack}`);
    process.exit(1);
  }
};

startServer();