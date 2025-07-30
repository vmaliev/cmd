#!/bin/bash

# Generate SSL certificates for development
echo "Generating SSL certificates for development..."

# Create ssl directory if it doesn't exist
mkdir -p ssl

# Generate self-signed certificate
openssl req -x509 -newkey rsa:4096 -keyout ssl/key.pem -out ssl/cert.pem -days 365 -nodes -subj "/C=US/ST=State/L=City/O=Organization/CN=localhost"

echo "SSL certificates generated successfully!"
echo "Certificate: ssl/cert.pem"
echo "Private Key: ssl/key.pem"
echo ""
echo "You can now start the server with HTTPS support."
echo "Note: You'll need to accept the self-signed certificate in your browser." 