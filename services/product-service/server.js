import express from 'express';
import cors from 'cors';

const app = express();
const PORT = 3004;
const INSTANCE_ID = `product-service-${PORT}`;

app.use(cors());
app.use(express.json());

// In-memory product store
let products = [
  { id: 1, name: 'Laptop', price: 999.99, category: 'Electronics', stock: 50 },
  { id: 2, name: 'Smartphone', price: 599.99, category: 'Electronics', stock: 100 },
  { id: 3, name: 'Coffee Maker', price: 79.99, category: 'Appliances', stock: 25 },
  { id: 4, name: 'Desk Chair', price: 199.99, category: 'Furniture', stock: 30 }
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

// Get all products
app.get('/api/products', (req, res) => {
  res.json({
    data: products,
    service: INSTANCE_ID,
    timestamp: new Date().toISOString()
  });
});

// Get product by ID
app.get('/api/products/:id', (req, res) => {
  const product = products.find(p => p.id === parseInt(req.params.id));
  if (!product) {
    return res.status(404).json({ error: 'Product not found' });
  }
  res.json({
    data: product,
    service: INSTANCE_ID,
    timestamp: new Date().toISOString()
  });
});

// Create product
app.post('/api/products', (req, res) => {
  const { name, price, category, stock } = req.body;
  
  if (!name || !price || !category) {
    return res.status(400).json({ error: 'Name, price, and category are required' });
  }
  
  const newProduct = {
    id: products.length + 1,
    name,
    price: parseFloat(price),
    category,
    stock: parseInt(stock) || 0
  };
  
  products.push(newProduct);
  
  res.status(201).json({
    data: newProduct,
    service: INSTANCE_ID,
    timestamp: new Date().toISOString()
  });
});

app.listen(PORT, () => {
  console.log(`📦 ${INSTANCE_ID} running on port ${PORT}`);
});