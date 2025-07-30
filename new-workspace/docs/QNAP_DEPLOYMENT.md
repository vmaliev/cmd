# QNAP TS-233 Container Station Deployment Guide

## 🏠 **QNAP NAS Deployment for IT Support System**

This guide will help you deploy the IT Support System on your QNAP TS-233 NAS using Container Station.

## 📋 **Prerequisites**

### **QNAP Requirements:**
- ✅ QNAP TS-233 NAS
- ✅ Container Station installed
- ✅ At least 2GB RAM available
- ✅ 5GB free storage space
- ✅ QNAP firmware 4.5.0 or later

### **Network Requirements:**
- ✅ Static IP for your NAS (recommended)
- ✅ Port 3000 and 443 accessible
- ✅ SMTP credentials (Mailjet or other provider)

## 🚀 **Deployment Steps**

### **Step 1: Prepare Your QNAP NAS**

1. **Access QNAP QTS:**
   ```
   http://your-nas-ip:8080
   ```

2. **Install Container Station:**
   - Go to App Center
   - Search for "Container Station"
   - Install and launch

3. **Create Application Directory:**
   ```bash
   # SSH into your NAS or use File Station
   mkdir -p /share/Container/it-support-system
   cd /share/Container/it-support-system
   ```

### **Step 2: Upload Application Files**

1. **Upload via File Station:**
   - Open File Station in QTS
   - Navigate to `/share/Container/it-support-system`
   - Upload all project files

2. **Or via SCP/SSH:**
   ```bash
   scp -r ./your-project-folder admin@your-nas-ip:/share/Container/it-support-system/
   ```

### **Step 3: Configure Environment**

1. **Create Environment File:**
   ```bash
   # Create .env file
   nano /share/Container/it-support-system/.env
   ```

2. **Add Your Configuration:**
   ```env
   NODE_ENV=production
   PORT=3000
   SMTP_HOST=in-v3.mailjet.com
   SMTP_PORT=587
   SMTP_USER=your_mailjet_api_key
   SMTP_PASS=your_mailjet_secret_key
   SMTP_FROM=your_verified_email@domain.com
   ```

3. **Create SSL Directory:**
   ```bash
   mkdir -p /share/Container/it-support-system/ssl
   ```

### **Step 4: Build and Deploy**

#### **Option A: Using Container Station GUI**

1. **Open Container Station:**
   - Launch Container Station from QTS

2. **Create Application:**
   - Click "Create" → "Application"
   - Choose "Compose File"
   - Upload `docker-compose.yml`

3. **Configure Settings:**
   - Set container name: `it-support-system`
   - Enable auto-restart
   - Set resource limits (recommended: 512MB RAM, 1 CPU)

4. **Deploy:**
   - Click "Create" to start deployment

#### **Option B: Using SSH/Command Line**

1. **SSH into QNAP:**
   ```bash
   ssh admin@your-nas-ip
   ```

2. **Navigate to Project:**
   ```bash
   cd /share/Container/it-support-system
   ```

3. **Build and Run:**
   ```bash
   # Build the image
   docker-compose build

   # Start the service
   docker-compose up -d

   # Check status
   docker-compose ps
   ```

### **Step 5: Configure SSL (Optional)**

1. **Generate SSL Certificates:**
   ```bash
   cd /share/Container/it-support-system/ssl
   ./generate-ssl.sh
   ```

2. **Or Use Your Own Certificates:**
   - Place your `cert.pem` and `key.pem` in the `ssl/` directory

### **Step 6: Access Your Application**

1. **Local Access:**
   ```
   http://your-nas-ip:3000
   https://your-nas-ip:443
   ```

2. **External Access (if configured):**
   ```
   http://your-domain:3000
   https://your-domain:443
   ```

## 🔧 **Configuration Options**

### **Port Configuration:**
```yaml
# In docker-compose.yml
ports:
  - "3000:3000"  # HTTP
  - "443:443"    # HTTPS
```

### **Volume Mounts:**
```yaml
volumes:
  - ./data:/app/data        # Persistent data
  - ./ssl:/app/ssl:ro       # SSL certificates
  - ./logs:/app/logs        # Application logs
  - ./.env:/app/.env:ro     # Environment variables
```

### **Resource Limits:**
```yaml
# Add to docker-compose.yml
deploy:
  resources:
    limits:
      memory: 512M
      cpus: '1.0'
    reservations:
      memory: 256M
      cpus: '0.5'
```

## 📊 **Monitoring and Maintenance**

### **Check Container Status:**
```bash
# View running containers
docker ps

# View logs
docker logs it-support-system

# Check resource usage
docker stats it-support-system
```

### **Update Application:**
```bash
# Pull latest changes
git pull

# Rebuild and restart
docker-compose down
docker-compose build --no-cache
docker-compose up -d
```

### **Backup Data:**
```bash
# Backup data directory
tar -czf backup-$(date +%Y%m%d).tar.gz ./data

# Backup entire application
tar -czf app-backup-$(date +%Y%m%d).tar.gz ./
```

## 🔒 **Security Considerations**

### **QNAP Security:**
- ✅ Use strong admin password
- ✅ Enable 2FA for QNAP admin
- ✅ Keep QTS firmware updated
- ✅ Use HTTPS for external access

### **Application Security:**
- ✅ Change default admin credentials
- ✅ Use strong SMTP passwords
- ✅ Regularly update SSL certificates
- ✅ Monitor access logs

## 🆘 **Troubleshooting**

### **Common Issues:**

1. **Container Won't Start:**
   ```bash
   # Check logs
   docker logs it-support-system
   
   # Check port conflicts
   netstat -tulpn | grep :3000
   ```

2. **SSL Certificate Issues:**
   ```bash
   # Regenerate certificates
   cd ssl && ./generate-ssl.sh
   
   # Check certificate permissions
   chmod 600 ssl/*.pem
   ```

3. **Email Not Working:**
   - Verify SMTP credentials in `.env`
   - Check firewall settings
   - Test SMTP connection

4. **Performance Issues:**
   - Increase container memory limit
   - Check NAS resource usage
   - Optimize database queries

### **Support Commands:**
```bash
# Restart container
docker-compose restart

# View real-time logs
docker-compose logs -f

# Access container shell
docker exec -it it-support-system sh

# Check disk usage
df -h /share/Container/it-support-system
```

## 📞 **Support**

If you encounter issues:
1. Check the troubleshooting section above
2. Review container logs: `docker logs it-support-system`
3. Verify QNAP system logs in QTS
4. Ensure all prerequisites are met

## 🎯 **Next Steps**

After successful deployment:
1. ✅ Configure your SMTP settings
2. ✅ Set up SSL certificates
3. ✅ Create admin account
4. ✅ Test all features
5. ✅ Set up regular backups
6. ✅ Configure monitoring

Your IT Support System is now running on your QNAP TS-233 NAS! 🎉 