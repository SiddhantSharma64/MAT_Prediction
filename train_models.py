import pandas as pd
import numpy as np
from sklearn.model_selection import train_test_split, RandomizedSearchCV, LeaveOneOut
from sklearn.ensemble import RandomForestRegressor
from sklearn.linear_model import Ridge
from sklearn.preprocessing import StandardScaler, PolynomialFeatures
from sklearn.metrics import mean_squared_error, r2_score
import joblib
import os

def train_model1():
    """Train Model 1: Random Forest for predicting MEAN_SIZE"""
    print("Training Model 1: Random Forest Regressor...")
    
    # Load and clean dataset 1
    df1 = pd.read_csv('data/dataset_1.csv')
    df1 = df1.dropna()
    df1 = df1[df1['MEAN_SIZE'] != '#DIV/0!']
    df1['MEAN_SIZE'] = pd.to_numeric(df1['MEAN_SIZE'], errors='coerce')
    df1 = df1.dropna()
    
    # Prepare features and target
    X = df1[['PCT_MIN_0.25MM_60MSH', 'CUM_MIN_3.15MM']]
    y = df1['MEAN_SIZE']
    
    # Split and scale data
    X_train, X_test, y_train, y_test = train_test_split(X, y, test_size=0.2, random_state=42)
    scaler = StandardScaler()
    X_train_scaled = scaler.fit_transform(X_train)
    X_test_scaled = scaler.transform(X_test)
    
    # Hyperparameter tuning with RandomizedSearchCV
    param_distributions = {
        "n_estimators": [50, 100, 150],
        "max_depth": [10, 20, None],
        "min_samples_split": [2, 5],
        "min_samples_leaf": [1, 2]
    }
    
    random_search = RandomizedSearchCV(
        RandomForestRegressor(random_state=42),
        param_distributions,
        n_iter=10,
        cv=3,
        scoring="r2",
        n_jobs=-1,
        random_state=42
    )
    
    # Train and evaluate model
    random_search.fit(X_train_scaled, y_train)
    best_model = random_search.best_estimator_
    
    y_train_pred = best_model.predict(X_train_scaled)
    y_test_pred = best_model.predict(X_test_scaled)
    
    # Calculate metrics
    train_mse = mean_squared_error(y_train, y_train_pred)
    train_r2 = r2_score(y_train, y_train_pred)
    test_mse = mean_squared_error(y_test, y_test_pred)
    test_r2 = r2_score(y_test, y_test_pred)
    
    print(f"Model 1 - Best parameters: {random_search.best_params_}")
    print(f"Model 1 - Training MSE: {train_mse:.6f}")
    print(f"Model 1 - Training R²: {train_r2:.6f}")
    print(f"Model 1 - Testing MSE: {test_mse:.6f}")
    print(f"Model 1 - Testing R²: {test_r2:.6f}")
    
    # Check for overfitting
    r2_difference = train_r2 - test_r2
    if r2_difference > 0.1:
        print(f"⚠️  Warning: Potential overfitting detected (R² difference: {r2_difference:.3f})")
    else:
        print(f"✅ Good generalization (R² difference: {r2_difference:.3f})")
    
    # Save model and scaler
    os.makedirs('models', exist_ok=True)
    joblib.dump(best_model, 'models/model1_random_forest.joblib')
    joblib.dump(scaler, 'models/scaler1.joblib')
    
    return best_model, scaler

def train_model2():
    """Train Model 2: Ridge Regression for predicting 24 sizes"""
    print("\nTraining Model 2: Ridge Regression...")
    
    # Load dataset 2
    df2 = pd.read_csv('data/dataset_2.csv')
    X = df2[['Equivalent Product Size']]
    y = df2.iloc[:, 2:26]  # Size 1 to Size 24
    
    # Apply polynomial features
    poly = PolynomialFeatures(degree=1, include_bias=False)
    X_poly = poly.fit_transform(X)
    
    # Optimize alpha using Leave-One-Out Cross-Validation
    loo = LeaveOneOut()
    alpha_values = [0.1, 0.5, 1.0, 2.0, 5.0, 10.0]
    best_alpha = 1.0
    best_mse = float('inf')
    
    for alpha in alpha_values:
        model = Ridge(alpha=alpha, random_state=42)
        mse_scores = []
        
        for train_idx, test_idx in loo.split(X_poly):
            X_train, X_test = X_poly[train_idx], X_poly[test_idx]
            y_train, y_test = y.iloc[train_idx], y.iloc[test_idx]
            
            model.fit(X_train, y_train)
            y_pred = model.predict(X_test)
            mse = mean_squared_error(y_test, y_pred)
            mse_scores.append(mse)
        
        avg_mse = np.mean(mse_scores)
        if avg_mse < best_mse:
            best_mse = avg_mse
            best_alpha = alpha
    
    # Train final model with best alpha
    final_model = Ridge(alpha=best_alpha, random_state=42)
    final_model.fit(X_poly, y)
    
    # Evaluate model
    y_pred = final_model.predict(X_poly)
    mse = mean_squared_error(y, y_pred)
    r2 = r2_score(y, y_pred)
    
    print(f"Model 2 - Best alpha: {best_alpha}")
    print(f"Model 2 - MSE: {mse:.6f}")
    print(f"Model 2 - R²: {r2:.6f}")
    
    # Save model and polynomial transformer
    joblib.dump(final_model, 'models/model2_ridge.joblib')
    joblib.dump(poly, 'models/polynomial_features.joblib')
    
    return final_model, poly

def main():
    """Main function to train both models"""
    print("Starting MAT Prediction Model Training...")
    print("=" * 50)
    
    # Train both models
    model1, scaler1 = train_model1()
    model2, poly2 = train_model2()
    
    print("\n" + "=" * 50)
    print("Training completed successfully!")
    print("Models saved in 'models/' directory")
    
    # Test complete pipeline
    print("\nTesting complete pipeline...")
    
    test_input = np.array([[30.0, 85.0]])
    test_scaled = scaler1.transform(test_input)
    
    mean_size = model1.predict(test_scaled)[0]
    equivalent_size = mean_size * 3
    
    test_input_poly = poly2.transform([[equivalent_size]])
    predicted_sizes = model2.predict(test_input_poly)[0]
    
    print(f"Sample Input: PCT_MIN={test_input[0][0]}, CUM_MIN={test_input[0][1]}")
    print(f"Model 1 Output (MEAN_SIZE): {mean_size:.4f}")
    print(f"Equivalent Product Size: {equivalent_size:.4f}")
    print(f"Model 2 Output (first 5 sizes): {predicted_sizes[:5]}")
    
    print("\n" + "=" * 50)
    print("📊 Model Performance Summary:")
    print("Model 1 (Random Forest): Check training output above for detailed metrics")
    print("Model 2 (Ridge Regression): Check training output above for detailed metrics")
    print("✅ Both models trained and saved successfully!")

if __name__ == "__main__":
    main()
