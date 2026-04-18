#!/bin/bash
# Setup script for async backend migration

echo "================================"
echo "Async Backend Setup"
echo "================================"
echo ""

# Navigate to Backend directory
cd Backend

# Install new dependencies (motor, httpx)
echo "📦 Installing async dependencies..."
pip install -r requirements.txt

echo ""
echo "✅ Setup complete! Your backend is now ready for async operations."
echo ""
echo "📝 Next Steps:"
echo "1. Review ASYNC_MIGRATION_GUIDE.md for conversion patterns"
echo "2. Convert remaining route files using the patterns shown"
echo "3. Test with: python main.py"
echo "4. Try concurrent API calls to see parallel performance"
echo ""
