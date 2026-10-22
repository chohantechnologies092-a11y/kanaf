const http = require('http');
const fs = require('fs');
const path = require('path');
const WebSocket = require('ws');
const WebSocketServer = WebSocket.Server;

const PORT = process.env.PORT || 5050;
const DATA_FILE = path.join(__dirname, 'server-data.json');

// Default initial state
const INITIAL_STATE = {
  tables: [
    { id: '1', zone: 'Main Hall', name: 'T-01', seats: 4, status: 'available' },
    { id: '2', zone: 'Main Hall', name: 'T-02', seats: 2, status: 'occupied', billTotal: 45.00, server: 'Junaid' },
    { id: '3', zone: 'Main Hall', name: 'T-03', seats: 4, status: 'available' },
    { id: '4', zone: 'Rooftop', name: 'R-01', seats: 4, status: 'available' },
    { id: '5', zone: 'VIP', name: 'V-01', seats: 8, status: 'reserved' },
  ],
  tickets: [
    {
      id: 'KOT-1042',
      tableId: '2',
      tableName: 'T-02',
      server: 'Junaid',
      timePlaced: Date.now() - 12 * 60000,
      status: 'cooking',
      items: [
        { id: 'm1', name: 'Sultan Kebab', price: 1450, qty: 2, completed: false },
      ]
    }
  ],
  invoices: [],
  customers: [
    { id: 'c1', name: 'Zubair Tariq', phone: '03009876543', address: 'DHA Phase 5, Lahore', totalOrders: 14, totalSpent: 38400 },
    { id: 'c2', name: 'Fatima Noor', phone: '03214567890', address: 'Gulberg III, Lahore', totalOrders: 6, totalSpent: 16200 },
    { id: 'c3', name: 'Bilal Siddiqui', phone: '03331122334', address: 'Model Town, Block C', totalOrders: 3, totalSpent: 7500 },
  ],
  menuItems: [
    { id: 'm1', name: 'Sultan Kebab', price: 1450, category: 'Mains' },
    { id: 'm2', name: 'Chicken Karahi', price: 1850, category: 'Mains' },
    { id: 'm3', name: 'Hummus & Pita', price: 650, category: 'Appetizers' },
    { id: 'm4', name: 'Kunafa', price: 850, category: 'Desserts' },
    { id: 'm5', name: 'Mint Margarita', price: 450, category: 'Drinks' },
  ],
  categories: ['Appetizers', 'Mains', 'Desserts', 'Drinks'],
  zones: ['Main Hall', 'Rooftop', 'VIP'],
  staff: [
    { id: 'st1', name: 'Junaid Ahsan', phone: '+92 300 1234567', role: 'Admin', pin: '1122', status: 'Active', shift: 'Morning', joinedDate: '2025-01-15' },
    { id: 'st2', name: 'Ali Khan', phone: '+92 301 7654321', role: 'Manager', pin: '2233', status: 'Active', shift: 'Morning', joinedDate: '2025-02-01' },
    { id: 'st3', name: 'Chef Omar', phone: '+92 302 9876543', role: 'Kitchen', pin: '3344', status: 'Active', shift: 'Evening', joinedDate: '2025-03-10' },
    { id: 'st4', name: 'Sara Ahmed', phone: '+92 303 5556677', role: 'Waiter', pin: '4455', status: 'Active', shift: 'Evening', joinedDate: '2025-04-05', assignedZone: 'Ground Floor', assignedZones: ['Ground Floor'] },
    { id: 'st5', name: 'Hamza Malik', phone: '+92 304 4443322', role: 'Waiter', pin: '5566', status: 'On Leave', shift: 'Night', joinedDate: '2025-05-12', assignedZone: '1st Floor', assignedZones: ['1st Floor'] },
  ],
  reservations: [
    {
      id: 'res-1',
      tableId: '5',
      tableName: 'V-01',
      customerName: 'Hamza Malik',
      phone: '03219988776',
      guestsCount: 6,
      reservationDate: new Date().toISOString().split('T')[0],
      timeSlot: '08:30 PM',
      status: 'confirmed',
      notes: 'Birthday celebration, requested quiet corner',
      createdAt: Date.now() - 3600000,
    }
  ],
  assets: [],
  damageRecords: []
};

// Load or create state
let serverState = { ...INITIAL_STATE };
try {
  if (fs.existsSync(DATA_FILE)) {
    const raw = fs.readFileSync(DATA_FILE, 'utf8');
    serverState = { ...INITIAL_STATE, ...JSON.parse(raw) };
    console.log('[Kanaf Hub] Loaded saved database from server-data.json');
  } else {
    fs.writeFileSync(DATA_FILE, JSON.stringify(INITIAL_STATE, null, 2));
    console.log('[Kanaf Hub] Created initial server-data.json');
  }
} catch (err) {
  console.error('[Kanaf Hub] Error loading server-data.json:', err.message);
}

// Debounced file save to avoid disk spam
let saveTimer = null;
function persistState() {
  if (saveTimer) clearTimeout(saveTimer);
  saveTimer = setTimeout(() => {
    try {
      fs.writeFileSync(DATA_FILE, JSON.stringify(serverState, null, 2));
    } catch (e) {
      console.error('[Kanaf Hub] Failed to save state to disk:', e.message);
    }
  }, 1000);
}

// Create HTTP server
const server = http.createServer((req, res) => {
  // Enable CORS for all devices and web ports
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    res.writeHead(204);
    res.end();
    return;
  }

  const url = new URL(req.url, `http://${req.headers.host}`);

  if (url.pathname === '/' || url.pathname === '/health' || url.pathname === '/api/status') {
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({
      status: 'online',
      server: 'Kanaf Central POS Hub',
      clientsCount: wss ? wss.clients.size : 0,
      timestamp: Date.now()
    }));
    return;
  }

  if (url.pathname === '/api/sync' && req.method === 'GET') {
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify(serverState));
    return;
  }

  if (url.pathname === '/api/sync' && req.method === 'POST') {
    let body = '';
    req.on('data', chunk => { body += chunk; });
    req.on('end', () => {
      try {
        const data = JSON.parse(body);
        if (data.state) {
          applyStateUpdate(data.state, data.senderId);
        }
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ success: true, timestamp: Date.now() }));
      } catch (err) {
        res.writeHead(400, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: err.message }));
      }
    });
    return;
  }

  res.writeHead(404, { 'Content-Type': 'text/plain' });
  res.end('Sultan Restaurant Sync Hub');
});

// Create WebSocket Server on the same HTTP server
const wss = new WebSocketServer({ server });

function broadcastToClients(msgObj, excludeWs = null) {
  const payload = JSON.stringify(msgObj);
  for (const client of wss.clients) {
    if (client !== excludeWs && client.readyState === WebSocket.OPEN) {
      client.send(payload);
    }
  }
}

function applyStateUpdate(partialState, senderId, originWs = null) {
  if (!partialState || typeof partialState !== 'object') return;

  // Merge state keys safely
  const allowedKeys = ['tables', 'tickets', 'invoices', 'menuItems', 'categories', 'zones', 'staff', 'customers', 'reservations', 'lastBillPaidAlert', 'serviceRequests', 'inventory', 'stockMovements', 'expenses', 'feedback', 'unavailableItemIds', 'suppliers', 'purchaseOrders', 'supplierPayments', 'recipes', 'kitchenSessions', 'kitchenConsumption', 'kitchenManualUsage', 'kitchenCash', 'kitchenSettings', 'assets', 'damageRecords'];
  let modified = false;

  for (const key of allowedKeys) {
    if (partialState[key] !== undefined) {
      if (key === 'tickets') {
        const incomingTickets = Array.isArray(partialState.tickets) ? partialState.tickets : [];
        // Preserve served status against stale downgrades
        let mergedTickets = incomingTickets.map(inc => {
          const existing = (serverState.tickets || []).find(et => et.id === inc.id);
          if (existing && existing.status === 'served' && inc.status !== 'served') {
            return existing;
          }
          return inc;
        });

        const currentTables = partialState.tables || serverState.tables || [];
        const hasOccupiedTables = currentTables.some(t => (t.status === 'occupied' || t.status === 'billed') && (t.billTotal || 0) > 0);

        if (mergedTickets.length > 0 || !hasOccupiedTables) {
          serverState.tickets = mergedTickets;
        } else {
          // Guard: incoming tickets is empty, but tables are occupied!
          const occupiedIds = new Set(currentTables.filter(t => t.status === 'occupied' || t.status === 'billed').map(t => t.id));
          const existingActive = (serverState.tickets || []).filter(t => occupiedIds.has(t.tableId));
          serverState.tickets = existingActive.length > 0 ? existingActive : mergedTickets;
        }
        modified = true;
      } else {
        serverState[key] = partialState[key];
        modified = true;
      }
    }
  }

  if (modified) {
    persistState();
    // Broadcast to all other connected devices!
    broadcastToClients({
      type: 'SERVER_BROADCAST',
      state: serverState,
      senderId: senderId || 'SERVER',
      timestamp: Date.now()
    }, originWs);
  }
}

wss.on('connection', (ws, req) => {
  const remoteIp = req.socket.remoteAddress;
  console.log(`[Sultan Hub] New device connected from ${remoteIp}. Total devices: ${wss.clients.size}`);

  // Send full current state immediately to newly connected device
  ws.send(JSON.stringify({
    type: 'INIT_STATE',
    state: serverState,
    senderId: 'SERVER',
    timestamp: Date.now()
  }));

  ws.on('message', (message) => {
    try {
      const data = JSON.parse(message.toString());
      if (data.type === 'CLIENT_UPDATE' && data.state) {
        applyStateUpdate(data.state, data.senderId, ws);
      } else if (data.type === 'PING') {
        ws.send(JSON.stringify({ type: 'PONG', timestamp: Date.now() }));
      }
    } catch (e) {
      console.error('[Kanaf Hub] Bad WS message:', e.message);
    }
  });

  ws.on('close', () => {
    console.log(`[Kanaf Hub] Device disconnected. Total active: ${wss.clients.size}`);
  });

  ws.on('error', (err) => {
    console.error('[Kanaf Hub] WS socket error:', err.message);
  });
});

server.listen(PORT, '0.0.0.0', () => {
  console.log(`=================================================`);
  console.log(`🏰 KANAF CAFE & BAKERY CENTRAL POS HUB ONLINE`);
  console.log(`📡 Port: ${PORT} (All network interfaces 0.0.0.0)`);
  console.log(`🌐 Local Wi-Fi Sync Address: ws://192.168.1.16:${PORT}`);
  console.log(`📱 Connect your Mobile, Tablet & PC to this hub`);
  console.log(`=================================================`);
});
