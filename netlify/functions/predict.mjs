import { spawn } from 'child_process';
import { writeFileSync, readFileSync } from 'fs';
import { join } from 'path';

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

    if (pct_min < 20 || pct_min > 50) {
      return new Response(JSON.stringify({
        success: false,
        error: 'PCT_MIN_0.25MM_60MSH must be between 20 and 50'
      }), {
        status: 400,
        headers: {
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*',
        },
      });
    }

    if (cum_min < 80 || cum_min > 90) {
      return new Response(JSON.stringify({
        success: false,
        error: 'CUM_MIN_3.15MM must be between 80 and 90'
      }), {
        status: 400,
        headers: {
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*',
        },
      });
    }

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
      note: "This is a demonstration using mock prediction logic. For production use, deploy the full Python ML models."
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
