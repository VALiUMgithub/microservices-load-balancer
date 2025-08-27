import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import DatabaseManager, { schemas } from '../../shared/database.js';
import { createServiceLogger } from '../../shared/logger.js';
import serviceDiscovery from '../../shared/serviceDiscovery.js';
import messageQueue from '../../shared/messageQueue.js';
import rateLimiter from '../../shared/rateLimiter.js';

dotenv.config();

const app = express();
const PORT = 3003;
const INSTANCE_ID = `user-service-${PORT}`;
const logger = createServiceLogger(INSTANCE_ID);

// Initialize database (separate instance)
const db = new DatabaseManager(`users-${PORT}`);

app.use(cors());
app.use(express.json());
app.use(logger.requestMiddleware);
app.use(rateLimiter.createServiceLimiter('user-service'));

// Initialize database and seed data
async function initializeDatabase() {
  try {
    await db.connect();
    await db.run(schemas.users);
    
    // Seed initial data (same as instance 1 for consistency)
    const existingUsers = await db.all('SELECT COUNT(*) as count FROM users');
    if (existingUsers[0].count === 0) {
      const seedUsers = [
        { name: 'John Doe', email: 'john@example.com' },
        { name: 'Jane Smith', email: 'jane@example.com' },
        { name: 'Bob Johnson', email: 'bob@example.com' }
      ];
      
      for (const user of seedUsers) {
        await db.run(
          'INSERT INTO users (name, email) VALUES (?, ?)',
          [user.name, user.email]
        );
      }
      
      logger.info('Database seeded with initial users');
    }
  } catch (error) {
    logger.error('Database initialization failed', { error: error.message });
    process.exit(1);
  }
}

// Health check
app.get('/health', (req, res) => {
  res.json({
    status: 'healthy',
    service: INSTANCE_ID,
    timestamp: new Date().toISOString(),
    database: 'connected',
    uptime: process.uptime()
  });
});

// Get all users
app.get('/api/users', async (req, res) => {
  try {
    const users = await db.all('SELECT * FROM users ORDER BY created_at DESC');
    
    logger.info('Users retrieved', { count: users.length, requestId: req.requestId });
    
    res.json({
      data: users,
      service: INSTANCE_ID,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    logger.error('Failed to retrieve users', { error: error.message, requestId: req.requestId });
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Get user by ID
app.get('/api/users/:id', async (req, res) => {
  try {
    const user = await db.get('SELECT * FROM users WHERE id = ?', [req.params.id]);
    
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }
    
    res.json({
      data: user,
      service: INSTANCE_ID,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    logger.error('Failed to retrieve user', { error: error.message, requestId: req.requestId });
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Create user
app.post('/api/users', async (req, res) => {
  try {
    const { name, email } = req.body;
    
    if (!name || !email) {
      return res.status(400).json({ error: 'Name and email are required' });
    }
    
    const result = await db.run(
      'INSERT INTO users (name, email) VALUES (?, ?)',
      [name, email]
    );
    
    const newUser = await db.get('SELECT * FROM users WHERE id = ?', [result.id]);
    
    res.status(201).json({
      data: newUser,
      service: INSTANCE_ID,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    logger.error('Failed to create user', { error: error.message, requestId: req.requestId });
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Register service and start server
async function startServer() {
  try {
    await initializeDatabase();
    
    // Register with service discovery
    await serviceDiscovery.registerService(
      'user',
      INSTANCE_ID,
      PORT,
      {
        http: `http://localhost:${PORT}/health`,
        interval: '10s'
      }
    );
    
    app.listen(PORT, () => {
      logger.info('User service started', {
        port: PORT,
        instanceId: INSTANCE_ID,
        database: `users-${PORT}.db`,
        healthUrl: `http://localhost:${PORT}/health`
      });
    });
    
  } catch (error) {
    logger.error('Failed to start service', { error: error.message });
    process.exit(1);
  }
}

// Graceful shutdown
process.on('SIGTERM', async () => {
  logger.info('Received SIGTERM, shutting down gracefully');
  
  try {
    await serviceDiscovery.deregisterService(INSTANCE_ID);
    await db.close();
    process.exit(0);
  } catch (error) {
    logger.error('Error during shutdown', { error: error.message });
    process.exit(1);
  }
});

startServer();