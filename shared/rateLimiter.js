import rateLimit from 'express-rate-limit';
import Redis from 'ioredis';
import { createServiceLogger } from './logger.js';

const logger = createServiceLogger('rate-limiter');

class RateLimiterManager {
  constructor() {
    this.redis = null;
    this.useRedis = false;
    this.init();
  }

  async init() {
    try {
      this.redis = new Redis(process.env.REDIS_URL || 'redis://localhost:6379');
      
      this.redis.on('connect', () => {
        this.useRedis = true;
        logger.info('Connected to Redis for rate limiting');
      });

      this.redis.on('error', (error) => {
        logger.warn('Redis connection failed, using in-memory rate limiting', { error: error.message });
        this.useRedis = false;
      });

      await this.redis.ping();
    } catch (error) {
      logger.warn('Redis not available, using in-memory rate limiting', { error: error.message });
      this.useRedis = false;
    }
  }

  createLimiter(options = {}) {
    const defaultOptions = {
      windowMs: parseInt(process.env.RATE_LIMIT_WINDOW_MS) || 60000, // 1 minute
      max: parseInt(process.env.RATE_LIMIT_MAX_REQUESTS) || 100, // 100 requests per window
      message: {
        error: 'Too many requests, please try again later.',
        retryAfter: Math.ceil(options.windowMs / 1000) || 60
      },
      standardHeaders: true,
      legacyHeaders: false,
      handler: (req, res) => {
        logger.warn('Rate limit exceeded', {
          ip: req.ip,
          userAgent: req.headers['user-agent'],
          url: req.url,
          method: req.method
        });
        
        res.status(429).json({
          error: 'Too many requests',
          message: 'Rate limit exceeded. Please try again later.',
          retryAfter: Math.ceil((options.windowMs || 60000) / 1000)
        });
      },
      ...options
    };

    if (this.useRedis) {
      // Redis-based distributed rate limiting
      defaultOptions.store = {
        incr: async (key) => {
          const current = await this.redis.incr(key);
          if (current === 1) {
            await this.redis.expire(key, Math.ceil(defaultOptions.windowMs / 1000));
          }
          return { totalHits: current, resetTime: new Date(Date.now() + defaultOptions.windowMs) };
        },
        decrement: async (key) => {
          const current = await this.redis.decr(key);
          return { totalHits: Math.max(0, current) };
        },
        resetKey: async (key) => {
          await this.redis.del(key);
        }
      };
    }

    return rateLimit(defaultOptions);
  }

  // Service-specific rate limiters
  createServiceLimiter(serviceName, options = {}) {
    return this.createLimiter({
      ...options,
      keyGenerator: (req) => `${serviceName}:${req.ip}`,
      skip: (req) => {
        // Skip rate limiting for health checks
        return req.path === '/health';
      }
    });
  }

  // API Gateway rate limiter (more restrictive)
  createGatewayLimiter() {
    return this.createLimiter({
      windowMs: 60000, // 1 minute
      max: 200, // 200 requests per minute per IP
      keyGenerator: (req) => `gateway:${req.ip}`,
      skip: (req) => {
        return req.path === '/health' || req.path === '/api/gateway/stats';
      }
    });
  }

  // Per-user rate limiter (requires authentication)
  createUserLimiter() {
    return this.createLimiter({
      windowMs: 60000,
      max: 1000, // Higher limit for authenticated users
      keyGenerator: (req) => {
        const userId = req.headers['x-user-id'] || req.ip;
        return `user:${userId}`;
      }
    });
  }
}

export default new RateLimiterManager();