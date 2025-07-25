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

app.use(express.json());
app.use(express.static(__dirname)); // Serve static files (html.html, etc.)

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