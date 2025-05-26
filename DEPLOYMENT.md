# Cloud Accounting App - DigitalOcean Deployment Guide

This guide provides step-by-step instructions for deploying the Cloud Accounting application to a DigitalOcean Droplet.

## Prerequisites

- A DigitalOcean account
- Basic knowledge of Linux command line
- A domain name (optional but recommended)

## Deployment Steps

### 1. Create a DigitalOcean Droplet

1. Sign in to your DigitalOcean account
2. Click "Create" and select "Droplets"
3. Choose Ubuntu 22.04 LTS
4. Select a plan (Basic is fine, with at least 2GB RAM)
5. Choose a datacenter region close to your users
6. Add your SSH key or create a password
7. Click "Create Droplet"

### 2. Connect to Your Droplet

```bash
ssh root@your_droplet_ip
```

### 3. Upload the Application Files

Upload the zip file to your droplet:

```bash
# On your local machine:
scp cloud-accounting-deploy.zip root@your_droplet_ip:~
```

### 4. Run the Deployment Script

```bash
# On your droplet:
unzip cloud-accounting-deploy.zip
cd cloud-accounting-deploy
chmod +x deploy.sh
./deploy.sh
```

The deployment script will:
- Update system packages
- Install Node.js, PostgreSQL, and Nginx
- Set up the database
- Configure environment variables
- Install dependencies
- Set up Nginx as a reverse proxy
- Start the application with PM2

### 5. Set Up SSL (Recommended)

```bash
apt install -y certbot python3-certbot-nginx
certbot --nginx -d your-domain.com
```

### 6. Secure Your Server

```bash
ufw allow 'Nginx Full'
ufw allow OpenSSH
ufw enable
```

## Configuration Files

### Environment Variables (.env)

The application uses the following environment variables:

```
PORT=3000
NODE_ENV=production
DB_HOST=localhost
DB_PORT=5432
DB_NAME=cloud_accounting
DB_USER=dbuser
DB_PASSWORD=secure_password
DB_SSL=false
JWT_SECRET=your_secure_jwt_secret
JWT_REFRESH_SECRET=your_secure_refresh_secret
```

### Nginx Configuration

The Nginx configuration file is set up to:
- Serve the frontend static files
- Proxy API requests to the Node.js backend

## Troubleshooting

### Database Connection Issues

If you encounter database connection issues:

1. Check PostgreSQL is running:
   ```bash
   systemctl status postgresql
   ```

2. Verify database user and permissions:
   ```bash
   sudo -u postgres psql -c "\du"
   sudo -u postgres psql -c "\l"
   ```

### Application Not Starting

If the application doesn't start:

1. Check PM2 logs:
   ```bash
   pm2 logs
   ```

2. Verify environment variables:
   ```bash
   cat /var/www/cloud-accounting/.env
   ```

### Nginx Issues

If Nginx isn't serving the application:

1. Check Nginx configuration:
   ```bash
   nginx -t
   ```

2. Check Nginx logs:
   ```bash
   tail -f /var/log/nginx/error.log
   ```

## Maintenance

### Updating the Application

To update the application:

1. Upload new files to the server
2. Replace files in `/var/www/cloud-accounting/`
3. Restart the application:
   ```bash
   cd /var/www/cloud-accounting
   npm install
   pm2 restart cloud-accounting
   ```

### Database Backups

To backup the database:

```bash
pg_dump -U dbuser -d cloud_accounting > backup.sql
```

To restore from backup:

```bash
psql -U dbuser -d cloud_accounting < backup.sql
```
