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

    // Create a temporary Python script for prediction
    const pythonScript = `
import joblib
import numpy as np
import json
import sys

try:
    # Load models
    model1 = joblib.load('models/model1_random_forest.joblib')
    model2 = joblib.load('models/model2_ridge.joblib')
    scaler1 = joblib.load('models/scaler1.joblib')
    
    # Get input parameters
    pct_min = float(sys.argv[1])
    cum_min = float(sys.argv[2])
    
    # Model 1: Predict MEAN_SIZE
    input_features = np.array([[pct_min, cum_min]])
    input_scaled = scaler1.transform(input_features)
    mean_size = model1.predict(input_scaled)[0]
    equivalent_product_size = mean_size * 3
    
    # Model 2: Predict 24 sizes
    model2_input = np.array([[equivalent_product_size]])
    predicted_sizes = model2.predict(model2_input)[0]
    
    # Priority system: Create 24 values (3,4,5) that sum to target
    target_sum = equivalent_product_size * 24
    total_sizes = 24
    priority_3_count = int(total_sizes * 0.4)  # 40% priority 3
    priority_4_count = int(total_sizes * 0.35)  # 35% priority 4  
    priority_5_count = total_sizes - priority_3_count - priority_4_count
    
    # Calculate base sum and adjustment needed
    base_sum = (priority_3_count * 3) + (priority_4_count * 4) + (priority_5_count * 5)
    adjustment_needed = target_sum - base_sum
    
    # Create initial priority array
    priorities = []
    for i in range(priority_3_count):
        priorities.append(3)
    for i in range(priority_4_count):
        priorities.append(4)
    for i in range(priority_5_count):
        priorities.append(5)
    
    # Adjust values to match target sum
    if abs(adjustment_needed) > 0.1:
        if adjustment_needed > 0:
            # Increase some values
            for i in range(min(int(adjustment_needed), priority_3_count)):
                priorities[i] = 4
                adjustment_needed -= 1
                if adjustment_needed <= 0: break
            
            if adjustment_needed > 0:
                for i in range(priority_3_count, priority_3_count + min(int(adjustment_needed), priority_4_count)):
                    priorities[i] = 5
                    adjustment_needed -= 1
                    if adjustment_needed <= 0: break
        else:
            # Decrease some values
            adjustment_needed = abs(adjustment_needed)
            for i in range(priority_3_count + priority_4_count, total_sizes):
                if adjustment_needed <= 0: break
                priorities[i] = 4
                adjustment_needed -= 1
            
            if adjustment_needed > 0:
                for i in range(priority_3_count, priority_3_count + priority_4_count):
                    if adjustment_needed <= 0: break
                    priorities[i] = 3
                    adjustment_needed -= 1
    
    # Shuffle for randomness while maintaining priority order
    np.random.seed(int(equivalent_product_size * 1000))
    np.random.shuffle(priorities)
    
    # Calculate final metrics
    final_sum = sum(priorities)
    final_equivalent_size = final_sum / 24
    
    # Prepare result
    result = {
        'mean_size': float(mean_size),
        'equivalent_product_size': float(equivalent_product_size),
        'sizes': priorities,
        'final_equivalent_size': float(final_equivalent_size),
        'priority_distribution': {
            'Priority 3': priorities.count(3),
            'Priority 4': priorities.count(4),
            'Priority 5': priorities.count(5)
        }
    }
    
    print(json.dumps({'success': True, 'result': result}))
    
except Exception as e:
    print(json.dumps({'success': False, 'error': str(e)}))
`;

    // Write the Python script to a temporary file
    const scriptPath = '/tmp/predict.py';
    writeFileSync(scriptPath, pythonScript);

    // Execute the Python script
    const result = await new Promise((resolve, reject) => {
      const pythonProcess = spawn('python3', [scriptPath, pct_min.toString(), cum_min.toString()]);
      
      let output = '';
      let errorOutput = '';
      
      pythonProcess.stdout.on('data', (data) => {
        output += data.toString();
      });
      
      pythonProcess.stderr.on('data', (data) => {
        errorOutput += data.toString();
      });
      
      pythonProcess.on('close', (code) => {
        if (code === 0) {
          try {
            const result = JSON.parse(output.trim());
            resolve(result);
          } catch (e) {
            reject(new Error(`Failed to parse Python output: ${e.message}`));
          }
        } else {
          reject(new Error(`Python script failed with code ${code}: ${errorOutput}`));
        }
      });
      
      pythonProcess.on('error', (error) => {
        reject(new Error(`Failed to start Python process: ${error.message}`));
      });
    });

    return new Response(JSON.stringify(result), {
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
