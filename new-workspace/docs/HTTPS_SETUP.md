# HTTPS Setup Guide

This application now runs with HTTPS support for enhanced security.

## Quick Start

1. **Generate SSL Certificates** (first time only):
   ```bash
   ./generate-ssl.sh
   ```

2. **Start the Server**:
   ```bash
   node server.js
   ```

3. **Access the Application**:
   - Admin Panel: https://localhost:3000
   - Client Portal: https://localhost:3000/client
   - Login Page: https://localhost:3000/login

## SSL Certificate Details

- **Type**: Self-signed certificate (for development)
- **Validity**: 365 days
- **Key Size**: 4096 bits RSA
- **Location**: `ssl/cert.pem` and `ssl/key.pem`

## Browser Security Warning

When accessing the application for the first time, your browser will show a security warning because we're using a self-signed certificate. This is normal for development environments.

### To Accept the Certificate:

**Chrome/Edge:**
1. Click "Advanced"
2. Click "Proceed to localhost (unsafe)"

**Firefox:**
1. Click "Advanced"
2. Click "Accept the Risk and Continue"

**Safari:**
1. Click "Show Details"
2. Click "visit this website"
3. Click "Visit Website" in the popup

## Production Deployment

For production deployment, replace the self-signed certificates with certificates from a trusted Certificate Authority (CA) like Let's Encrypt.

### Environment Variables

The following environment variables are used for email functionality:
- `SMTP_HOST`: SMTP server hostname
- `SMTP_PORT`: SMTP server port
- `SMTP_USER`: SMTP username/API key
- `SMTP_PASS`: SMTP password/secret key
- `SMTP_FROM`: From email address

## Security Features

- ✅ **HTTPS Encryption**: All traffic encrypted
- ✅ **Secure Cookies**: Admin sessions use secure cookies
- ✅ **HTTP-Only Cookies**: Prevents XSS attacks
- ✅ **Session Management**: 24-hour session expiry
- ✅ **Admin Authentication**: Username: admin, Password: admin

## Troubleshooting

### Certificate Errors
If you see certificate errors:
1. Make sure SSL certificates exist in the `ssl/` directory
2. Run `./generate-ssl.sh` to regenerate certificates
3. Clear browser cache and try again

### Port Issues
If port 3000 is in use:
1. Stop other Node.js processes: `pkill -f "node server.js"`
2. Or change the port in `server.js`

### Permission Issues
If you can't bind to port 443:
- The server will still work on port 3000
- Port 443 requires root privileges on some systems 