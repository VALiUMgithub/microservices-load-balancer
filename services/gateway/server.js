import express from 'express';
import cors from 'cors';
import axios from 'axios';
import dotenv from 'dotenv';
import { createServiceLogger } from '../../shared/logger.js';
import serviceDiscovery from '../../shared/serviceDiscovery.js';
import messageQueue from '../../shared/messageQueue.js';
import rateLimiter from '../../shared/rateLimiter.js';

dotenv.config();

const app = express();
const PORT = 3001;
const logger = createServiceLogger('api-gateway');

// Middleware
app.use(cors());
app.use(express.json());
app.use(logger.requestMiddleware);

// Rate limiting
app.use(rateLimiter.createGatewayLimiter());

// Dynamic service registry
const serviceRegistry = new Map();
const requestCounts = new Map();

let currentIndex = {
  user: 0,
  product: 0,
  order: 0
};

// Initialize message queues
const eventQueue = messageQueue.createQueue('events');
const auditQueue = messageQueue.createQueue('audit');

// Subscribe to service events
messageQueue.subscribeToEvents('service.registered', async (data) => {
  logger.info('Service registered event received', data);
});

messageQueue.subscribeToEvents('service.deregistered', async (data) => {
  logger.info('Service deregistered event received', data);
});

// Round-robin load balancer
async function getNextService(serviceName) {
  // Try service discovery first
  const discoveredServices = await serviceDiscovery.discoverServices(serviceName);
  if (discoveredServices.length > 0) {
    return selectFromDiscoveredServices(serviceName, discoveredServices);
  }
  
  // Fallback to static registry
  const services = serviceRegistry[serviceName];
  const healthyServices = services.filter(service => service.healthy);
  
  if (healthyServices.length === 0) {
    throw new Error(`No healthy ${serviceName} services available`);
  }
  
  // Round-robin selection
  const service = healthyServices[currentIndex[serviceName] % healthyServices.length];
  currentIndex[serviceName] = (currentIndex[serviceName] + 1) % healthyServices.length;
  
  return service;
}

function selectFromDiscoveredServices(serviceName, services) {
  if (services.length === 0) {
    throw new Error(`No healthy ${serviceName} services available`);
  }
  
  const service = services[currentIndex[serviceName] % services.length];
  currentIndex[serviceName] = (currentIndex[serviceName] + 1) % services.length;
  
  // Track requests
  const serviceKey = `${service.address}:${service.port}`;
  const currentCount = requestCounts.get(serviceKey) || 0;
  requestCounts.set(serviceKey, currentCount + 1);
  
  return {
    url: `http://${service.address}:${service.port}`,
    healthy: service.healthy,
    requests: requestCounts.get(serviceKey)
  };
}

// Health check function
async function checkServiceHealth(service) {
  try {
    const response = await axios.get(`${service.url}/health`, { timeout: 5000 });
    return response.status === 200;
  } catch (error) {
    return false;
  }
}

// Proxy request with retry logic
async function proxyRequest(req, res, serviceName) {
  let attempts = 0;
  const maxAttempts = 3;
  const startTime = Date.now();
  
  while (attempts < maxAttempts) {
    try {
      const service = await getNextService(serviceName);
      service.requests++;
      
      const config = {
        method: req.method,
        url: `${service.url}${req.path}`,
        data: req.body,
        headers: { ...req.headers, host: undefined },
        timeout: 10000
      };
      
      logger.info('Proxying request', {
        method: req.method,
        path: req.path,
        target: service.url,
        attempt: attempts + 1,
        requestId: req.requestId
      });
      
      // Publish audit event
      await messageQueue.publishEvent('request.proxied', {
        method: req.method,
        path: req.path,
        target: service.url,
        requestId: req.requestId,
        timestamp: new Date().toISOString()
      });
      
      const response = await axios(config);
      
      const duration = Date.now() - startTime;
      logger.info('Request completed successfully', {
        method: req.method,
        path: req.path,
        target: service.url,
        statusCode: response.status,
        duration: `${duration}ms`,
        requestId: req.requestId
      });
      
      return res.status(response.status).json(response.data);
      
    } catch (error) {
      attempts++;
      logger.error('Request attempt failed', {
        serviceName,
        attempt: attempts,
        error: error.message,
        requestId: req.requestId
      });
      
      if (attempts === maxAttempts) {
        const duration = Date.now() - startTime;
        logger.error('Request failed after all attempts', {
          serviceName,
          maxAttempts,
          duration: `${duration}ms`,
          requestId: req.requestId
        });
        
        return res.status(500).json({
          error: `Service ${serviceName} unavailable after ${maxAttempts} attempts`,
          message: error.message,
          requestId: req.requestId
        });
      }
    }
  }
}

// API routes
app.all('/api/users*', (req, res) => proxyRequest(req, res, 'user'));
app.all('/api/products*', (req, res) => proxyRequest(req, res, 'product'));
app.all('/api/orders*', (req, res) => proxyRequest(req, res, 'order'));

// Gateway health and stats
app.get('/health', (req, res) => {
  const healthData = {
    status: 'healthy',
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
    memory: process.memoryUsage()
  };
  
  logger.debug('Health check requested', healthData);
  res.json({ status: 'healthy', timestamp: new Date().toISOString() });
});

app.get('/api/gateway/stats', (req, res) => {
  const discoveredServices = {};
  
  // Get stats from service discovery
  Promise.all([
    serviceDiscovery.discoverServices('user'),
    serviceDiscovery.discoverServices('product'),
    serviceDiscovery.discoverServices('order')
  ]).then(([userServices, productServices, orderServices]) => {
    discoveredServices.user = userServices.map(s => ({
      url: `http://${s.address}:${s.port}`,
      healthy: s.healthy,
      requests: requestCounts.get(`${s.address}:${s.port}`) || 0
    }));
    
    discoveredServices.product = productServices.map(s => ({
      url: `http://${s.address}:${s.port}`,
      healthy: s.healthy,
      requests: requestCounts.get(`${s.address}:${s.port}`) || 0
    }));
    
    discoveredServices.order = orderServices.map(s => ({
      url: `http://${s.address}:${s.port}`,
      healthy: s.healthy,
      requests: requestCounts.get(`${s.address}:${s.port}`) || 0
    }));
  });
  
  const stats = {
    services: Object.keys(discoveredServices).length > 0 ? discoveredServices : serviceRegistry,
    currentIndex,
    timestamp: new Date().toISOString(),
    totalRequests: Array.from(requestCounts.values()).reduce((sum, count) => sum + count, 0),
    serviceDiscovery: serviceDiscovery.useConsul ? 'consul' : 'fallback',
    messageQueue: messageQueue.useRedis ? 'redis' : 'fallback'
  };
  
  res.json(stats);
});

// Register gateway with service discovery
async function registerGateway() {
  try {
    await serviceDiscovery.registerService(
      'api-gateway',
      `gateway-${PORT}`,
      PORT,
      {
        http: `http://localhost:${PORT}/health`,
        interval: '10s'
      }
    );
    
    logger.info('Gateway registered with service discovery');
  } catch (error) {
    logger.error('Failed to register gateway', { error: error.message });
  }
}

// Graceful shutdown
process.on('SIGTERM', async () => {
  logger.info('Received SIGTERM, shutting down gracefully');
  
  try {
    await serviceDiscovery.deregisterService(`gateway-${PORT}`);
    await messageQueue.close();
    process.exit(0);
  } catch (error) {
    logger.error('Error during shutdown', { error: error.message });
    process.exit(1);
  }
});

// Start server
app.listen(PORT, () => {
  logger.info('API Gateway started', {
    port: PORT,
    statsUrl: `http://localhost:${PORT}/api/gateway/stats`,
    healthUrl: `http://localhost:${PORT}/health`
  });
  
  // Register with service discovery
  setTimeout(registerGateway, 2000);
  
  // Start service discovery health checks
  serviceDiscovery.startHealthChecks();
});