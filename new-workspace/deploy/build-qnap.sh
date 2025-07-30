#!/bin/bash

# QNAP TS-233 Container Station Build Script
# This script builds and prepares the IT Support System for QNAP deployment

set -e  # Exit on any error

echo "🏠 QNAP TS-233 Container Station Build Script"
echo "=============================================="

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Function to print colored output
print_status() {
    echo -e "${BLUE}[INFO]${NC} $1"
}

print_success() {
    echo -e "${GREEN}[SUCCESS]${NC} $1"
}

print_warning() {
    echo -e "${YELLOW}[WARNING]${NC} $1"
}

print_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

# Check if Docker is available
check_docker() {
    print_status "Checking Docker availability..."
    if ! command -v docker &> /dev/null; then
        print_error "Docker is not installed or not in PATH"
        exit 1
    fi
    
    if ! docker info &> /dev/null; then
        print_error "Docker is not running or you don't have permissions"
        exit 1
    fi
    
    print_success "Docker is available and running"
}

# Check if docker-compose is available
check_docker_compose() {
    print_status "Checking Docker Compose availability..."
    if ! command -v docker-compose &> /dev/null; then
        print_error "Docker Compose is not installed or not in PATH"
        exit 1
    fi
    
    print_success "Docker Compose is available"
}

# Validate project structure
validate_project() {
    print_status "Validating project structure..."
    
    required_files=("package.json" "server.js" "Dockerfile" "docker-compose.yml")
    
    for file in "${required_files[@]}"; do
        if [ ! -f "$file" ]; then
            print_error "Required file not found: $file"
            exit 1
        fi
    done
    
    print_success "Project structure is valid"
}

# Create necessary directories
create_directories() {
    print_status "Creating necessary directories..."
    
    mkdir -p data logs ssl
    
    print_success "Directories created: data/, logs/, ssl/"
}

# Generate SSL certificates if they don't exist
generate_ssl() {
    print_status "Checking SSL certificates..."
    
    if [ ! -f "ssl/cert.pem" ] || [ ! -f "ssl/key.pem" ]; then
        print_warning "SSL certificates not found. Generating self-signed certificates..."
        
        if [ -f "generate-ssl.sh" ]; then
            chmod +x generate-ssl.sh
            ./generate-ssl.sh
            print_success "SSL certificates generated"
        else
            print_warning "generate-ssl.sh not found. Please generate SSL certificates manually."
        fi
    else
        print_success "SSL certificates found"
    fi
}

# Build Docker image
build_image() {
    print_status "Building Docker image for QNAP..."
    
    # Build with QNAP-specific optimizations
    docker build \
        --platform linux/amd64 \
        --tag it-support-system:qnap \
        --build-arg NODE_ENV=production \
        .
    
    print_success "Docker image built successfully"
}

# Test the build
test_build() {
    print_status "Testing the build..."
    
    # Start container in test mode
    docker-compose up -d
    
    # Wait for container to start
    sleep 10
    
    # Check if container is running
    if docker ps | grep -q "it-support-system"; then
        print_success "Container is running"
        
        # Test HTTP endpoint
        if curl -f -s http://localhost:3000 > /dev/null; then
            print_success "HTTP endpoint is accessible"
        else
            print_warning "HTTP endpoint test failed"
        fi
        
        # Stop test container
        docker-compose down
        print_success "Test completed successfully"
    else
        print_error "Container failed to start"
        docker-compose logs
        docker-compose down
        exit 1
    fi
}

# Create deployment package
create_package() {
    print_status "Creating deployment package..."
    
    # Create package directory
    mkdir -p qnap-deployment
    
    # Copy necessary files
    cp -r data qnap-deployment/
    cp -r ssl qnap-deployment/
    cp docker-compose.yml qnap-deployment/
    cp Dockerfile qnap-deployment/
    cp package*.json qnap-deployment/
    cp server.js qnap-deployment/
    cp html.html qnap-deployment/
    cp client.html qnap-deployment/
    cp login.html qnap-deployment/
    cp html.css qnap-deployment/
    cp theme.js qnap-deployment/
    cp QNAP_DEPLOYMENT.md qnap-deployment/
    cp .dockerignore qnap-deployment/
    
    # Create sample .env file
    cat > qnap-deployment/.env.example << EOF
# QNAP Environment Configuration
NODE_ENV=production
PORT=3000

# SMTP Configuration (Mailjet)
SMTP_HOST=in-v3.mailjet.com
SMTP_PORT=587
SMTP_USER=your_mailjet_api_key
SMTP_PASS=your_mailjet_secret_key
SMTP_FROM=your_verified_email@domain.com
EOF
    
    # Create deployment script
    cat > qnap-deployment/deploy.sh << 'EOF'
#!/bin/bash

echo "🚀 Deploying IT Support System on QNAP..."

# Check if .env exists
if [ ! -f ".env" ]; then
    echo "⚠️  .env file not found. Please copy .env.example to .env and configure it."
    exit 1
fi

# Build and start
docker-compose build
docker-compose up -d

echo "✅ Deployment completed!"
echo "🌐 Access your application at:"
echo "   http://your-nas-ip:3000"
echo "   https://your-nas-ip:443"
EOF
    
    chmod +x qnap-deployment/deploy.sh
    
    # Create README for deployment
    cat > qnap-deployment/README.md << 'EOF'
# IT Support System - QNAP Deployment Package

## Quick Start

1. Upload this folder to your QNAP NAS
2. SSH into your NAS and navigate to this directory
3. Copy `.env.example` to `.env` and configure your settings
4. Run `./deploy.sh`

## Files Included

- `docker-compose.yml` - Container configuration
- `Dockerfile` - Image build instructions
- `server.js` - Main application server
- `html.html` - Admin interface
- `client.html` - Client portal
- `data/` - Persistent data directory
- `ssl/` - SSL certificates
- `.env.example` - Environment configuration template
- `deploy.sh` - Deployment script

## Configuration

Edit `.env` file with your SMTP settings and other configuration.

## Access

- Admin Portal: http://your-nas-ip:3000
- Client Portal: http://your-nas-ip:3000/client.html

For detailed instructions, see QNAP_DEPLOYMENT.md
EOF
    
    print_success "Deployment package created in qnap-deployment/"
}

# Main execution
main() {
    echo "Starting QNAP build process..."
    echo ""
    
    check_docker
    check_docker_compose
    validate_project
    create_directories
    generate_ssl
    build_image
    test_build
    create_package
    
    echo ""
    echo "🎉 QNAP build completed successfully!"
    echo ""
    echo "📦 Deployment package created: qnap-deployment/"
    echo "📋 Next steps:"
    echo "   1. Upload qnap-deployment/ to your QNAP NAS"
    echo "   2. SSH into your NAS and navigate to the directory"
    echo "   3. Copy .env.example to .env and configure settings"
    echo "   4. Run ./deploy.sh"
    echo ""
    echo "📖 For detailed instructions, see QNAP_DEPLOYMENT.md"
}

# Run main function
main "$@" 