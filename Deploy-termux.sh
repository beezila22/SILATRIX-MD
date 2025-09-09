#!/bin/bash

echo "🤖 SILATRIX-MD Bot Installer for Termux"
echo "========================================"

# Update packages
pkg update -y
pkg upgrade -y

# Install dependencies
pkg install -y nodejs git wget curl

# Check Node.js installation
node -v
npm -v

# Clean previous installations
rm -rf SILATRIX-MD
rm -rf sessions
rm -rf sessions_pair

# Clone your repository
git clone https://github.com/beezila22/SILATRIX-MD.git
cd SILATRIX-MD

# Install npm dependencies
npm install

# Create necessary directories
mkdir -p plugins
mkdir -p sessions
mkdir -p sessions_pair

# Make scripts executable
chmod +x start.sh
chmod +x deploy-termux.sh

# Create start script
cat > start.sh << 'EOF'
#!/bin/bash
echo "Starting SILATRIX-MD Bot..."
echo "Platform: $PLATFORM"
export PLATFORM="Termux"
npm start
EOF

chmod +x start.sh

echo "✅ Installation completed!"
echo "📝 Edit .env file to configure your bot"
echo "🚀 Start bot with: npm start"
echo "   Or: ./start.sh"
echo ""
echo "📋 Quick commands:"
echo "   • npm start      - Start with QR code"
echo "   • npm run pair   - Start with pair code"
echo "   • ./start.sh     - Start with setup"

# Start the bot
echo "🔄 Starting bot in 5 seconds..."
sleep 5
PLATFORM="Termux" npm start
