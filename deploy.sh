#!/bin/bash

# DigitalOcean Deployment Script for Cloud Accounting App
# This script automates the deployment process on a fresh DigitalOcean droplet

# Exit on error
set -e

echo "=== Cloud Accounting Deployment Script ==="
echo "This script will set up your DigitalOcean droplet for the Cloud Accounting application"

# Update system
echo "=== Updating system packages ==="
apt update && apt upgrade -y

# Install dependencies
echo "=== Installing dependencies ==="
apt install -y curl git nginx postgresql postgresql-contrib

# Install Node.js
echo "=== Installing Node.js ==="
curl -fsSL https://deb.nodesource.com/setup_18.x | bash -
apt install -y nodejs

# Install PM2 for process management
echo "=== Installing PM2 ==="
npm install -g pm2

# Set up PostgreSQL
echo "=== Setting up PostgreSQL database ==="
sudo -u postgres psql -c "CREATE DATABASE cloud_accounting;"
sudo -u postgres psql -c "CREATE USER dbuser WITH ENCRYPTED PASSWORD 'secure_password';"
sudo -u postgres psql -c "GRANT ALL PRIVILEGES ON DATABASE cloud_accounting TO dbuser;"

# Create application directory
echo "=== Setting up application directory ==="
mkdir -p /var/www/cloud-accounting
cp -r ./* /var/www/cloud-accounting/
cd /var/www/cloud-accounting

# Set up environment variables
echo "=== Configuring environment variables ==="
cp .env.example .env
sed -i 's/DB_USER=postgres/DB_USER=dbuser/g' .env
sed -i 's/DB_PASSWORD=postgres/DB_PASSWORD=secure_password/g' .env
sed -i 's/NODE_ENV=development/NODE_ENV=production/g' .env

# Install backend dependencies
echo "=== Installing backend dependencies ==="
npm install

# Set up Nginx
echo "=== Configuring Nginx ==="
cp nginx.conf /etc/nginx/sites-available/cloud-accounting
ln -sf /etc/nginx/sites-available/cloud-accounting /etc/nginx/sites-enabled/
nginx -t
systemctl restart nginx

# Start application with PM2
echo "=== Starting application with PM2 ==="
pm2 start src/server.js --name "cloud-accounting"
pm2 save
pm2 startup

echo "=== Deployment complete! ==="
echo "Your Cloud Accounting application is now running."
echo "Access it at: http://$(curl -s ifconfig.me)"
echo ""
echo "Next steps:"
echo "1. Set up SSL with Let's Encrypt (recommended):"
echo "   apt install -y certbot python3-certbot-nginx"
echo "   certbot --nginx -d your-domain.com"
echo ""
echo "2. Update your domain DNS to point to this server"
echo ""
echo "3. Secure your server with UFW:"
echo "   ufw allow 'Nginx Full'"
echo "   ufw allow OpenSSH"
echo "   ufw enable"
