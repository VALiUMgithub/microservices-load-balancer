import express from 'express';
import cors from 'cors';

const app = express();
const PORT = 3006;
const INSTANCE_ID = `order-service-${PORT}`;

app.use(cors());
app.use(express.json());

// In-memory order store
let orders = [
  {
    id: 1,
    userId: 1,
    items: [
      { productId: 1, quantity: 1, price: 999.99 }
    ],
    total: 999.99,
    status: 'completed',
    createdAt: new Date()
  },
  {
    id: 2,
    userId: 2,
    items: [
      { productId: 2, quantity: 2, price: 599.99 }
    ],
    total: 1199.98,
    status: 'pending',
    createdAt: new Date()
  }
];

let requestCount = 0;

// Middleware to log requests
app.use((req, res, next) => {
  requestCount++;
  console.log(`[${INSTANCE_ID}] ${req.method} ${req.path} - Request #${requestCount}`);
  next();
});

// Health check
app.get('/health', (req, res) => {
  res.json({
    status: 'healthy',
    service: INSTANCE_ID,
    timestamp: new Date().toISOString(),
    requests: requestCount
  });
});

// Get all orders
app.get('/api/orders', (req, res) => {
  res.json({
    data: orders,
    service: INSTANCE_ID,
    timestamp: new Date().toISOString()
  });
});

// Get order by ID
app.get('/api/orders/:id', (req, res) => {
  const order = orders.find(o => o.id === parseInt(req.params.id));
  if (!order) {
    return res.status(404).json({ error: 'Order not found' });
  }
  res.json({
    data: order,
    service: INSTANCE_ID,
    timestamp: new Date().toISOString()
  });
});

// Create order
app.post('/api/orders', (req, res) => {
  const { userId, items } = req.body;
  
  if (!userId || !items || !Array.isArray(items)) {
    return res.status(400).json({ error: 'User ID and items array are required' });
  }
  
  const total = items.reduce((sum, item) => sum + (item.price * item.quantity), 0);
  
  const newOrder = {
    id: orders.length + 1,
    userId: parseInt(userId),
    items,
    total: parseFloat(total.toFixed(2)),
    status: 'pending',
    createdAt: new Date()
  };
  
  orders.push(newOrder);
  
  res.status(201).json({
    data: newOrder,
    service: INSTANCE_ID,
    timestamp: new Date().toISOString()
  });
});

app.listen(PORT, () => {
  console.log(`🛒 ${INSTANCE_ID} running on port ${PORT}`);
});