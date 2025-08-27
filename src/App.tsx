import React, { useState, useEffect } from 'react';
import { Server, Users, Package, ShoppingCart, Activity, AlertCircle, CheckCircle, RefreshCw } from 'lucide-react';
import { ServiceStats } from './components/ServiceStats';
import { ServiceTester } from './components/ServiceTester';
import { LoadBalancerDashboard } from './components/LoadBalancerDashboard';
import { ProductionFeatures } from './components/ProductionFeatures';

function App() {
  const [stats, setStats] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(null);

  const fetchStats = async () => {
    try {
      setIsLoading(true);
      const response = await fetch('http://localhost:3001/api/gateway/stats');
      if (!response.ok) {
        throw new Error('Failed to fetch stats');
      }
      const data = await response.json();
      setStats(data);
      setError(null);
    } catch (err) {
      setError(err.message);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchStats();
    const interval = setInterval(fetchStats, 5000);
    return () => clearInterval(interval);
  }, []);

  if (isLoading && !stats) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 flex items-center justify-center">
        <div className="text-center">
          <RefreshCw className="h-8 w-8 animate-spin text-blue-600 mx-auto mb-4" />
          <p className="text-gray-600">Loading microservices dashboard...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100">
      {/* Header */}
      <header className="bg-white shadow-lg border-b border-gray-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-3">
              <Server className="h-8 w-8 text-blue-600" />
              <div>
                <h1 className="text-3xl font-bold text-gray-900">Microservices Load Balancer</h1>
                <p className="text-gray-600 mt-1">Horizontal scaling demonstration with Node.js & React</p>
              </div>
            </div>
            <div className="flex items-center space-x-4">
              <button
                onClick={fetchStats}
                className="flex items-center space-x-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
                disabled={isLoading}
              >
                <RefreshCw className={`h-4 w-4 ${isLoading ? 'animate-spin' : ''}`} />
                <span>Refresh</span>
              </button>
              {error ? (
                <div className="flex items-center space-x-2 text-red-600">
                  <AlertCircle className="h-5 w-5" />
                  <span className="text-sm">Error: {error}</span>
                </div>
              ) : (
                <div className="flex items-center space-x-2 text-green-600">
                  <CheckCircle className="h-5 w-5" />
                  <span className="text-sm">Connected</span>
                </div>
              )}
            </div>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Architecture Overview */}
        <div className="mb-8">
          <div className="bg-white rounded-xl shadow-lg p-6 border border-gray-200">
            <div className="flex items-center space-x-3 mb-6">
              <Activity className="h-6 w-6 text-blue-600" />
              <h2 className="text-2xl font-bold text-gray-900">Architecture Overview</h2>
            </div>
            
            <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
              <div className="text-center">
                <div className="bg-blue-100 rounded-lg p-4 mb-3">
                  <Server className="h-8 w-8 text-blue-600 mx-auto" />
                </div>
                <h3 className="font-semibold text-gray-900 mb-2">API Gateway</h3>
                <p className="text-sm text-gray-600">Load balancer with round-robin distribution and health checks</p>
                <div className="mt-2 px-3 py-1 bg-green-100 text-green-800 rounded-full text-xs font-medium">
                  Port 3001
                </div>
              </div>
              
              <div className="text-center">
                <div className="bg-green-100 rounded-lg p-4 mb-3">
                  <Users className="h-8 w-8 text-green-600 mx-auto" />
                </div>
                <h3 className="font-semibold text-gray-900 mb-2">User Service</h3>
                <p className="text-sm text-gray-600">User management with 2 instances for high availability</p>
                <div className="mt-2 space-x-1">
                  <span className="px-2 py-1 bg-green-100 text-green-800 rounded text-xs">3002</span>
                  <span className="px-2 py-1 bg-green-100 text-green-800 rounded text-xs">3003</span>
                </div>
              </div>
              
              <div className="text-center">
                <div className="bg-purple-100 rounded-lg p-4 mb-3">
                  <Package className="h-8 w-8 text-purple-600 mx-auto" />
                </div>
                <h3 className="font-semibold text-gray-900 mb-2">Product Service</h3>
                <p className="text-sm text-gray-600">Product catalog with 2 instances for load distribution</p>
                <div className="mt-2 space-x-1">
                  <span className="px-2 py-1 bg-purple-100 text-purple-800 rounded text-xs">3004</span>
                  <span className="px-2 py-1 bg-purple-100 text-purple-800 rounded text-xs">3005</span>
                </div>
              </div>
              
              <div className="text-center">
                <div className="bg-orange-100 rounded-lg p-4 mb-3">
                  <ShoppingCart className="h-8 w-8 text-orange-600 mx-auto" />
                </div>
                <h3 className="font-semibold text-gray-900 mb-2">Order Service</h3>
                <p className="text-sm text-gray-600">Order processing with 2 instances for redundancy</p>
                <div className="mt-2 space-x-1">
                  <span className="px-2 py-1 bg-orange-100 text-orange-800 rounded text-xs">3006</span>
                  <span className="px-2 py-1 bg-orange-100 text-orange-800 rounded text-xs">3007</span>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Load Balancer Dashboard */}
        {stats && <LoadBalancerDashboard stats={stats} />}

        {/* Service Stats */}
        {stats && <ServiceStats stats={stats} />}

        {/* Service Tester */}
        <ServiceTester />

        {/* Production Features */}
        <ProductionFeatures stats={stats} />
      </main>
    </div>
  );
}

export default App;