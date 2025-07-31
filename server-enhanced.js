require('dotenv').config();
const express = require('express');
const fs = require('fs');
const path = require('path');
const cookieParser = require('cookie-parser');
const https = require('https');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
const cors = require('cors');
const morgan = require('morgan');
const { body, validationResult } = require('express-validator');
const fileUpload = require('express-fileupload');

// Import database services and manager
const dbServices = require('./database/services');
const dbManager = require('./database/db');

// Import routes
const analyticsRoutes = require('./routes/analytics');
const userRoutes = require('./routes/users');
const profileRoutes = require('./routes/profiles');
const roleRoutes = require('./routes/roles');

const app = express();

// ==================== SECURITY MIDDLEWARE ====================

// Trust proxy for correct IP detection behind load balancers
app.set('trust proxy', 1);

// Disable X-Powered-By header
app.disable('x-powered-by');

// Security headers with Helmet
app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      styleSrc: ["'self'", "'unsafe-inline'", "https:"],
      scriptSrc: ["'self'", "'unsafe-inline'"],
      imgSrc: ["'self'", "data:", "https:"],
      connectSrc: ["'self'"],
      fontSrc: ["'self'", "https:", "data:"],
      objectSrc: ["'none'"],
      mediaSrc: ["'self'"],
      frameSrc: ["'none'"],
    },
  },
  crossOriginEmbedderPolicy: false, // Disable for Socket.IO compatibility
  crossOriginResourcePolicy: { policy: "cross-origin" }, // Allow cross-origin for API
}));

// CORS configuration
app.use(cors({
  origin: process.env.NODE_ENV === 'production' 
    ? ['https://yourdomain.com'] 
    : ['http://localhost:3000', 'https://localhost:3000'],
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With']
}));

// Rate limiting
const generalLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  limit: 100, // Limit each IP to 100 requests per window
  message: { error: 'Too many requests, please try again later.' },
  standardHeaders: true,
  legacyHeaders: false,
});

const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  limit: 5, // Limit each IP to 5 auth requests per window
  message: { error: 'Too many authentication attempts, please try again later.' },
  standardHeaders: true,
  legacyHeaders: false,
});

const otpLimiter = rateLimit({
  windowMs: 5 * 60 * 1000, // 5 minutes
  limit: 3, // Limit each IP to 3 OTP requests per window
  message: { error: 'Too many OTP requests, please wait before trying again.' },
  standardHeaders: true,
  legacyHeaders: false,
});

// Apply rate limiting
app.use('/api/', generalLimiter);
app.use('/api/admin/login', authLimiter);
app.use('/api/request-otp', otpLimiter);

// ==================== LOGGING MIDDLEWARE ====================

// Request logging
app.use(morgan('combined', {
  stream: {
    write: (message) => {
      console.log(message.trim());
      // In production, you might want to write to a file
      if (process.env.NODE_ENV === 'production') {
        fs.appendFileSync(path.join(__dirname, 'logs', 'access.log'), message);
      }
    }
  }
}));

// ==================== PARSING MIDDLEWARE ====================

app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));
app.use(cookieParser());

// File upload middleware
app.use(fileUpload({
  limits: { fileSize: 10 * 1024 * 1024 }, // 10MB limit
  abortOnLimit: true,
  createParentPath: true,
  useTempFiles: true,
  tempFileDir: '/tmp/'
}));

// ==================== VALIDATION MIDDLEWARE ====================

// Validation error handler
const handleValidationErrors = (req, res, next) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({
      error: 'Validation failed',
      details: errors.array()
    });
  }
  next();
};

// ==================== SSL CONFIGURATION ====================

const sslOptions = {
  key: fs.readFileSync(path.join(__dirname, 'ssl', 'key.pem')),
  cert: fs.readFileSync(path.join(__dirname, 'ssl', 'cert.pem'))
};

const server = https.createServer(sslOptions, app);
const io = require('socket.io')(server, {
  cors: {
    origin: process.env.NODE_ENV === 'production' 
      ? ['https://yourdomain.com'] 
      : ['http://localhost:3000', 'https://localhost:3000'],
    credentials: true
  }
});

const PORT = process.env.PORT || 3000;
const PORT2 = 443; // HTTPS default port
const DATA_FILE = path.join(__dirname, 'data.json'); // Fallback JSON file

// ==================== EMAIL CONFIGURATION ====================

const nodemailer = require('nodemailer');
const transporter = nodemailer.createTransport({
  host: process.env.SMTP_HOST || 'smtp.example.com',
  port: process.env.SMTP_PORT ? parseInt(process.env.SMTP_PORT) : 587,
  secure: false,
  auth: {
    user: process.env.SMTP_USER || 'user@example.com',
    pass: process.env.SMTP_PASS || 'password'
  }
});

// ==================== IN-MEMORY STORES (FOR BACKWARD COMPATIBILITY) ====================

// In-memory OTP store: { email: { otp, expiresAt } }
const otpStore = {};

// In-memory session store: { email: { deviceId: { verifiedAt, expiresAt } } }
const clientSessions = {};

// Admin authentication store
const adminSessions = {};

// Admin credentials
const ADMIN_CREDENTIALS = {
  username: 'admin',
  password: 'admin'
};

// ==================== JSON FALLBACK FUNCTIONS ====================

function readData() {
  if (!fs.existsSync(DATA_FILE)) {
    return { tickets: [], assets: [] };
  }
  return JSON.parse(fs.readFileSync(DATA_FILE, 'utf8'));
}

function writeData(data) {
  fs.writeFileSync(DATA_FILE, JSON.stringify(data, null, 2));
}

// ==================== AUTHENTICATION MIDDLEWARE ====================

// Admin authentication middleware
function requireAdminAuth(req, res, next) {
  const sessionId = req.cookies?.adminSession;
  
  if (!sessionId) {
    // Redirect to login page for HTML requests, JSON error for API requests
    if (req.path.endsWith('.html') || req.path.includes('admin-users') || req.path.includes('analytics')) {
      return res.redirect('/login');
    }
    return res.status(401).json({ error: 'Authentication required' });
  }
  
  // Check both database and in-memory sessions for backward compatibility
  const dbSession = dbServices.getAdminSession(sessionId);
  const memSession = adminSessions[sessionId];
  
  if (!dbSession && (!memSession || Date.now() > memSession.expiresAt)) {
    // Redirect to login page for HTML requests, JSON error for API requests
    if (req.path.endsWith('.html') || req.path.includes('admin-users') || req.path.includes('analytics')) {
      return res.redirect('/login');
    }
    return res.status(401).json({ error: 'Invalid or expired session' });
  }
  
  // Extend session
  if (dbSession) {
    // Update existing session instead of creating a new one
    dbServices.updateAdminSession(sessionId);
  } else if (memSession) {
    memSession.expiresAt = Date.now() + 24 * 60 * 60 * 1000; // 24 hours
  }
  
  req.adminUser = dbSession || memSession;
  next();
}

// Client authentication middleware
function requireClientAuth(req, res, next) {
  const { email, deviceId } = req.body;
  if (!email || !deviceId) {
    return res.status(400).json({ error: 'Email and device ID required' });
  }
  
  // Check both database and in-memory sessions for backward compatibility
  const dbSession = dbServices.getUserSession(deviceId);
  const memSessions = clientSessions[email.toLowerCase()];
  const memSession = memSessions && memSessions[deviceId];
  
  if (!dbSession && (!memSession || Date.now() > memSession.expiresAt)) {
    return res.status(401).json({ error: 'Authentication required' });
  }
  
  req.clientUser = dbSession || memSession;
  next();
}



// ==================== ROUTES ====================

// Health check endpoint
app.get('/api/health', (req, res) => {
  const dbHealth = dbManager.healthCheck();
  res.json({
    status: 'ok',
    timestamp: new Date().toISOString(),
    database: dbHealth ? 'connected' : 'disconnected',
    uptime: process.uptime()
  });
});

// ==================== AUTHENTICATION ROUTES ====================

// Check client authentication (enhanced with database + memory fallback)
app.post('/api/check-auth', 
  [
    body('email').isEmail().normalizeEmail(),
    body('deviceId').notEmpty().trim(),
    handleValidationErrors
  ],
  (req, res) => {
    const { email, deviceId } = req.body;
    
    // Check database first, then fallback to memory
    const dbSession = dbServices.getUserSession(deviceId);
    const memSessions = clientSessions[email.toLowerCase()];
    const memSession = memSessions && memSessions[deviceId];
    
    if (dbSession || (memSession && Date.now() < memSession.expiresAt)) {
      res.json({ authenticated: true });
    } else {
      // Clean up expired memory session
      if (memSessions && memSessions[deviceId]) {
        delete memSessions[deviceId];
      }
      res.json({ authenticated: false });
    }
  }
);

// Admin login (enhanced with database + memory fallback)
app.post('/api/admin/login',
  [
    body('username').notEmpty().trim(),
    body('password').notEmpty(),
    handleValidationErrors
  ],
  async (req, res) => {
    const { username, password } = req.body;
    
    try {
      // First try to authenticate against the user database
      const user = dbServices.getUserByEmail(username);
      if (user && user.password_hash) {
        const bcrypt = require('bcrypt');
        const isValidPassword = await bcrypt.compare(password, user.password_hash);
        
        if (isValidPassword && (user.role === 'admin' || user.role === 'technician')) {
          const sessionId = require('crypto').randomBytes(32).toString('hex');
          
          // Store in both database and memory for backward compatibility
          dbServices.createAdminSession(username, sessionId);
          adminSessions[sessionId] = {
            username: username,
            createdAt: Date.now(),
            expiresAt: Date.now() + 24 * 60 * 60 * 1000 // 24 hours
          };
          
          res.cookie('adminSession', sessionId, {
            httpOnly: true,
            secure: true,
            sameSite: 'strict',
            maxAge: 24 * 60 * 60 * 1000 // 24 hours
          });
          
          res.json({ success: true });
          return;
        }
      }
      
      // Fallback to hardcoded admin credentials
      if (username === ADMIN_CREDENTIALS.username && password === ADMIN_CREDENTIALS.password) {
        const sessionId = require('crypto').randomBytes(32).toString('hex');
        
        // Store in both database and memory for backward compatibility
        dbServices.createAdminSession(username, sessionId);
        adminSessions[sessionId] = {
          username: username,
          createdAt: Date.now(),
          expiresAt: Date.now() + 24 * 60 * 60 * 1000 // 24 hours
        };
        
        res.cookie('adminSession', sessionId, {
          httpOnly: true,
          secure: true,
          sameSite: 'strict',
          maxAge: 24 * 60 * 60 * 1000 // 24 hours
        });
        
        res.json({ success: true });
      } else {
        res.status(401).json({ error: 'Invalid credentials' });
      }
    } catch (error) {
      console.error('Login error:', error);
      res.status(500).json({ error: 'Authentication error' });
    }
  }
);

// Admin logout (enhanced with database + memory cleanup)
app.post('/api/admin/logout', (req, res) => {
  const sessionId = req.cookies?.adminSession;
  if (sessionId) {
    dbServices.deleteAdminSession(sessionId);
    delete adminSessions[sessionId];
  }
  res.clearCookie('adminSession');
  res.json({ success: true });
});

// Check admin authentication status (enhanced with database + memory fallback)
app.get('/api/admin/check-auth', (req, res) => {
  const sessionId = req.cookies?.adminSession;
  
  if (sessionId) {
    const dbSession = dbServices.getAdminSession(sessionId);
    const memSession = adminSessions[sessionId];
    
    if (dbSession || (memSession && Date.now() < memSession.expiresAt)) {
      const session = dbSession || memSession;
      res.json({ authenticated: true, username: session.username });
    } else {
      res.json({ authenticated: false });
    }
  } else {
    res.json({ authenticated: false });
  }
});

// ==================== OTP ROUTES ====================

// Generate and send OTP (enhanced with database + memory fallback)
app.post('/api/request-otp',
  [
    body('email').isEmail().normalizeEmail(),
    handleValidationErrors
  ],
  async (req, res) => {
    const { email } = req.body;
    
    const otp = Math.floor(100000 + Math.random() * 900000).toString();
    const expiresAt = Date.now() + 5 * 60 * 1000; // 5 minutes
    
    // Store OTP in both database and memory for backward compatibility
    dbServices.storeOTP(email, otp);
    otpStore[email.toLowerCase()] = { otp, expiresAt };
    
    console.log(`OTP requested for ${email}: ${otp}`);
    
    try {
      // Log SMTP config for debugging (do not log passwords in production)
      console.log('SMTP Config:', {
        host: process.env.SMTP_HOST,
        port: process.env.SMTP_PORT,
        user: process.env.SMTP_USER,
        from: process.env.SMTP_FROM
      });
      console.log('Attempting to send OTP email to:', email);
      
      const smtpHost = process.env.SMTP_HOST || 'smtp.example.com';
      const smtpUser = process.env.SMTP_USER || 'user@example.com';
      
      if (smtpHost === 'smtp.example.com' || smtpUser === 'user@example.com') {
        // Development mode - just return the OTP in response
        console.log('Development mode: OTP not actually sent via email');
        res.json({ 
          success: true, 
          message: 'Development mode - OTP not sent via email',
          otp: otp, // Only include OTP in development
          expiresAt: expiresAt
        });
      } else {
        // Production mode - send actual email
        await transporter.sendMail({
          from: process.env.SMTP_FROM || 'support@example.com',
          to: email,
          subject: 'Your IT Support OTP Code',
          text: `Your OTP code is: ${otp}\nThis code is valid for 5 minutes.`
        });
        console.log('OTP email sent successfully to:', email);
        res.json({ success: true, message: 'OTP sent to your email' });
      }
    } catch (err) {
      console.error('Email sending error:', err);
      res.status(500).json({ 
        error: 'Failed to send OTP email',
        details: err.message,
        suggestion: 'Check SMTP configuration or use development mode'
      });
    }
  }
);

// Verify OTP (enhanced with database + memory fallback)
app.post('/api/verify-otp',
  [
    body('email').isEmail().normalizeEmail(),
    body('otp').isLength({ min: 6, max: 6 }).isNumeric(),
    body('deviceId').notEmpty().trim(),
    handleValidationErrors
  ],
  (req, res) => {
    const { email, otp, deviceId } = req.body;
    
    // Check both database and memory for OTP
    const dbOTP = dbServices.getOTP(email);
    const memOTP = otpStore[email.toLowerCase()];
    
    let validOTP = null;
    if (dbOTP && dbOTP.otp === otp) {
      validOTP = dbOTP;
    } else if (memOTP && memOTP.otp === otp && Date.now() < memOTP.expiresAt) {
      validOTP = memOTP;
    }
    
    if (!validOTP) {
      return res.status(400).json({ error: 'Invalid or expired OTP' });
    }
    
    // OTP valid, create session and delete OTP
    dbServices.deleteOTP(email);
    delete otpStore[email.toLowerCase()];
    
    // Get or create user
    let user = dbServices.getUserByEmail(email);
    if (!user) {
      user = dbServices.createUser({
        email: email,
        name: 'Unknown User',
        role: 'user'
      });
    }
    
    // Create session in both database and memory for backward compatibility
    const sessionToken = require('crypto').randomBytes(32).toString('hex');
    dbServices.createUserSession(user.id, sessionToken, deviceId);
    
    if (!clientSessions[email.toLowerCase()]) {
      clientSessions[email.toLowerCase()] = {};
    }
    clientSessions[email.toLowerCase()][deviceId] = {
      verifiedAt: Date.now(),
      expiresAt: Date.now() + 24 * 60 * 60 * 1000, // 1 day
      deviceId: deviceId
    };
    
    console.log(`Creating session for ${email} on device ${deviceId}`);
    res.json({ success: true });
  }
);

// ==================== TICKET ROUTES ====================

// Get all tickets (enhanced with database + JSON fallback)
app.get('/api/tickets', (req, res) => {
  try {
    const tickets = dbServices.getTickets();
    const jsonData = readData();
    
    // If database is empty or has fewer tickets than JSON file, use JSON file data
    if (!tickets || tickets.length === 0 || tickets.length < jsonData.tickets.length) {
      console.log(`Database has ${tickets ? tickets.length : 0} tickets, JSON has ${jsonData.tickets.length}, using JSON file data for tickets`);
      res.json(jsonData.tickets);
    } else {
      res.json(tickets);
    }
  } catch (error) {
    console.error('Database error, falling back to JSON:', error);
    // Fallback to JSON file
    const data = readData();
    res.json(data.tickets);
  }
});

// Create new ticket (enhanced with database + JSON fallback)
app.post('/api/tickets',
  [
    body('subject').notEmpty().trim().isLength({ min: 1, max: 200 }),
    body('description').optional().trim(),
    body('email').isEmail().normalizeEmail(),
    body('requester').notEmpty().trim(),
    body('category').optional().isIn(['hardware', 'software', 'network', 'email', 'access', 'other']),
    body('priority').optional().isIn(['low', 'medium', 'high', 'critical']),
    handleValidationErrors
  ],
  (req, res) => {
    try {
      const ticket = dbServices.createTicket(req.body);
      io.emit('tickets-updated');
      res.json(ticket);
    } catch (error) {
      console.error('Database error, falling back to JSON:', error);
      // Fallback to JSON file
      const data = readData();
      const ticket = req.body;
      
      // Generate ticket ID
      const ticketId = `TKT-${String(data.tickets.length + 1).padStart(3, '0')}`;
      ticket.id = ticketId;
      
      // Create initial timeline with greetings and priority-based progress
      const now = new Date();
      const timeline = [
        {
          id: `timeline-${Date.now()}-1`,
          author: 'System',
          authorType: 'system',
          date: now.toISOString(),
          content: `Hello ${ticket.requester}! Thank you for submitting your ticket. We have received your request and will begin working on it shortly.`,
          type: 'greeting'
        },
        {
          id: `timeline-${Date.now()}-2`,
          author: 'System',
          authorType: 'system',
          date: now.toISOString(),
          content: getPriorityBasedMessage(ticket.priority),
          type: 'priority-info'
        },
        {
          id: `timeline-${Date.now()}-3`,
          author: 'System',
          authorType: 'system',
          date: now.toISOString(),
          content: `Ticket created with ID: ${ticketId}. Status: Open.`,
          type: 'creation'
        }
      ];
      
      ticket.timeline = timeline;
      ticket.createdDate = now.toISOString();
      ticket.lastUpdated = now.toISOString();
      
      data.tickets.unshift(ticket);
      writeData(data);
      io.emit('tickets-updated');
      res.json(ticket);
    }
  }
);

// Update ticket (enhanced with database + JSON fallback)
app.put('/api/tickets/:id',
  [
    body('subject').optional().trim().isLength({ min: 1, max: 200 }),
    body('description').optional().trim(),
    body('category').optional().isIn(['hardware', 'software', 'network', 'email', 'access', 'other']),
    body('priority').optional().isIn(['low', 'medium', 'high', 'critical']),
    body('status').optional().isIn(['open', 'in-progress', 'pending', 'resolved', 'closed', 'cancelled']),
    handleValidationErrors
  ],
  (req, res) => {
    try {
      // Try to parse as integer for database lookup
      const ticketId = parseInt(req.params.id);
      if (!isNaN(ticketId)) {
        const result = dbServices.updateTicket(ticketId, req.body);
        if (result.changes > 0) {
          io.emit('tickets-updated');
          const updatedTicket = dbServices.getTicketById(ticketId);
          res.json(updatedTicket);
          return;
        }
      }
      
      // If database lookup fails or no changes, fall back to JSON
      throw new Error('Ticket not found in database, falling back to JSON');
    } catch (error) {
      console.error('Database error, falling back to JSON:', error);
      // Fallback to JSON file
      const data = readData();
      const idx = data.tickets.findIndex(t => t.id === req.params.id || t.ticket_id === req.params.id);
      if (idx !== -1) {
        data.tickets[idx] = { ...data.tickets[idx], ...req.body };
        data.tickets[idx].lastUpdated = new Date().toISOString();
        writeData(data);
        io.emit('tickets-updated');
        res.json(data.tickets[idx]);
      } else {
        res.status(404).json({ error: 'Ticket not found' });
      }
    }
  }
);

// Add timeline entry (enhanced with database + JSON fallback)
app.post('/api/tickets/:id/timeline',
  [
    body('content').notEmpty().trim(),
    body('author').optional().trim(),
    body('authorType').optional().isIn(['system', 'agent', 'user']),
    body('entryType').optional().isIn(['greeting', 'priority-info', 'creation', 'status-change', 'note', 'resolution']),
    handleValidationErrors
  ],
  (req, res) => {
    try {
      // Try to parse as integer for database lookup
      const ticketId = parseInt(req.params.id);
      if (!isNaN(ticketId)) {
        const entry = dbServices.createTimelineEntry(ticketId, req.body);
        io.emit('tickets-updated');
        res.json(entry);
        return;
      }
      
      // If database lookup fails, fall back to JSON
      throw new Error('Ticket not found in database, falling back to JSON');
    } catch (error) {
      console.error('Database error, falling back to JSON:', error);
      // Fallback to JSON file
      const data = readData();
      const idx = data.tickets.findIndex(t => t.id === req.params.id || t.ticket_id === req.params.id);
      if (idx !== -1) {
        const timelineEntry = {
          id: `timeline-${Date.now()}`,
          author: req.body.author || 'Agent',
          authorType: req.body.authorType || 'agent',
          date: new Date().toISOString(),
          content: req.body.content,
          type: req.body.entryType || 'note'
        };
        
        if (!data.tickets[idx].timeline) {
          data.tickets[idx].timeline = [];
        }
        
        data.tickets[idx].timeline.unshift(timelineEntry);
        data.tickets[idx].lastUpdated = new Date().toISOString();
        
        writeData(data);
        io.emit('tickets-updated');
        res.json(timelineEntry);
      } else {
        res.status(404).json({ error: 'Ticket not found' });
      }
    }
  }
);

// ==================== ASSET ROUTES ====================

// Get all assets (enhanced with database + JSON fallback)
app.get('/api/assets', (req, res) => {
  try {
    const assets = dbServices.getAssets();
    const jsonData = readData();
    
    // If database is empty or has fewer assets than JSON file, use JSON file data
    if (!assets || assets.length === 0 || assets.length < jsonData.assets.length) {
      console.log(`Database has ${assets ? assets.length : 0} assets, JSON has ${jsonData.assets.length}, using JSON file data for assets`);
      res.json(jsonData.assets);
    } else {
      res.json(assets);
    }
  } catch (error) {
    console.error('Database error, falling back to JSON:', error);
    // Fallback to JSON file
    const data = readData();
    res.json(data.assets);
  }
});

// Create new asset (enhanced with database + JSON fallback)
app.post('/api/assets',
  [
    body('assetNo').notEmpty().trim(),
    body('type').optional().isIn(['laptop', 'desktop', 'monitor', 'printer', 'network', 'mobile', 'software', 'other']),
    body('brand').optional().trim(),
    body('model').optional().trim(),
    body('email').optional().isEmail().normalizeEmail(),
    body('status').optional().isIn(['active', 'inactive', 'maintenance', 'retired', 'lost']),
    handleValidationErrors
  ],
  (req, res) => {
    try {
      const asset = dbServices.createAsset(req.body);
      io.emit('assets-updated');
      res.json(asset);
    } catch (error) {
      console.error('Database error, falling back to JSON:', error);
      // Fallback to JSON file
      const data = readData();
      const asset = req.body;
      data.assets.unshift(asset);
      writeData(data);
      io.emit('assets-updated');
      res.json(asset);
    }
  }
);

// Update asset (enhanced with database + JSON fallback)
app.put('/api/assets/:id',
  [
    body('type').optional().isIn(['laptop', 'desktop', 'monitor', 'printer', 'network', 'mobile', 'software', 'other']),
    body('status').optional().isIn(['active', 'inactive', 'maintenance', 'retired', 'lost']),
    handleValidationErrors
  ],
  (req, res) => {
    try {
      const assetId = parseInt(req.params.id);
      const result = dbServices.updateAsset(assetId, req.body);
      if (result.changes > 0) {
        io.emit('assets-updated');
        const updatedAsset = dbServices.getAssetById(assetId);
        res.json(updatedAsset);
      } else {
        res.status(404).json({ error: 'Asset not found' });
      }
    } catch (error) {
      console.error('Database error, falling back to JSON:', error);
      // Fallback to JSON file
      const data = readData();
      const idx = data.assets.findIndex(a => a.assetNo === req.params.id || a.id === req.params.id);
      if (idx !== -1) {
        data.assets[idx] = { ...data.assets[idx], ...req.body };
        writeData(data);
        io.emit('assets-updated');
        res.json(data.assets[idx]);
      } else {
        res.status(404).json({ error: 'Asset not found' });
      }
    }
  }
);

// Delete asset (enhanced with database + JSON fallback)
app.delete('/api/assets/:id', (req, res) => {
  try {
    const assetId = parseInt(req.params.id);
    const result = dbServices.deleteAsset(assetId);
    if (result.changes > 0) {
      io.emit('assets-updated');
      res.json({ success: true });
    } else {
      res.status(404).json({ error: 'Asset not found' });
    }
  } catch (error) {
    console.error('Database error, falling back to JSON:', error);
    // Fallback to JSON file
    const data = readData();
    const idx = data.assets.findIndex(a => a.assetNo === req.params.id || a.id === req.params.id);
    if (idx !== -1) {
      const removed = data.assets.splice(idx, 1);
      writeData(data);
      io.emit('assets-updated');
      res.json({ success: true, removed: removed[0] });
    } else {
      res.status(404).json({ error: 'Asset not found' });
    }
  }
});

// ==================== DASHBOARD ROUTES ====================

// Get dashboard statistics (enhanced with database + JSON fallback)
app.get('/api/dashboard/stats', (req, res) => {
  try {
    const stats = dbServices.getDashboardStats();
    res.json(stats);
  } catch (error) {
    console.error('Database error, falling back to JSON:', error);
    // Fallback to JSON file
    const data = readData();
    const stats = {
      totalTickets: data.tickets.length,
      openTickets: data.tickets.filter(t => t.status === 'open' || t.status === 'in-progress').length,
      closedToday: 0, // Would need date filtering
      totalAssets: data.assets.length
    };
    res.json(stats);
  }
});

// ==================== ANALYTICS ROUTES ====================

// Mount analytics routes
app.use('/api/analytics', analyticsRoutes);

// Mount user management routes
app.use('/api/users', userRoutes);
app.use('/api/profiles', profileRoutes);
app.use('/api/roles', roleRoutes);

// ==================== PAGE ROUTES ====================

// Serve login page
app.get('/login', (req, res) => {
  res.sendFile(path.join(__dirname, 'login.html'));
});

// Serve the main admin page (protected)
app.get('/', requireAdminAuth, (req, res) => {
  res.sendFile(path.join(__dirname, 'html.html'));
});

// Serve the analytics dashboard (protected)
app.get('/analytics', requireAdminAuth, (req, res) => {
  res.sendFile(path.join(__dirname, 'analytics-dashboard.html'));
});

// Serve the admin users management page (protected)
app.get('/admin-users', requireAdminAuth, (req, res) => {
  res.sendFile(path.join(__dirname, 'admin-users.html'));
});

// Also protect the .html version
app.get('/admin-users.html', requireAdminAuth, (req, res) => {
  res.sendFile(path.join(__dirname, 'admin-users.html'));
});

// Also protect the analytics dashboard .html version
app.get('/analytics-dashboard.html', requireAdminAuth, (req, res) => {
  res.sendFile(path.join(__dirname, 'analytics-dashboard.html'));
});

// Serve the client portal page
app.get('/client', (req, res) => {
  res.sendFile(path.join(__dirname, 'client.html'));
});

// ==================== HELPER FUNCTIONS ====================

// Helper function to get priority-based messages
function getPriorityBasedMessage(priority) {
  const messages = {
    low: 'This ticket has been classified as LOW priority. Expected response time: 24-48 hours. We will address this as soon as possible.',
    medium: 'This ticket has been classified as MEDIUM priority. Expected response time: 4-8 hours. Our team will begin working on this shortly.',
    high: 'This ticket has been classified as HIGH priority. Expected response time: 1-2 hours. This will be escalated immediately to our support team.',
    critical: 'This ticket has been classified as CRITICAL priority. Expected response time: 1 hour. This will be escalated immediately to our support team.'
  };
  return messages[priority] || messages.medium;
}

// ==================== STATIC FILES ====================

// Serve static files after all routes (so protected routes take precedence)
app.use(express.static(__dirname, {
  setHeaders: (res, filePath) => {
    if (filePath.endsWith('.html')) {
      res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
    }
  }
}));

// ==================== ERROR HANDLING MIDDLEWARE ====================

// 404 handler
app.use((req, res) => {
  res.status(404).json({ error: 'Endpoint not found' });
});

// Global error handler
app.use((err, req, res, next) => {
  console.error('Unhandled error:', err);
  
  // Don't leak error details in production
  if (process.env.NODE_ENV === 'production') {
    res.status(500).json({ error: 'Internal server error' });
  } else {
    res.status(500).json({ 
      error: 'Internal server error',
      details: err.message,
      stack: err.stack
    });
  }
});

// ==================== SOCKET.IO ====================

io.on('connection', (socket) => {
  console.log('Client connected:', socket.id);
  
  socket.on('disconnect', () => {
    console.log('Client disconnected:', socket.id);
  });
});

// ==================== CLEANUP TASKS ====================

// Clean up expired sessions and OTPs every hour
setInterval(() => {
  try {
    dbServices.cleanupExpired();
    
    // Also clean up in-memory stores
    const now = Date.now();
    
    // Clean up expired OTPs
    Object.keys(otpStore).forEach(email => {
      if (now > otpStore[email].expiresAt) {
        delete otpStore[email];
      }
    });
    
    // Clean up expired client sessions
    Object.keys(clientSessions).forEach(email => {
      Object.keys(clientSessions[email]).forEach(deviceId => {
        if (now > clientSessions[email][deviceId].expiresAt) {
          delete clientSessions[email][deviceId];
        }
      });
      // Remove empty email entries
      if (Object.keys(clientSessions[email]).length === 0) {
        delete clientSessions[email];
      }
    });
    
    // Clean up expired admin sessions
    Object.keys(adminSessions).forEach(sessionId => {
      if (now > adminSessions[sessionId].expiresAt) {
        delete adminSessions[sessionId];
      }
    });
    
    console.log('Cleanup completed');
  } catch (error) {
    console.error('Cleanup error:', error);
  }
}, 60 * 60 * 1000); // 1 hour

// ==================== SERVER STARTUP ====================

server.listen(PORT, () => {
  console.log(`🚀 Enhanced HTTPS Server running at https://localhost:${PORT}`);
  console.log(`📊 Database connected: ${dbManager.healthCheck() ? '✅' : '❌'}`);
  console.log(`🛡️ Security features: Helmet, Rate Limiting, CORS, Input Validation`);
  console.log(`🔄 Fallback mode: JSON file storage available`);
  console.log(`🔧 Development mode: Enhanced logging and debugging`);
});

// Try to bind to port 443 as well
try {
  server.listen(PORT2, () => {
    console.log(`🌐 HTTPS Server also running at https://localhost:${PORT2}`);
  });
} catch (err) {
  console.error('Could not bind to port 443 (try running with sudo):', err.message);
}

// Graceful shutdown
process.on('SIGTERM', () => {
  console.log('SIGTERM received, shutting down gracefully');
  server.close(() => {
    console.log('Server closed');
    process.exit(0);
  });
});

process.on('SIGINT', () => {
  console.log('SIGINT received, shutting down gracefully');
  server.close(() => {
    console.log('Server closed');
    process.exit(0);
  });
}); 