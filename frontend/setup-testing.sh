#!/bin/bash

echo "🔧 Setting up UI Testing Environment..."

# Install dependencies
echo "📦 Installing testing dependencies..."
npm install

# Install Playwright browsers
echo "🌐 Installing browser dependencies..."
npx playwright install

# Create test directories
echo "📁 Creating test directories..."
mkdir -p testing/fixtures
mkdir -p testing/reports
mkdir -p testing/screenshots

# Copy test files from backend
echo "📄 Copying test data files..."
if [ -d "../backend/docs/testing/reconciliation" ]; then
    cp ../backend/docs/testing/reconciliation/*.csv testing/fixtures/ 2>/dev/null || echo "Some backend test files not found - will be created during tests"
fi

if [ -d "../backend/docs/testing/transformation" ]; then
    cp ../backend/docs/testing/transformation/*.csv testing/fixtures/ 2>/dev/null || echo "Some backend test files not found - will be created during tests"
fi

# Create additional test files
echo "🏗️ Creating additional test files..."

# Create invalid file for error testing
echo "This is not a CSV file - for error testing" > testing/fixtures/invalid.txt

# Create small CSV for basic testing
cat > testing/fixtures/sample_data.csv << EOF
ID,Name,Value,Date
1,Item A,100.00,2024-01-15
2,Item B,200.00,2024-01-16
3,Item C,300.00,2024-01-17
EOF

# Create delta test files
cat > testing/fixtures/delta_file_old.csv << EOF
ID,Name,Amount,Status
1,Item A,100.00,Active
2,Item B,200.00,Active
3,Item C,300.00,Inactive
4,Item D,400.00,Active
EOF

cat > testing/fixtures/delta_file_new.csv << EOF
ID,Name,Amount,Status
1,Item A,100.00,Active
2,Item B Modified,250.00,Active
4,Item D,400.00,Inactive
5,Item E,500.00,Active
EOF

echo "✅ UI Testing environment setup complete!"
echo ""
echo "🚀 Quick Start Commands:"
echo "  npm run test:smoke           # Quick verification (30 seconds)"
echo "  npm run test:ui:all          # Complete test suite (5-15 minutes)"
echo "  npm run test:integration     # Run Playwright tests"
echo "  npm run test:debug           # Debug mode with browser visible"
echo ""
echo "📋 Prerequisites:"
echo "  ✅ Backend running: cd backend && python -m uvicorn app.main:app --reload"
echo "  ✅ Frontend running: npm run dev"
echo ""
echo "🎯 Start testing: npm run test:smoke"