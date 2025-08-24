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
    // Check if model files exist
    const fs = await import('fs');
    const path = await import('path');
    
    const modelFiles = [
      'models/model1_random_forest.joblib',
      'models/model2_ridge.joblib',
      'models/scaler1.joblib'
    ];
    
    let modelsLoaded = true;
    for (const modelFile of modelFiles) {
      try {
        fs.accessSync(modelFile, fs.constants.F_OK);
      } catch (error) {
        modelsLoaded = false;
        break;
      }
    }

    return new Response(JSON.stringify({
      status: 'healthy',
      models_loaded: modelsLoaded,
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
