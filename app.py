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
        # Get input data
        data = request.get_json()
        pct_min = float(data['pct_min'])
        cum_min = float(data['cum_min'])
        
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
        
    except Exception as e:
        return jsonify({'success': False, 'error': str(e)})

@app.route('/health')
def health_check():
    """Health check endpoint for Render"""
    if model1 is not None and model2 is not None and scaler1 is not None:
        return jsonify({'status': 'healthy', 'models_loaded': True}), 200
    else:
        return jsonify({'status': 'unhealthy', 'models_loaded': False}), 500

if __name__ == '__main__':
    # Production-ready configuration
    port = int(os.environ.get('PORT', 8000))
    app.run(host='0.0.0.0', port=port)
