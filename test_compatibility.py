#!/usr/bin/env python3
"""
Test script to verify model compatibility with deployment environment.
This script simulates the exact environment that Render will use.
"""

import sys
import os

def test_model_compatibility():
    """Test if models can be loaded with deployment versions."""
    
    print("🔍 Testing Model Compatibility...")
    print("=" * 50)
    
    # Check Python version
    print(f"Python version: {sys.version}")
    
    try:
        # Import required packages
        import joblib
        import numpy as np
        import pandas as pd
        from sklearn.preprocessing import StandardScaler
        
        print("✅ All required packages imported successfully")
        
        # Try to load models
        print("\n📦 Loading models...")
        
        model1 = joblib.load('models/model1_random_forest.joblib')
        print("✅ Model 1 (Random Forest) loaded successfully")
        
        model2 = joblib.load('models/model2_ridge.joblib')
        print("✅ Model 2 (Ridge Regression) loaded successfully")
        
        scaler1 = joblib.load('models/scaler1.joblib')
        print("✅ Scaler loaded successfully")
        
        # Test prediction pipeline
        print("\n🧪 Testing prediction pipeline...")
        
        # Sample input
        test_input = np.array([[30.0, 85.0]])
        test_scaled = scaler1.transform(test_input)
        
        # Model 1 prediction
        mean_size = model1.predict(test_scaled)[0]
        equivalent_size = mean_size * 3
        
        # Model 2 prediction
        model2_input = np.array([[equivalent_size]])
        predicted_sizes = model2.predict(model2_input)[0]
        
        print(f"✅ Sample prediction successful:")
        print(f"   Input: PCT_MIN=30.0, CUM_MIN=85.0")
        print(f"   Model 1 Output (MEAN_SIZE): {mean_size:.4f}")
        print(f"   Equivalent Product Size: {equivalent_size:.4f}")
        print(f"   Model 2 Output (first 5 sizes): {predicted_sizes[:5]}")
        
        print("\n🎉 All compatibility tests passed!")
        return True
        
    except Exception as e:
        print(f"❌ Compatibility test failed: {e}")
        print(f"   Error type: {type(e).__name__}")
        return False

if __name__ == "__main__":
    success = test_model_compatibility()
    sys.exit(0 if success else 1)
