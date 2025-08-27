import React, { useState } from 'react';
import { Play, Users, Package, ShoppingCart, Loader2, CheckCircle, XCircle } from 'lucide-react';

interface TestResult {
  service: string;
  status: 'success' | 'error' | 'loading';
  data?: any;
  error?: string;
  timestamp: string;
}

export function ServiceTester() {
  const [results, setResults] = useState<TestResult[]>([]);
  const [isLoading, setIsLoading] = useState(false);

  const testService = async (service: string, endpoint: string) => {
    const testResult: TestResult = {
      service,
      status: 'loading',
      timestamp: new Date().toISOString()
    };

    setResults(prev => [testResult, ...prev.slice(0, 4)]);
    
    try {
      const response = await fetch(`http://localhost:3001/api/${endpoint}`);
      const data = await response.json();
      
      setResults(prev => prev.map(r => 
        r === testResult 
          ? { ...r, status: 'success', data }
          : r
      ));
    } catch (error) {
      setResults(prev => prev.map(r => 
        r === testResult 
          ? { ...r, status: 'error', error: (error as Error).message }
          : r
      ));
    }
  };

  const runLoadTest = async () => {
    setIsLoading(true);
    const services = [
      { name: 'Users', endpoint: 'users' },
      { name: 'Products', endpoint: 'products' },
      { name: 'Orders', endpoint: 'orders' }
    ];

    // Run multiple requests to demonstrate load balancing
    for (let i = 0; i < 9; i++) {
      const service = services[i % services.length];
      await testService(service.name, service.endpoint);
      await new Promise(resolve => setTimeout(resolve, 500)); // Delay for visual effect
    }
    
    setIsLoading(false);
  };

  const clearResults = () => {
    setResults([]);
  };

  return (
    <div className="bg-white rounded-xl shadow-lg p-6 border border-gray-200">
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center space-x-3">
          <Play className="h-6 w-6 text-blue-600" />
          <h2 className="text-2xl font-bold text-gray-900">Service Load Tester</h2>
        </div>
        <div className="space-x-3">
          <button
            onClick={runLoadTest}
            disabled={isLoading}
            className="flex items-center space-x-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            {isLoading ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Play className="h-4 w-4" />
            )}
            <span>{isLoading ? 'Testing...' : 'Run Load Test'}</span>
          </button>
          <button
            onClick={clearResults}
            className="px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors"
          >
            Clear Results
          </button>
        </div>
      </div>

      {/* Individual Service Tests */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
        <button
          onClick={() => testService('Users', 'users')}
          className="flex items-center space-x-3 p-4 border border-green-200 bg-green-50 rounded-lg hover:bg-green-100 transition-colors"
        >
          <Users className="h-6 w-6 text-green-600" />
          <span className="font-medium text-green-800">Test User Service</span>
        </button>
        
        <button
          onClick={() => testService('Products', 'products')}
          className="flex items-center space-x-3 p-4 border border-purple-200 bg-purple-50 rounded-lg hover:bg-purple-100 transition-colors"
        >
          <Package className="h-6 w-6 text-purple-600" />
          <span className="font-medium text-purple-800">Test Product Service</span>
        </button>
        
        <button
          onClick={() => testService('Orders', 'orders')}
          className="flex items-center space-x-3 p-4 border border-orange-200 bg-orange-50 rounded-lg hover:bg-orange-100 transition-colors"
        >
          <ShoppingCart className="h-6 w-6 text-orange-600" />
          <span className="font-medium text-orange-800">Test Order Service</span>
        </button>
      </div>

      {/* Results */}
      {results.length > 0 && (
        <div>
          <h3 className="font-semibold text-gray-900 mb-4">Recent Test Results</h3>
          <div className="space-y-3">
            {results.map((result, index) => (
              <div
                key={index}
                className={`p-4 rounded-lg border ${
                  result.status === 'success'
                    ? 'border-green-200 bg-green-50'
                    : result.status === 'error'
                    ? 'border-red-200 bg-red-50'
                    : 'border-blue-200 bg-blue-50'
                }`}
              >
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center space-x-3">
                    {result.status === 'loading' && (
                      <Loader2 className="h-5 w-5 text-blue-600 animate-spin" />
                    )}
                    {result.status === 'success' && (
                      <CheckCircle className="h-5 w-5 text-green-600" />
                    )}
                    {result.status === 'error' && (
                      <XCircle className="h-5 w-5 text-red-600" />
                    )}
                    <span className="font-medium">{result.service} Service</span>
                  </div>
                  <span className="text-xs text-gray-500">
                    {new Date(result.timestamp).toLocaleTimeString()}
                  </span>
                </div>
                
                {result.status === 'success' && result.data && (
                  <div className="text-sm">
                    <p className="text-gray-600 mb-1">
                      Served by: <span className="font-mono font-semibold">{result.data.service}</span>
                    </p>
                    <p className="text-gray-600">
                      Items returned: <span className="font-semibold">{result.data.data?.length || 0}</span>
                    </p>
                  </div>
                )}
                
                {result.status === 'error' && (
                  <p className="text-sm text-red-600">Error: {result.error}</p>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {results.length === 0 && (
        <div className="text-center py-12 text-gray-500">
          <Play className="h-12 w-12 mx-auto mb-4 text-gray-300" />
          <p>Run the load test to see how requests are distributed across service instances</p>
        </div>
      )}
    </div>
  );
}