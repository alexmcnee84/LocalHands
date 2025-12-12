#!/bin/bash

# Build script for LocalHands executable
echo "Building LocalHands executable..."

# Clean previous builds
echo "Cleaning previous builds..."
rm -rf release/
rm -rf dist/

# Install dependencies if needed
if [ ! -d "node_modules" ]; then
    echo "Installing dependencies..."
    npm install
fi

# Build the React app
echo "Building React application..."
npm run build

# Build for current platform
echo "Building executable for current platform..."
npx electron-builder --publish=never

echo "Build complete!"
echo "Executable location: release/"
ls -la release/*.AppImage 2>/dev/null || ls -la release/*.exe 2>/dev/null || ls -la release/*.dmg 2>/dev/null || echo "Check release/ directory for your platform's executable"