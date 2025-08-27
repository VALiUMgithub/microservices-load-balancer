import React, { useState, useEffect } from 'react';
import { Database, MessageSquare, Shield, Activity, Server, Clock } from 'lucide-react';

interface ProductionFeaturesProps {
  stats: any;
}

export function ProductionFeatures({ stats }: ProductionFeaturesProps) {
  const [logs, setLogs] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(false);

  const fetchLogs = async () => {
    setIsLoading(true);
    try {
      // In a real app, this would fetch from a centralized logging service
      const response = await fetch('http://localhost:3001/api/gateway/logs');
      if (response.ok) {
        const data = await response.json();
        setLogs(data.logs || []);
      }
    } catch (error) {
      console.error('Failed to fetch logs:', error);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchLogs();
    const interval = setInterval(fetchLogs, 10000); // Refresh every 10 seconds
    return () => clearInterval(interval);
  }, []);

  const getFeatureStatus = (feature: string) => {
    switch (feature) {
      case 'database':
        return { status: 'active', color: 'green', description: 'SQLite per service' };
      case 'serviceDiscovery':
        return { 
          status: stats?.serviceDiscovery === 'consul' ? 'consul' : 'fallback', 
          color: stats?.serviceDiscovery === 'consul' ? 'blue' : 'yellow',
          description: stats?.serviceDiscovery === 'consul' ? 'Consul cluster' : 'In-memory registry'
        };
      case 'messageQueue':
        return { 
          status: stats?.messageQueue === 'redis' ? 'redis' : 'fallback', 
          color: stats?.messageQueue === 'redis' ? 'purple' : 'yellow',
          description: stats?.messageQueue === 'redis' ? 'Redis Bull queues' : 'In-memory queues'
        };
      case 'rateLimiting':
        return { status: 'active', color: 'orange', description: 'Express rate limiter' };
      case 'logging':
        return { status: 'active', color: 'indigo', description: 'Winston centralized' };
      default:
        return { status: 'unknown', color: 'gray', description: 'Unknown' };
    }
  };

  return (
    <div className="space-y-6">
      {/* Production Features Overview */}
      <div className="bg-white rounded-xl shadow-lg p-6 border border-gray-200">
        <div className="flex items-center space-x-3 mb-6">
          <Server className="h-6 w-6 text-blue-600" />
          <h2 className="text-2xl font-bold text-gray-900">Production Features</h2>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {/* Database Per Service */}
          <div className="border border-green-200 bg-green-50 rounded-lg p-4">
            <div className="flex items-center space-x-3 mb-3">
              <Database className="h-6 w-6 text-green-600" />
              <h3 className="font-semibold text-green-900">Database Per Service</h3>
            </div>
            <p className="text-sm text-green-700 mb-2">Each service has its own SQLite database</p>
            <div className="space-y-1 text-xs">
              <div className="flex justify-between">
                <span>User Service:</span>
                <span className="font-mono">users.db</span>
              </div>
              <div className="flex justify-between">
                <span>Product Service:</span>
                <span className="font-mono">products.db</span>
              </div>
              <div className="flex justify-between">
                <span>Order Service:</span>
                <span className="font-mono">orders.db</span>
              </div>
            </div>
          </div>

          {/* Service Discovery */}
          <div className={`border rounded-lg p-4 ${
            getFeatureStatus('serviceDiscovery').color === 'blue' 
              ? 'border-blue-200 bg-blue-50' 
              : 'border-yellow-200 bg-yellow-50'
          }`}>
            <div className="flex items-center space-x-3 mb-3">
              <Activity className={`h-6 w-6 ${
                getFeatureStatus('serviceDiscovery').color === 'blue' ? 'text-blue-600' : 'text-yellow-600'
              }`} />
              <h3 className={`font-semibold ${
                getFeatureStatus('serviceDiscovery').color === 'blue' ? 'text-blue-900' : 'text-yellow-900'
              }`}>Service Discovery</h3>
            </div>
            <p className={`text-sm mb-2 ${
              getFeatureStatus('serviceDiscovery').color === 'blue' ? 'text-blue-700' : 'text-yellow-700'
            }`}>
              {getFeatureStatus('serviceDiscovery').description}
            </p>
            <div className="text-xs">
              <span className={`px-2 py-1 rounded text-xs font-medium ${
                getFeatureStatus('serviceDiscovery').color === 'blue' 
                  ? 'bg-blue-100 text-blue-800' 
                  : 'bg-yellow-100 text-yellow-800'
              }`}>
                {getFeatureStatus('serviceDiscovery').status.toUpperCase()}
              </span>
            </div>
          </div>

          {/* Message Queues */}
          <div className={`border rounded-lg p-4 ${
            getFeatureStatus('messageQueue').color === 'purple' 
              ? 'border-purple-200 bg-purple-50' 
              : 'border-yellow-200 bg-yellow-50'
          }`}>
            <div className="flex items-center space-x-3 mb-3">
              <MessageSquare className={`h-6 w-6 ${
                getFeatureStatus('messageQueue').color === 'purple' ? 'text-purple-600' : 'text-yellow-600'
              }`} />
              <h3 className={`font-semibold ${
                getFeatureStatus('messageQueue').color === 'purple' ? 'text-purple-900' : 'text-yellow-900'
              }`}>Message Queues</h3>
            </div>
            <p className={`text-sm mb-2 ${
              getFeatureStatus('messageQueue').color === 'purple' ? 'text-purple-700' : 'text-yellow-700'
            }`}>
              {getFeatureStatus('messageQueue').description}
            </p>
            <div className="text-xs">
              <span className={`px-2 py-1 rounded text-xs font-medium ${
                getFeatureStatus('messageQueue').color === 'purple' 
                  ? 'bg-purple-100 text-purple-800' 
                  : 'bg-yellow-100 text-yellow-800'
              }`}>
                {getFeatureStatus('messageQueue').status.toUpperCase()}
              </span>
            </div>
          </div>

          {/* Rate Limiting */}
          <div className="border border-orange-200 bg-orange-50 rounded-lg p-4">
            <div className="flex items-center space-x-3 mb-3">
              <Shield className="h-6 w-6 text-orange-600" />
              <h3 className="font-semibold text-orange-900">Rate Limiting</h3>
            </div>
            <p className="text-sm text-orange-700 mb-2">API rate limiting per IP and service</p>
            <div className="space-y-1 text-xs">
              <div className="flex justify-between">
                <span>Gateway:</span>
                <span>200/min</span>
              </div>
              <div className="flex justify-between">
                <span>Services:</span>
                <span>100/min</span>
              </div>
            </div>
          </div>

          {/* Centralized Logging */}
          <div className="border border-indigo-200 bg-indigo-50 rounded-lg p-4">
            <div className="flex items-center space-x-3 mb-3">
              <Activity className="h-6 w-6 text-indigo-600" />
              <h3 className="font-semibold text-indigo-900">Centralized Logging</h3>
            </div>
            <p className="text-sm text-indigo-700 mb-2">Winston logger with structured logging</p>
            <div className="space-y-1 text-xs">
              <div className="flex justify-between">
                <span>Log Files:</span>
                <span>./logs/</span>
              </div>
              <div className="flex justify-between">
                <span>Format:</span>
                <span>JSON</span>
              </div>
            </div>
          </div>

          {/* Health Monitoring */}
          <div className="border border-green-200 bg-green-50 rounded-lg p-4">
            <div className="flex items-center space-x-3 mb-3">
              <Clock className="h-6 w-6 text-green-600" />
              <h3 className="font-semibold text-green-900">Health Monitoring</h3>
            </div>
            <p className="text-sm text-green-700 mb-2">Automated health checks every 10s</p>
            <div className="space-y-1 text-xs">
              <div className="flex justify-between">
                <span>Healthy Services:</span>
                <span className="font-semibold">
                  {stats?.services ? 
                    Object.values(stats.services).flat().filter((s: any) => s.healthy).length : 0}
                </span>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Infrastructure Setup Instructions */}
      <div className="bg-white rounded-xl shadow-lg p-6 border border-gray-200">
        <h3 className="text-xl font-bold text-gray-900 mb-4">Infrastructure Setup</h3>
        
        <div className="space-y-4">
          <div className="bg-gray-50 rounded-lg p-4">
            <h4 className="font-semibold text-gray-900 mb-2">Optional: Install Consul (Service Discovery)</h4>
            <div className="bg-gray-800 text-green-400 p-3 rounded font-mono text-sm">
              <div># macOS</div>
              <div>brew install consul</div>
              <div className="mt-2"># Ubuntu/Debian</div>
              <div>sudo apt-get install consul</div>
              <div className="mt-2"># Start Consul</div>
              <div>consul agent -dev -ui -client=0.0.0.0</div>
            </div>
          </div>

          <div className="bg-gray-50 rounded-lg p-4">
            <h4 className="font-semibold text-gray-900 mb-2">Optional: Install Redis (Message Queues)</h4>
            <div className="bg-gray-800 text-green-400 p-3 rounded font-mono text-sm">
              <div># macOS</div>
              <div>brew install redis</div>
              <div className="mt-2"># Ubuntu/Debian</div>
              <div>sudo apt-get install redis-server</div>
              <div className="mt-2"># Start Redis</div>
              <div>redis-server --port 6379</div>
            </div>
          </div>

          <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
            <p className="text-blue-800 text-sm">
              <strong>Note:</strong> The application works without Consul and Redis installed. 
              It will automatically fall back to in-memory alternatives with full functionality.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}