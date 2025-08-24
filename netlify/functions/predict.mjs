import { config, getFlaskApiUrl, validateInput } from './config.mjs';

export default async (req, context) => {
  // Handle CORS
  if (req.method === 'OPTIONS') {
    return new Response(null, {
      status: 200,
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'POST, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type',
      },
    });
  }

  if (req.method !== 'POST') {
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
    const body = await req.json();
    const { pct_min, cum_min } = body;

    // Validate input
    if (pct_min === undefined || cum_min === undefined) {
      return new Response(JSON.stringify({
        success: false,
        error: 'Missing required parameters: pct_min and cum_min'
      }), {
        status: 400,
        headers: {
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*',
        },
      });
    }

    // Use configuration validation
    try {
      validateInput(pct_min, cum_min);
    } catch (validationError) {
      return new Response(JSON.stringify({
        success: false,
        error: validationError.message
      }), {
        status: 400,
        headers: {
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*',
        },
      });
    }

    // Try to connect to Flask API first
    if (config.prediction.fallbackEnabled) {
      try {
        const flaskApiUrl = getFlaskApiUrl('predict');
        
        const flaskResponse = await fetch(flaskApiUrl, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            pct_min: pct_min,
            cum_min: cum_min
          }),
          signal: AbortSignal.timeout(config.flaskApi.timeout)
        });

        if (flaskResponse.ok) {
          const flaskResult = await flaskResponse.json();
          
          // Return the Flask API result
          return new Response(JSON.stringify({
            success: true,
            result: flaskResult.result || flaskResult,
            source: 'flask_api',
            api_url: flaskApiUrl
          }), {
            status: 200,
            headers: {
              'Content-Type': 'application/json',
              'Access-Control-Allow-Origin': '*',
            },
          });
        } else {
          console.log(`Flask API returned status ${flaskResponse.status}`);
        }
      } catch (flaskError) {
        console.log('Flask API not available, falling back to mock predictions:', flaskError.message);
      }
    }

    // Fallback to mock predictions if Flask API is not available
    console.log('Using mock predictions as fallback');
    
    // Mock prediction logic (simulating the ML models)
    // This demonstrates the same logic as the Python implementation
    
    // Model 1: Predict MEAN_SIZE (simplified)
    const meanSize = (pct_min * 0.3 + cum_min * 0.7) / 100;
    const equivalentProductSize = meanSize * 3;
    
    // Model 2: Generate 24 sizes with priority distribution
    const targetSum = equivalentProductSize * 24;
    const totalSizes = 24;
    const priority3Count = Math.floor(totalSizes * 0.4);  // 40% priority 3
    const priority4Count = Math.floor(totalSizes * 0.35); // 35% priority 4  
    const priority5Count = totalSizes - priority3Count - priority4Count;
    
    // Create initial priority array
    const priorities = [];
    for (let i = 0; i < priority3Count; i++) {
      priorities.push(3);
    }
    for (let i = 0; i < priority4Count; i++) {
      priorities.push(4);
    }
    for (let i = 0; i < priority5Count; i++) {
      priorities.push(5);
    }
    
    // Calculate base sum and adjustment needed
    const baseSum = (priority3Count * 3) + (priority4Count * 4) + (priority5Count * 5);
    let adjustmentNeeded = targetSum - baseSum;
    
    // Adjust values to match target sum
    if (Math.abs(adjustmentNeeded) > 0.1) {
      if (adjustmentNeeded > 0) {
        // Increase some values
        for (let i = 0; i < Math.min(Math.floor(adjustmentNeeded), priority3Count); i++) {
          priorities[i] = 4;
          adjustmentNeeded -= 1;
          if (adjustmentNeeded <= 0) break;
        }
        
        if (adjustmentNeeded > 0) {
          for (let i = priority3Count; i < priority3Count + Math.min(Math.floor(adjustmentNeeded), priority4Count); i++) {
            priorities[i] = 5;
            adjustmentNeeded -= 1;
            if (adjustmentNeeded <= 0) break;
          }
        }
      } else {
        // Decrease some values
        adjustmentNeeded = Math.abs(adjustmentNeeded);
        for (let i = priority3Count + priority4Count; i < totalSizes; i++) {
          if (adjustmentNeeded <= 0) break;
          priorities[i] = 4;
          adjustmentNeeded -= 1;
        }
        
        if (adjustmentNeeded > 0) {
          for (let i = priority3Count; i < priority3Count + priority4Count; i++) {
            if (adjustmentNeeded <= 0) break;
            priorities[i] = 3;
            adjustmentNeeded -= 1;
          }
        }
      }
    }
    
    // Shuffle for randomness while maintaining priority order
    const seed = Math.floor(equivalentProductSize * 1000);
    const shuffled = [...priorities];
    for (let i = shuffled.length - 1; i > 0; i--) {
      const j = Math.floor((seed + i) % (i + 1));
      [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
    }
    
    // Calculate final metrics
    const finalSum = shuffled.reduce((a, b) => a + b, 0);
    const finalEquivalentSize = finalSum / 24;
    
    // Count priorities
    const priorityDistribution = {
      'Priority 3': shuffled.filter(x => x === 3).length,
      'Priority 4': shuffled.filter(x => x === 4).length,
      'Priority 5': shuffled.filter(x => x === 5).length
    };
    
    // Prepare result
    const result = {
      mean_size: parseFloat(meanSize.toFixed(4)),
      equivalent_product_size: parseFloat(equivalentProductSize.toFixed(4)),
      sizes: shuffled,
      final_equivalent_size: parseFloat(finalEquivalentSize.toFixed(4)),
      priority_distribution: priorityDistribution
    };

    return new Response(JSON.stringify({
      success: true,
      result: result,
      source: 'mock_fallback',
      note: "Using mock prediction logic as fallback. Flask API may be unavailable.",
      flask_api_url: getFlaskApiUrl('predict')
    }), {
      status: 200,
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*',
      },
    });

  } catch (error) {
    console.error('Prediction error:', error);
    
    return new Response(JSON.stringify({
      success: false,
      error: `Prediction failed: ${error.message}`
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
  path: "/api/predict"
};
