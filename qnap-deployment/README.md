# IT Support System - QNAP Deployment Package

## 🏠 Quick Start for QNAP TS-233

### 1. Upload to QNAP
Upload this entire folder to your QNAP NAS using File Station or SCP.

### 2. SSH into QNAP
```bash
ssh admin@your-nas-ip
cd /path/to/qnap-deployment
```

### 3. Configure Environment
```bash
cp .env.example .env
nano .env
```
Edit the .env file with your SMTP settings.

### 4. Deploy
```bash
./deploy.sh
```

## 📁 Files Included

- `docker-compose.yml` - Container configuration
- `Dockerfile` - Image build instructions  
- `server.js` - Main application server
- `html.html` - Admin interface
- `client.html` - Client portal
- `login.html` - Admin login page
- `data/` - Persistent data directory
- `ssl/` - SSL certificates
- `.env.example` - Environment configuration template
- `deploy.sh` - Deployment script
- `generate-ssl.sh` - SSL certificate generator

## 🌐 Access URLs

- **Admin Portal:** http://your-nas-ip:3000
- **Client Portal:** http://your-nas-ip:3000/client.html
- **HTTPS:** https://your-nas-ip:443

## 🔧 Configuration

### Required Settings in .env:
- SMTP_HOST (Mailjet: in-v3.mailjet.com)
- SMTP_USER (Your Mailjet API Key)
- SMTP_PASS (Your Mailjet Secret Key)
- SMTP_FROM (Your verified email)

### Default Admin Credentials:
- Username: admin
- Password: admin

## 📊 Management Commands

```bash
# Check status
docker-compose ps

# View logs
docker-compose logs -f

# Restart
docker-compose restart

# Stop
docker-compose down

# Update
git pull && ./deploy.sh
```

## 🆘 Troubleshooting

1. **Port conflicts:** Check if ports 3000/443 are in use
2. **SSL issues:** Run `./generate-ssl.sh` to regenerate certificates
3. **Email not working:** Verify SMTP settings in .env
4. **Container won't start:** Check logs with `docker-compose logs`

## 📖 Detailed Instructions

See QNAP_DEPLOYMENT.md for comprehensive deployment guide.
