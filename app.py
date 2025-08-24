from flask import Flask, render_template, request, jsonify
import joblib
import numpy as np
import pandas as pd
from sklearn.preprocessing import StandardScaler
import os

app = Flask(__name__)

# Load trained models and scalers with error handling
try:
    model1 = joblib.load('models/model1_random_forest.joblib')
    model2 = joblib.load('models/model2_ridge.joblib')
    scaler1 = joblib.load('models/scaler1.joblib')
    print("✅ All models loaded successfully")
except Exception as e:
    print(f"❌ Error loading models: {e}")
    model1 = model2 = scaler1 = None

@app.route('/')
def home():
    return render_template('index.html')

@app.route('/predict', methods=['POST'])
def predict():
    # Check if models are loaded
    if model1 is None or model2 is None or scaler1 is None:
        return jsonify({'success': False, 'error': 'Models not loaded. Please check deployment.'}), 500
    
    try:
        # Get input data - handle both field name formats
        data = request.get_json()
        if not data:
            return jsonify({'success': False, 'error': 'No JSON data received'}), 400
        
        # Try different possible field names
        pct_min = None
        cum_min = None
        
        # Check for the field names that might be sent from frontend
        if 'pct_min' in data:
            pct_min = float(data['pct_min'])
        elif 'PCT_MIN_0.25MM_60MSH' in data:
            pct_min = float(data['PCT_MIN_0.25MM_60MSH'])
        else:
            return jsonify({'success': False, 'error': 'Missing PCT_MIN_0.25MM_60MSH field'}), 400
            
        if 'cum_min' in data:
            cum_min = float(data['cum_min'])
        elif 'CUM_MIN_3.15MM' in data:
            cum_min = float(data['CUM_MIN_3.15MM'])
        else:
            return jsonify({'success': False, 'error': 'Missing CUM_MIN_3.15MM field'}), 400
        
        # Validate input ranges
        if pct_min < 20 or pct_min > 50:
            return jsonify({'success': False, 'error': 'PCT_MIN_0.25MM_60MSH must be between 20 and 50'}), 400
        if cum_min < 80 or cum_min > 90:
            return jsonify({'success': False, 'error': 'CUM_MIN_3.15MM must be between 80 and 90'}), 400
        
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
        
        # Prepare response
        result = {
            'mean_size': round(mean_size, 4),
            'equivalent_product_size': round(equivalent_product_size, 4),
            'sizes': priorities,
            'final_equivalent_size': round(final_equivalent_size, 4),
            'priority_distribution': {
                'Priority 3': priorities.count(3),
                'Priority 4': priorities.count(4),
                'Priority 5': priorities.count(5)
            }
        }
        
        return jsonify({'success': True, 'result': result})
        
    except ValueError as e:
        return jsonify({'success': False, 'error': f'Invalid input value: {str(e)}'}), 400
    except KeyError as e:
        return jsonify({'success': False, 'error': f'Missing required field: {str(e)}'}), 400
    except Exception as e:
        return jsonify({'success': False, 'error': f'Unexpected error: {str(e)}'}), 500

@app.route('/health')
def health_check():
    """Health check endpoint for Render"""
    if model1 is not None and model2 is not None and scaler1 is not None:
        return jsonify({'status': 'healthy', 'models_loaded': True}), 200
    else:
        return jsonify({'status': 'unhealthy', 'models_loaded': False}), 500

# Custom 404 error handler to return JSON
@app.errorhandler(404)
def not_found_error(error):
    return jsonify({'success': False, 'error': 'Not Found', 'message': 'The requested URL was not found on the server.'}), 404

# Custom 500 error handler
@app.errorhandler(500)
def internal_error(error):
    return jsonify({'success': False, 'error': 'Internal Server Error', 'message': 'An unexpected error occurred.'}), 500

if __name__ == '__main__':
    # Production-ready configuration
    port = int(os.environ.get('PORT', 8000))
    app.run(host='0.0.0.0', port=port)
