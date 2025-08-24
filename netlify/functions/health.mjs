import { config as appConfig, getFlaskApiUrl } from './config.mjs';

export default async (req, context) => {
  // Handle CORS
  if (req.method === 'OPTIONS') {
    return new Response(null, {
      status: 200,
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'GET, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type',
      },
    });
  }

  if (req.method !== 'GET') {
    return new Response(JSON.stringify({ 
      success: false, 
      error: 'Method not allowed' 
    }), {
      status: 405,
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*',
      },
    });
  }

  try {
    // Check Flask API status
    let flaskApiStatus = 'unknown';
    let flaskApiResponse = null;
    
    try {
      const flaskHealthUrl = getFlaskApiUrl('health');
      const flaskResponse = await fetch(flaskHealthUrl, {
        method: 'GET',
        signal: AbortSignal.timeout(5000) // 5 second timeout
      });
      
      if (flaskResponse.ok) {
        flaskApiStatus = 'healthy';
        flaskApiResponse = await flaskResponse.json();
      } else {
        flaskApiStatus = 'unhealthy';
      }
    } catch (flaskError) {
      flaskApiStatus = 'unavailable';
      console.log('Flask API health check failed:', flaskError.message);
    }

    return new Response(JSON.stringify({
      status: 'healthy',
      models_loaded: true,
      prediction_type: flaskApiStatus === 'healthy' ? 'flask_api' : 'mock_fallback',
      flask_api: {
        status: flaskApiStatus,
        url: getFlaskApiUrl('predict'),
        health_url: getFlaskApiUrl('health'),
        response: flaskApiResponse
      },
      netlify_functions: {
        status: 'healthy',
        functions: ['predict', 'health']
      },
      timestamp: new Date().toISOString(),
      environment: 'netlify'
    }), {
      status: 200,
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*',
      },
    });

  } catch (error) {
    console.error('Health check error:', error);
    
    return new Response(JSON.stringify({
      status: 'unhealthy',
      models_loaded: false,
      error: error.message,
      timestamp: new Date().toISOString()
    }), {
      status: 500,
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*',
      },
    });
  }
};

export const config = {
  path: "/api/health"
};
