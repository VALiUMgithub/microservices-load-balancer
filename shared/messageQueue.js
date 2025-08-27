import Bull from 'bull';
import Redis from 'ioredis';
import { createServiceLogger } from './logger.js';

const logger = createServiceLogger('message-queue');

class MessageQueueManager {
  constructor() {
    this.redis = null;
    this.queues = new Map();
    this.useRedis = false;
    this.fallbackQueue = new Map(); // In-memory fallback
    this.init();
  }

  async init() {
    try {
      // Try to connect to Redis
      this.redis = new Redis(process.env.QUEUE_REDIS_URL || 'redis://localhost:6379');
      
      this.redis.on('connect', () => {
        this.useRedis = true;
        logger.info('Connected to Redis for message queuing');
      });

      this.redis.on('error', (error) => {
        logger.warn('Redis connection failed, using in-memory queue', { error: error.message });
        this.useRedis = false;
      });

      // Test connection
      await this.redis.ping();
    } catch (error) {
      logger.warn('Redis not available, using in-memory message queue', { error: error.message });
      this.useRedis = false;
    }
  }

  createQueue(name, options = {}) {
    if (this.useRedis) {
      const queue = new Bull(name, {
        redis: {
          port: 6379,
          host: 'localhost'
        },
        ...options
      });

      queue.on('error', (error) => {
        logger.error('Queue error', { queue: name, error: error.message });
      });

      queue.on('completed', (job) => {
        logger.info('Job completed', { queue: name, jobId: job.id });
      });

      queue.on('failed', (job, error) => {
        logger.error('Job failed', { queue: name, jobId: job.id, error: error.message });
      });

      this.queues.set(name, queue);
      logger.info('Queue created with Redis', { queue: name });
      return queue;
    } else {
      // Fallback in-memory queue
      const fallbackQueue = {
        jobs: [],
        processors: [],
        
        add: async (jobName, data, options = {}) => {
          const job = {
            id: Date.now() + Math.random(),
            name: jobName,
            data,
            options,
            createdAt: new Date(),
            status: 'waiting'
          };
          
          this.fallbackQueue.jobs.push(job);
          logger.info('Job added to fallback queue', { queue: name, jobId: job.id });
          
          // Process immediately in fallback mode
          setTimeout(() => this.processFallbackJob(name, job), 0);
          
          return job;
        },
        
        process: (processor) => {
          if (!this.fallbackQueue.processors) {
            this.fallbackQueue.processors = [];
          }
          this.fallbackQueue.processors.push(processor);
        }
      };

      this.queues.set(name, fallbackQueue);
      logger.info('Queue created with in-memory fallback', { queue: name });
      return fallbackQueue;
    }
  }

  async processFallbackJob(queueName, job) {
    const queue = this.queues.get(queueName);
    if (queue && queue.processors) {
      for (const processor of queue.processors) {
        try {
          job.status = 'processing';
          await processor(job);
          job.status = 'completed';
          logger.info('Fallback job completed', { queue: queueName, jobId: job.id });
        } catch (error) {
          job.status = 'failed';
          job.error = error.message;
          logger.error('Fallback job failed', { queue: queueName, jobId: job.id, error: error.message });
        }
      }
    }
  }

  getQueue(name) {
    return this.queues.get(name);
  }

  async publishEvent(eventName, data) {
    const eventQueue = this.getQueue('events') || this.createQueue('events');
    
    try {
      await eventQueue.add(eventName, {
        event: eventName,
        data,
        timestamp: new Date().toISOString(),
        source: process.env.SERVICE_NAME || 'unknown'
      });
      
      logger.info('Event published', { event: eventName, data });
    } catch (error) {
      logger.error('Failed to publish event', { event: eventName, error: error.message });
    }
  }

  subscribeToEvents(eventName, handler) {
    const eventQueue = this.getQueue('events') || this.createQueue('events');
    
    eventQueue.process(eventName, async (job) => {
      try {
        await handler(job.data);
        logger.info('Event processed', { event: eventName });
      } catch (error) {
        logger.error('Event processing failed', { event: eventName, error: error.message });
        throw error;
      }
    });
  }

  async close() {
    for (const [name, queue] of this.queues.entries()) {
      if (queue.close) {
        await queue.close();
      }
    }
    
    if (this.redis) {
      await this.redis.quit();
    }
  }
}

export default new MessageQueueManager();