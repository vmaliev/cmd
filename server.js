require('dotenv').config();
const express = require('express');
const fs = require('fs');
const path = require('path');
const app = express();
const http = require('http').createServer(app);
const io = require('socket.io')(http);
const PORT = 3000;
const PORT1 = 3000;
const PORT2 = 80;
const DATA_FILE = path.join(__dirname, 'data.json');
const nodemailer = require('nodemailer');

app.use(express.json()); // <-- Move this to the top, before any routes

// In-memory OTP store: { email: { otp, expiresAt } }
const otpStore = {};

// In-memory session store: { email: { verifiedAt, expiresAt } }
const clientSessions = {};

// Check if email is already authenticated
app.post('/api/check-auth', (req, res) => {
  const { email } = req.body || {};
  if (!email) return res.status(400).json({ error: 'Email required' });
  const session = clientSessions[email.toLowerCase()];
  if (session && Date.now() < session.expiresAt) {
    res.json({ authenticated: true });
  } else {
    if (session) delete clientSessions[email.toLowerCase()];
    res.json({ authenticated: false });
  }
});

// Configure nodemailer (use env vars or placeholder)
const transporter = nodemailer.createTransport({
  host: process.env.SMTP_HOST || 'smtp.example.com',
  port: process.env.SMTP_PORT ? parseInt(process.env.SMTP_PORT) : 587,
  secure: false,
  auth: {
    user: process.env.SMTP_USER || 'user@example.com',
    pass: process.env.SMTP_PASS || 'password'
  }
});

app.use(express.static(__dirname)); // Serve static files (html.html, etc.)

// Serve the main admin page
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'html.html'));
});

// Serve the client portal page
app.get('/client', (req, res) => {
  res.sendFile(path.join(__dirname, 'client.html'));
});

function readData() {
  if (!fs.existsSync(DATA_FILE)) {
    return { tickets: [], assets: [] };
  }
  return JSON.parse(fs.readFileSync(DATA_FILE, 'utf8'));
}
function writeData(data) {
  fs.writeFileSync(DATA_FILE, JSON.stringify(data, null, 2));
}

// --- Tickets ---
app.get('/api/tickets', (req, res) => {
  const data = readData();
  res.json(data.tickets);
});
app.post('/api/tickets', (req, res) => {
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
});

// Helper function to get priority-based messages
function getPriorityBasedMessage(priority) {
  const messages = {
    low: 'This ticket has been classified as LOW priority. Expected response time: 24-48 hours. We will address this as soon as possible.',
    medium: 'This ticket has been classified as MEDIUM priority. Expected response time: 4-8 hours. Our team will begin working on this shortly.',
    high: 'This ticket has been classified as HIGH priority. Expected response time: 1-2 hours. This will be escalated immediately to our support team.'
  };
  return messages[priority] || messages.medium;
}
app.put('/api/tickets/:id', (req, res) => {
  const data = readData();
  const idx = data.tickets.findIndex(t => t.id === req.params.id);
  if (idx !== -1) {
    data.tickets[idx] = req.body;
    data.tickets[idx].lastUpdated = new Date().toISOString();
    writeData(data);
    io.emit('tickets-updated');
    res.json(data.tickets[idx]);
  } else {
    res.status(404).json({ error: 'Ticket not found' });
  }
});

// Add timeline entry to a ticket
app.post('/api/tickets/:id/timeline', (req, res) => {
  const data = readData();
  const idx = data.tickets.findIndex(t => t.id === req.params.id);
  if (idx !== -1) {
    const timelineEntry = {
      id: `timeline-${Date.now()}`,
      author: req.body.author || 'Agent',
      authorType: req.body.authorType || 'agent',
      date: new Date().toISOString(),
      content: req.body.content,
      type: req.body.type || 'note'
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
});

// --- Assets ---
app.get('/api/assets', (req, res) => {
  const data = readData();
  res.json(data.assets);
});
app.post('/api/assets', (req, res) => {
  const data = readData();
  const asset = req.body;
  // Accept all fields, no validation
  data.assets.unshift(asset);
  writeData(data);
  io.emit('assets-updated');
  res.json(asset);
});
app.put('/api/assets/:id', (req, res) => {
  const data = readData();
  // Find by assetNo (new unique field)
  const idx = data.assets.findIndex(a => a.assetNo === req.params.id || a.id === req.params.id);
  if (idx !== -1) {
    data.assets[idx] = req.body;
    writeData(data);
    io.emit('assets-updated');
    res.json(data.assets[idx]);
  } else {
    res.status(404).json({ error: 'Asset not found' });
  }
});
app.delete('/api/assets/:id', (req, res) => {
  const data = readData();
  // Find by assetNo (new unique field)
  const idx = data.assets.findIndex(a => a.assetNo === req.params.id || a.id === req.params.id);
  if (idx !== -1) {
    const removed = data.assets.splice(idx, 1);
    writeData(data);
    io.emit('assets-updated');
    res.json({ success: true, removed: removed[0] });
  } else {
    res.status(404).json({ error: 'Asset not found' });
  }
});

// Generate and send OTP
app.post('/api/request-otp', async (req, res) => {
  const { email } = req.body;
  if (!email) return res.status(400).json({ error: 'Email required' });
  
  const otp = Math.floor(100000 + Math.random() * 900000).toString();
  const expiresAt = Date.now() + 5 * 60 * 1000; // 5 minutes
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
});

// Verify OTP
app.post('/api/verify-otp', (req, res) => {
  const { email, otp } = req.body;
  if (!email || !otp) return res.status(400).json({ error: 'Email and OTP required' });
  const record = otpStore[email.toLowerCase()];
  if (!record) return res.status(400).json({ error: 'No OTP requested for this email' });
  if (Date.now() > record.expiresAt) {
    delete otpStore[email.toLowerCase()];
    return res.status(400).json({ error: 'OTP expired' });
  }
  if (record.otp !== otp) return res.status(400).json({ error: 'Invalid OTP' });
  // OTP valid, create session and delete OTP
  delete otpStore[email.toLowerCase()];
  clientSessions[email.toLowerCase()] = {
    verifiedAt: Date.now(),
    expiresAt: Date.now() + 24 * 60 * 60 * 1000 // 1 day
  };
  res.json({ success: true });
});

io.on('connection', (socket) => {
  // No-op, just keep the connection open
});

http.listen(PORT, () => {
  console.log(`Server running at http://localhost:${PORT}`);
});
try {
  http.listen(PORT2, () => {
    console.log(`Server also running at http://localhost:${PORT2}`);
  });
} catch (err) {
  console.error('Could not bind to port 80 (try running with sudo):', err.message);
} 