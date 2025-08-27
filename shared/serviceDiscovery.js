import consul from 'consul';
import { createServiceLogger } from './logger.js';

const logger = createServiceLogger('service-discovery');

class ServiceDiscovery {
  constructor() {
    this.consul = null;
    this.services = new Map(); // Fallback in-memory registry
    this.useConsul = false;
    this.init();
  }

  async init() {
    try {
      // Try to connect to Consul
      this.consul = consul({
        host: process.env.CONSUL_HOST || 'localhost',
        port: process.env.CONSUL_PORT || 8500,
        promisify: true
      });
      
      // Test connection
      await this.consul.agent.self();
      this.useConsul = true;
      logger.info('Connected to Consul for service discovery');
    } catch (error) {
      logger.warn('Consul not available, using in-memory service registry', { error: error.message });
      this.useConsul = false;
    }
  }

  async registerService(name, id, port, health = {}) {
    const service = {
      id,
      name,
      port,
      address: 'localhost',
      check: {
        http: `http://localhost:${port}/health`,
        interval: '10s',
        timeout: '5s',
        ...health
      }
    };

    if (this.useConsul) {
      try {
        await this.consul.agent.service.register(service);
        logger.info('Service registered with Consul', { service: name, id, port });
      } catch (error) {
        logger.error('Failed to register service with Consul', { error: error.message });
        this.fallbackRegister(name, id, port);
      }
    } else {
      this.fallbackRegister(name, id, port);
    }
  }

  fallbackRegister(name, id, port) {
    if (!this.services.has(name)) {
      this.services.set(name, []);
    }
    
    const instances = this.services.get(name);
    const existingIndex = instances.findIndex(instance => instance.id === id);
    
    const serviceInstance = {
      id,
      address: 'localhost',
      port,
      healthy: true,
      lastCheck: new Date()
    };

    if (existingIndex >= 0) {
      instances[existingIndex] = serviceInstance;
    } else {
      instances.push(serviceInstance);
    }

    logger.info('Service registered in fallback registry', { service: name, id, port });
  }

  async discoverServices(serviceName) {
    if (this.useConsul) {
      try {
        const services = await this.consul.health.service({
          service: serviceName,
          passing: true
        });
        
        return services.map(service => ({
          id: service.Service.ID,
          address: service.Service.Address,
          port: service.Service.Port,
          healthy: true
        }));
      } catch (error) {
        logger.error('Failed to discover services from Consul', { error: error.message });
        return this.fallbackDiscover(serviceName);
      }
    } else {
      return this.fallbackDiscover(serviceName);
    }
  }

  fallbackDiscover(serviceName) {
    const instances = this.services.get(serviceName) || [];
    return instances.filter(instance => instance.healthy);
  }

  async deregisterService(id) {
    if (this.useConsul) {
      try {
        await this.consul.agent.service.deregister(id);
        logger.info('Service deregistered from Consul', { id });
      } catch (error) {
        logger.error('Failed to deregister service from Consul', { error: error.message });
      }
    }

    // Also remove from fallback registry
    for (const [serviceName, instances] of this.services.entries()) {
      const index = instances.findIndex(instance => instance.id === id);
      if (index >= 0) {
        instances.splice(index, 1);
        logger.info('Service deregistered from fallback registry', { id });
        break;
      }
    }
  }

  async healthCheck() {
    if (!this.useConsul) {
      // Perform health checks for fallback registry
      for (const [serviceName, instances] of this.services.entries()) {
        for (const instance of instances) {
          try {
            const response = await fetch(`http://${instance.address}:${instance.port}/health`);
            instance.healthy = response.ok;
            instance.lastCheck = new Date();
          } catch (error) {
            instance.healthy = false;
            instance.lastCheck = new Date();
            logger.warn('Health check failed', { 
              service: serviceName, 
              instance: instance.id, 
              error: error.message 
            });
          }
        }
      }
    }
  }

  // Start periodic health checks for fallback mode
  startHealthChecks() {
    if (!this.useConsul) {
      setInterval(() => {
        this.healthCheck();
      }, 10000); // Every 10 seconds
    }
  }
}

export default new ServiceDiscovery();