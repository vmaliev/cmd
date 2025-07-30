# Enhanced IT Management System Server

## Overview

This enhanced server (`server-enhanced.js`) provides a secure, production-ready API server for the IT Management System with comprehensive security features, input validation, rate limiting, and database integration.

## 🛡️ Security Features

### 1. **Helmet.js Security Headers**
- **Content Security Policy (CSP)**: Prevents XSS attacks
- **X-Frame-Options**: Prevents clickjacking
- **X-Content-Type-Options**: Prevents MIME type sniffing
- **X-XSS-Protection**: Additional XSS protection
- **Strict-Transport-Security**: Enforces HTTPS
- **Referrer-Policy**: Controls referrer information

### 2. **Rate Limiting**
- **General API**: 100 requests per 15 minutes per IP
- **Authentication**: 5 attempts per 15 minutes per IP
- **OTP Requests**: 3 requests per 5 minutes per IP

### 3. **CORS Configuration**
- **Development**: Allows localhost origins
- **Production**: Configurable domain restrictions
- **Credentials**: Supports authenticated requests

### 4. **Input Validation**
- **Express-Validator**: Comprehensive request validation
- **Email Validation**: Proper email format checking
- **Data Sanitization**: Prevents injection attacks

### 5. **Session Management**
- **Database Storage**: Sessions stored in SQLite
- **Secure Cookies**: HttpOnly, Secure, SameSite flags
- **Automatic Cleanup**: Expired sessions removed hourly

## 📊 API Endpoints

### Health Check
```http
GET /api/health
```
**Response:**
```json
{
  "status": "ok",
  "timestamp": "2025-07-30T12:05:43.350Z",
  "database": "connected",
  "uptime": 8.249942709
}
```

### Authentication

#### Check Client Authentication
```http
POST /api/check-auth
Content-Type: application/json

{
  "email": "user@example.com",
  "deviceId": "device123"
}
```

#### Admin Login
```http
POST /api/admin/login
Content-Type: application/json

{
  "username": "admin",
  "password": "admin"
}
```

#### Admin Logout
```http
POST /api/admin/logout
```

#### Check Admin Authentication
```http
GET /api/admin/check-auth
```

### OTP Management

#### Request OTP
```http
POST /api/request-otp
Content-Type: application/json

{
  "email": "user@example.com"
}
```

#### Verify OTP
```http
POST /api/verify-otp
Content-Type: application/json

{
  "email": "user@example.com",
  "otp": "123456",
  "deviceId": "device123"
}
```

### Ticket Management

#### Get All Tickets
```http
GET /api/tickets
```

#### Create Ticket
```http
POST /api/tickets
Content-Type: application/json

{
  "subject": "Network Issue",
  "description": "Cannot connect to internet",
  "email": "user@example.com",
  "requester": "John Doe",
  "category": "network",
  "priority": "high"
}
```

#### Update Ticket
```http
PUT /api/tickets/:id
Content-Type: application/json

{
  "subject": "Updated Subject",
  "status": "in-progress",
  "priority": "medium"
}
```

#### Add Timeline Entry
```http
POST /api/tickets/:id/timeline
Content-Type: application/json

{
  "content": "Working on the issue",
  "author": "Agent Name",
  "authorType": "agent",
  "entryType": "note"
}
```

### Asset Management

#### Get All Assets
```http
GET /api/assets
```

#### Create Asset
```http
POST /api/assets
Content-Type: application/json

{
  "assetNo": "A-003",
  "assetTag": "TAG-003",
  "type": "laptop",
  "brand": "Dell",
  "model": "Latitude",
  "serial": "SN789012",
  "email": "user@example.com",
  "department": "IT",
  "status": "active"
}
```

#### Update Asset
```http
PUT /api/assets/:id
Content-Type: application/json

{
  "status": "maintenance",
  "comment": "Under repair"
}
```

#### Delete Asset
```http
DELETE /api/assets/:id
```

### Dashboard

#### Get Dashboard Statistics
```http
GET /api/dashboard/stats
```
**Response:**
```json
{
  "totalTickets": 4,
  "openTickets": 4,
  "closedToday": 0,
  "totalAssets": 3
}
```

## 🔧 Configuration

### Environment Variables
```bash
# Server Configuration
NODE_ENV=production
PORT=3000

# SMTP Configuration
SMTP_HOST=smtp.example.com
SMTP_PORT=587
SMTP_USER=your_email@example.com
SMTP_PASS=your_password
SMTP_FROM=support@example.com

# CORS Configuration (Production)
ALLOWED_ORIGINS=https://yourdomain.com
```

### Rate Limiting Configuration
```javascript
// General API requests
const generalLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  limit: 100, // 100 requests per window
});

// Authentication requests
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  limit: 5, // 5 attempts per window
});

// OTP requests
const otpLimiter = rateLimit({
  windowMs: 5 * 60 * 1000, // 5 minutes
  limit: 3, // 3 requests per window
});
```

## 🚀 Getting Started

### 1. Install Dependencies
```bash
npm install helmet express-rate-limit cors express-validator morgan
```

### 2. Set Up Environment
```bash
cp .env.example .env
# Edit .env with your configuration
```

### 3. Start the Server
```bash
# Development
node server-enhanced.js

# Production
NODE_ENV=production node server-enhanced.js
```

### 4. Test the Server
```bash
# Health check
curl -k https://localhost:3000/api/health

# Test rate limiting
for i in {1..6}; do 
  curl -k https://localhost:3000/api/admin/login \
    -X POST \
    -H "Content-Type: application/json" \
    -d '{"username":"test","password":"test"}'
done
```

## 📝 Logging

### Access Logs
- **Development**: Console output
- **Production**: File-based logging to `logs/access.log`

### Error Logging
- **Development**: Full error details with stack traces
- **Production**: Sanitized error messages

### Database Logging
- Connection status
- Query performance
- Error tracking

## 🔒 Security Best Practices

### 1. **Input Validation**
- All user inputs are validated and sanitized
- SQL injection prevention through parameterized queries
- XSS prevention through content security policy

### 2. **Authentication**
- Secure session management
- Rate limiting on authentication endpoints
- OTP-based client authentication

### 3. **Data Protection**
- HTTPS enforcement
- Secure cookie configuration
- Database encryption (SQLite with WAL mode)

### 4. **Monitoring**
- Request logging
- Error tracking
- Performance monitoring
- Database health checks

## 🧪 Testing

### Manual Testing
```bash
# Test health endpoint
curl -k https://localhost:3000/api/health

# Test tickets API
curl -k https://localhost:3000/api/tickets

# Test assets API
curl -k https://localhost:3000/api/assets

# Test rate limiting
for i in {1..6}; do 
  curl -k https://localhost:3000/api/admin/login \
    -X POST \
    -H "Content-Type: application/json" \
    -d '{"username":"test","password":"test"}'
done
```

### Automated Testing
```bash
# Run tests (when implemented)
npm test
```

## 📊 Performance

### Database Optimization
- **Indexed Queries**: Fast lookups on frequently accessed fields
- **WAL Mode**: Better concurrency for multiple users
- **Prepared Statements**: Faster query execution
- **Connection Pooling**: Efficient database connections

### Caching Strategy
- **Session Caching**: In-memory session storage
- **Query Caching**: Database query optimization
- **Static File Caching**: Proper cache headers

## 🔄 Migration from Original Server

### Key Changes
1. **Security Enhancements**: Added Helmet, rate limiting, CORS
2. **Database Integration**: Replaced JSON file storage with SQLite
3. **Input Validation**: Added comprehensive request validation
4. **Error Handling**: Improved error handling and logging
5. **API Structure**: Better organized API endpoints

### Backward Compatibility
- All existing API endpoints maintained
- Same request/response formats
- Gradual migration path available

## 🚨 Error Handling

### HTTP Status Codes
- **200**: Success
- **400**: Bad Request (validation errors)
- **401**: Unauthorized (authentication required)
- **404**: Not Found
- **429**: Too Many Requests (rate limiting)
- **500**: Internal Server Error

### Error Response Format
```json
{
  "error": "Error message",
  "details": "Detailed error information",
  "stack": "Stack trace (development only)"
}
```

## 📈 Monitoring and Maintenance

### Health Checks
- Database connectivity
- Server uptime
- API response times
- Error rates

### Maintenance Tasks
- **Hourly**: Clean up expired sessions and OTPs
- **Daily**: Database backup
- **Weekly**: Log rotation
- **Monthly**: Security updates

## 🔧 Troubleshooting

### Common Issues

#### 1. Port Already in Use
```bash
# Kill existing processes
lsof -ti:3000 | xargs kill -9
```

#### 2. Database Connection Issues
```bash
# Check database file
ls -la database/it_support.db

# Test database connection
node -e "const db = require('./database/db'); console.log(db.healthCheck());"
```

#### 3. SSL Certificate Issues
```bash
# Check SSL files
ls -la ssl/

# Generate new certificates
./generate-ssl.sh
```

#### 4. Rate Limiting Issues
```bash
# Check rate limit headers
curl -I -k https://localhost:3000/api/tickets
```

## 📚 Additional Resources

- [Express.js Documentation](https://expressjs.com/)
- [Helmet.js Documentation](https://helmetjs.github.io/)
- [Express Rate Limit Documentation](https://github.com/nfriedly/express-rate-limit)
- [Express Validator Documentation](https://express-validator.github.io/)
- [SQLite Documentation](https://www.sqlite.org/docs.html)

## 🤝 Contributing

1. Follow security best practices
2. Add comprehensive tests
3. Update documentation
4. Use proper error handling
5. Follow the existing code style

## 📄 License

This project is licensed under the MIT License. 