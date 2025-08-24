// Configuration for Netlify Functions

export const config = {
  // Flask API Configuration
  flaskApi: {
    baseUrl: 'https://mat-prediction.onrender.com',
    endpoints: {
      predict: '/predict',
      health: '/health'
    },
    timeout: 10000, // 10 seconds
    retries: 2
  },
  
  // Prediction Configuration
  prediction: {
    inputValidation: {
      pct_min: { min: 20, max: 50 },
      cum_min: { min: 80, max: 90 }
    },
    fallbackEnabled: true
  },
  
  // CORS Configuration
  cors: {
    allowedOrigins: ['*'],
    allowedMethods: ['GET', 'POST', 'OPTIONS'],
    allowedHeaders: ['Content-Type']
  }
};

// Helper function to get full API URL
export function getFlaskApiUrl(endpoint) {
  return `${config.flaskApi.baseUrl}${config.flaskApi.endpoints[endpoint]}`;
}

// Helper function to validate input
export function validateInput(pct_min, cum_min) {
  const { inputValidation } = config.prediction;
  
  if (pct_min < inputValidation.pct_min.min || pct_min > inputValidation.pct_min.max) {
    throw new Error(`PCT_MIN_0.25MM_60MSH must be between ${inputValidation.pct_min.min} and ${inputValidation.pct_min.max}`);
  }
  
  if (cum_min < inputValidation.cum_min.min || cum_min > inputValidation.cum_min.max) {
    throw new Error(`CUM_MIN_3.15MM must be between ${inputValidation.cum_min.min} and ${inputValidation.cum_min.max}`);
  }
  
  return true;
}
