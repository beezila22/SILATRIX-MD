#!/bin/bash

echo "🤖 Starting SILATRIX-MD Bot..."
echo "🌐 Platform: $PLATFORM"

# Set platform if not set
if [ -z "$PLATFORM" ]; then
    export PLATFORM="Termux"
fi

# Check if node_modules exists
if [ ! -d "node_modules" ]; then
    echo "📦 Installing dependencies..."
    npm install
fi

# Check if plugins directory exists
if [ ! -d "plugins" ]; then
    echo "📁 Creating plugins directory..."
    mkdir -p plugins
fi

# Start the bot
node index.js
