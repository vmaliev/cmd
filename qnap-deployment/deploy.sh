#!/bin/bash

echo "🚀 Deploying IT Support System on QNAP..."

# Check if .env exists
if [ ! -f ".env" ]; then
    echo "⚠️  .env file not found. Please copy .env.example to .env and configure it."
    echo "   cp .env.example .env"
    echo "   nano .env"
    exit 1
fi

# Make SSL script executable
chmod +x generate-ssl.sh

# Generate SSL certificates if they don't exist
if [ ! -f "ssl/cert.pem" ] || [ ! -f "ssl/key.pem" ]; then
    echo "🔐 Generating SSL certificates..."
    ./generate-ssl.sh
fi

# Build and start
echo "🔨 Building Docker image..."
docker-compose build

echo "🚀 Starting containers..."
docker-compose up -d

echo "✅ Deployment completed!"
echo "🌐 Access your application at:"
echo "   http://your-nas-ip:3000"
echo "   https://your-nas-ip:443"
echo ""
echo "📋 To check status: docker-compose ps"
echo "📋 To view logs: docker-compose logs -f"
