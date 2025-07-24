const express = require('express');
const fs = require('fs');
const path = require('path');
const app = express();
const http = require('http').createServer(app);
const io = require('socket.io')(http);
const PORT = 3000;
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
  data.tickets.unshift(ticket);
  writeData(data);
  io.emit('tickets-updated');
  res.json(ticket);
});
app.put('/api/tickets/:id', (req, res) => {
  const data = readData();
  const idx = data.tickets.findIndex(t => t.id === req.params.id);
  if (idx !== -1) {
    data.tickets[idx] = req.body;
    writeData(data);
    io.emit('tickets-updated');
    res.json(data.tickets[idx]);
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
  data.assets.unshift(asset);
  writeData(data);
  io.emit('assets-updated');
  res.json(asset);
});
app.put('/api/assets/:id', (req, res) => {
  const data = readData();
  const idx = data.assets.findIndex(a => a.id === req.params.id);
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
  const idx = data.assets.findIndex(a => a.id === req.params.id);
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