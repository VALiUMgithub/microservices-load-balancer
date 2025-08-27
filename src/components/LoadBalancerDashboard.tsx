import React from 'react';
import { BarChart, Activity, Clock, TrendingUp } from 'lucide-react';

interface LoadBalancerDashboardProps {
  stats: any;
}

export function LoadBalancerDashboard({ stats }: LoadBalancerDashboardProps) {
  const getTotalRequests = () => {
    let total = 0;
    Object.values(stats.services).forEach((serviceInstances: any) => {
      serviceInstances.forEach((instance: any) => {
        total += instance.requests || 0;
      });
    });
    return total;
  };

  const getHealthyServices = () => {
    let healthy = 0;
    let total = 0;
    Object.values(stats.services).forEach((serviceInstances: any) => {
      serviceInstances.forEach((instance: any) => {
        total++;
        if (instance.healthy) healthy++;
      });
    });
    return { healthy, total };
  };

  const { healthy, total } = getHealthyServices();
  const totalRequests = getTotalRequests();

  return (
    <div className="mb-8">
      <div className="bg-white rounded-xl shadow-lg p-6 border border-gray-200">
        <div className="flex items-center space-x-3 mb-6">
          <BarChart className="h-6 w-6 text-blue-600" />
          <h2 className="text-2xl font-bold text-gray-900">Load Balancer Dashboard</h2>
        </div>

        {/* Key Metrics */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8">
          <div className="bg-gradient-to-r from-blue-500 to-blue-600 rounded-lg p-4 text-white">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-blue-100 text-sm font-medium">Total Requests</p>
                <p className="text-2xl font-bold">{totalRequests}</p>
              </div>
              <TrendingUp className="h-8 w-8 text-blue-200" />
            </div>
          </div>

          <div className="bg-gradient-to-r from-green-500 to-green-600 rounded-lg p-4 text-white">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-green-100 text-sm font-medium">Healthy Services</p>
                <p className="text-2xl font-bold">{healthy}/{total}</p>
              </div>
              <Activity className="h-8 w-8 text-green-200" />
            </div>
          </div>

          <div className="bg-gradient-to-r from-purple-500 to-purple-600 rounded-lg p-4 text-white">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-purple-100 text-sm font-medium">Load Distribution</p>
                <p className="text-2xl font-bold">Round-Robin</p>
              </div>
              <BarChart className="h-8 w-8 text-purple-200" />
            </div>
          </div>

          <div className="bg-gradient-to-r from-orange-500 to-orange-600 rounded-lg p-4 text-white">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-orange-100 text-sm font-medium">Last Updated</p>
                <p className="text-sm font-medium">
                  {new Date(stats.timestamp).toLocaleTimeString()}
                </p>
              </div>
              <Clock className="h-8 w-8 text-orange-200" />
            </div>
          </div>
        </div>

        {/* Current Index Display */}
        <div className="bg-gray-50 rounded-lg p-4">
          <h3 className="font-semibold text-gray-900 mb-3">Current Round-Robin Indices</h3>
          <div className="grid grid-cols-3 gap-4">
            {Object.entries(stats.currentIndex).map(([service, index]) => (
              <div key={service} className="flex justify-between items-center bg-white rounded-lg p-3 border border-gray-200">
                <span className="font-medium capitalize text-gray-700">{service} Service:</span>
                <span className="bg-blue-100 text-blue-800 px-2 py-1 rounded text-sm font-semibold">
                  Index {index}
                </span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}