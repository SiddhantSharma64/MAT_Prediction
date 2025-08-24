#!/bin/bash
# Virtual Environment Activation Script for MAT Prediction Project

echo "🚀 Activating MAT Prediction Virtual Environment..."

# Check if virtual environment exists
if [ ! -d "venv" ]; then
    echo "❌ Virtual environment not found. Please run setup first."
    exit 1
fi

# Activate virtual environment
source venv/bin/activate

echo "✅ Virtual environment activated successfully!"
echo "📦 Python version: $(python --version)"
echo "📦 Pip version: $(pip --version)"
echo ""
echo "🔧 To deactivate, run: deactivate"
echo "🚀 To run the app: python app.py"
echo "🌐 To run with gunicorn: gunicorn app:app --bind 0.0.0.0:8000"
