# Use Alpine Linux for smaller image size (better for NAS)
FROM node:18-alpine

# Install necessary packages for QNAP compatibility
RUN apk add --no-cache \
    openssl \
    ca-certificates \
    && update-ca-certificates

# Create non-root user for security
RUN addgroup -g 1001 -S nodejs && \
    adduser -S nodejs -u 1001

# Set working directory
WORKDIR /app

# Copy package files first for better caching
COPY package*.json ./

# Install dependencies with production flag
RUN npm ci --only=production && npm cache clean --force

# Copy application files
COPY . .

# Create necessary directories and set permissions
RUN mkdir -p /app/logs /app/data && \
    chown -R nodejs:nodejs /app

# Switch to non-root user
USER nodejs

# Expose ports (HTTP and HTTPS)
EXPOSE 3000 443

# Health check for QNAP Container Station
HEALTHCHECK --interval=30s --timeout=10s --start-period=5s --retries=3 \
    CMD node -e "require('http').get('http://localhost:3000', (res) => { process.exit(res.statusCode === 200 ? 0 : 1) })" || exit 1

# Environment variables for QNAP
ENV NODE_ENV=production
ENV PORT=3000

# Start the application
CMD ["node", "server.js"] 