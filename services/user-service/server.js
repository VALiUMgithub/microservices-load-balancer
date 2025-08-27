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
const PORT = process.env.PORT || 3002;
const INSTANCE_ID = `user-service-${PORT}`;
const logger = createServiceLogger(INSTANCE_ID);

// Initialize database
const db = new DatabaseManager('users');

app.use(cors());
app.use(express.json());
app.use(logger.requestMiddleware);
app.use(rateLimiter.createServiceLimiter('user-service'));

// Initialize database and seed data
async function initializeDatabase() {
  try {
    await db.connect();
    await db.run(schemas.users);
    
    // Seed initial data
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
    
    // Publish event
    await messageQueue.publishEvent('users.listed', {
      count: users.length,
      service: INSTANCE_ID,
      requestId: req.requestId
    });
    
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
      logger.warn('User not found', { userId: req.params.id, requestId: req.requestId });
      return res.status(404).json({ error: 'User not found' });
    }
    
    logger.info('User retrieved', { userId: user.id, requestId: req.requestId });
    
    res.json({
      data: user,
      service: INSTANCE_ID,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    logger.error('Failed to retrieve user', { 
      userId: req.params.id, 
      error: error.message, 
      requestId: req.requestId 
    });
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
    
    // Check if email already exists
    const existingUser = await db.get('SELECT id FROM users WHERE email = ?', [email]);
    if (existingUser) {
      return res.status(409).json({ error: 'Email already exists' });
    }
    
    const result = await db.run(
      'INSERT INTO users (name, email) VALUES (?, ?)',
      [name, email]
    );
    
    const newUser = await db.get('SELECT * FROM users WHERE id = ?', [result.id]);
    
    logger.info('User created', { userId: newUser.id, email, requestId: req.requestId });
    
    // Publish event
    await messageQueue.publishEvent('user.created', {
      userId: newUser.id,
      email,
      service: INSTANCE_ID,
      requestId: req.requestId
    });
    
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

// Update user
app.put('/api/users/:id', async (req, res) => {
  try {
    const { name, email } = req.body;
    const userId = req.params.id;
    
    // Check if user exists
    const existingUser = await db.get('SELECT * FROM users WHERE id = ?', [userId]);
    if (!existingUser) {
      return res.status(404).json({ error: 'User not found' });
    }
    
    // Update user
    await db.run(
      'UPDATE users SET name = COALESCE(?, name), email = COALESCE(?, email), updated_at = CURRENT_TIMESTAMP WHERE id = ?',
      [name, email, userId]
    );
    
    const updatedUser = await db.get('SELECT * FROM users WHERE id = ?', [userId]);
    
    logger.info('User updated', { userId, requestId: req.requestId });
    
    // Publish event
    await messageQueue.publishEvent('user.updated', {
      userId,
      changes: { name, email },
      service: INSTANCE_ID,
      requestId: req.requestId
    });
    
    res.json({
      data: updatedUser,
      service: INSTANCE_ID,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    logger.error('Failed to update user', { 
      userId: req.params.id, 
      error: error.message, 
      requestId: req.requestId 
    });
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Delete user
app.delete('/api/users/:id', async (req, res) => {
  try {
    const userId = req.params.id;
    
    // Check if user exists
    const existingUser = await db.get('SELECT * FROM users WHERE id = ?', [userId]);
    if (!existingUser) {
      return res.status(404).json({ error: 'User not found' });
    }
    
    await db.run('DELETE FROM users WHERE id = ?', [userId]);
    
    logger.info('User deleted', { userId, requestId: req.requestId });
    
    // Publish event
    await messageQueue.publishEvent('user.deleted', {
      userId,
      service: INSTANCE_ID,
      requestId: req.requestId
    });
    
    res.json({
      message: 'User deleted successfully',
      service: INSTANCE_ID,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    logger.error('Failed to delete user', { 
      userId: req.params.id, 
      error: error.message, 
      requestId: req.requestId 
    });
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
        database: `users.db`,
        healthUrl: `http://localhost:${PORT}/health`
      });
    });
    
    // Publish service started event
    await messageQueue.publishEvent('service.started', {
      service: 'user',
      instanceId: INSTANCE_ID,
      port: PORT
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
    await messageQueue.close();
    process.exit(0);
  } catch (error) {
    logger.error('Error during shutdown', { error: error.message });
    process.exit(1);
  }
});

startServer();