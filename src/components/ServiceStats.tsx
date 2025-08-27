import React from 'react';
import { Server, CheckCircle, XCircle, TrendingUp } from 'lucide-react';

interface ServiceStatsProps {
  stats: any;
}

export function ServiceStats({ stats }: ServiceStatsProps) {
  const getServiceColor = (serviceName: string) => {
    const colors = {
      user: 'green',
      product: 'purple',
      order: 'orange'
    };
    return colors[serviceName as keyof typeof colors] || 'blue';
  };

  const getServiceIcon = (serviceName: string) => {
    const icons = {
      user: '👤',
      product: '📦',
      order: '🛒'
    };
    return icons[serviceName as keyof typeof icons] || '🔧';
  };

  return (
    <div className="mb-8">
      <div className="bg-white rounded-xl shadow-lg p-6 border border-gray-200">
        <div className="flex items-center space-x-3 mb-6">
          <Server className="h-6 w-6 text-blue-600" />
          <h2 className="text-2xl font-bold text-gray-900">Service Instance Status</h2>
        </div>

        <div className="space-y-6">
          {Object.entries(stats.services).map(([serviceName, instances]: [string, any]) => (
            <div key={serviceName} className="border border-gray-200 rounded-lg p-4">
              <div className="flex items-center space-x-3 mb-4">
                <span className="text-2xl">{getServiceIcon(serviceName)}</span>
                <h3 className="text-xl font-semibold text-gray-900 capitalize">{serviceName} Service</h3>
                <span className="px-3 py-1 bg-blue-100 text-blue-800 rounded-full text-sm font-medium">
                  {instances.length} instances
                </span>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {instances.map((instance: any, index: number) => {
                  const color = getServiceColor(serviceName);
                  const port = instance.url.split(':').pop();
                  
                  return (
                    <div
                      key={index}
                      className={`border-2 rounded-lg p-4 transition-all duration-200 ${
                        instance.healthy
                          ? `border-${color}-200 bg-${color}-50`
                          : 'border-red-200 bg-red-50'
                      }`}
                    >
                      <div className="flex items-center justify-between mb-3">
                        <div className="flex items-center space-x-2">
                          {instance.healthy ? (
                            <CheckCircle className={`h-5 w-5 text-${color}-600`} />
                          ) : (
                            <XCircle className="h-5 w-5 text-red-600" />
                          )}
                          <span className="font-semibold text-gray-900">
                            Instance #{index + 1}
                          </span>
                        </div>
                        <span className={`px-2 py-1 rounded text-xs font-medium ${
                          instance.healthy
                            ? `bg-${color}-100 text-${color}-800`
                            : 'bg-red-100 text-red-800'
                        }`}>
                          {instance.healthy ? 'Healthy' : 'Unhealthy'}
                        </span>
                      </div>

                      <div className="space-y-2 text-sm">
                        <div className="flex justify-between">
                          <span className="text-gray-600">Port:</span>
                          <span className="font-mono font-semibold">{port}</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-gray-600">Requests:</span>
                          <div className="flex items-center space-x-1">
                            <TrendingUp className="h-4 w-4 text-gray-500" />
                            <span className="font-semibold">{instance.requests || 0}</span>
                          </div>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-gray-600">URL:</span>
                          <span className="font-mono text-xs text-gray-500 truncate">
                            {instance.url}
                          </span>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}