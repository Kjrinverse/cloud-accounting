# Cloud Accounting Application Deployment Guide

This guide provides step-by-step instructions for deploying the Cloud Accounting application in your own environment.

## System Requirements

- Node.js 16+ (recommended: Node.js 18 LTS)
- PostgreSQL 12+
- npm or yarn package manager

## Backend Deployment

### 1. Database Setup

1. Create a PostgreSQL database:
   ```sql
   CREATE DATABASE cloud_accounting;
   ```

2. Create a database user (or use an existing one):
   ```sql
   CREATE USER accounting_user WITH PASSWORD 'your_secure_password';
   GRANT ALL PRIVILEGES ON DATABASE cloud_accounting TO accounting_user;
   ```

### 2. Backend Configuration

1. Navigate to the backend directory:
   ```bash
   cd /path/to/cloud_accounting_app
   ```

2. Install dependencies:
   ```bash
   npm install
   ```

3. Create a `.env` file based on the provided `.env.example`:
   ```bash
   cp .env.example .env
   ```

4. Edit the `.env` file with your database credentials and other settings:
   ```
   PORT=3000
   NODE_ENV=production

   # Database Configuration
   DB_HOST=localhost
   DB_PORT=5432
   DB_NAME=cloud_accounting
   DB_USER=accounting_user
   DB_PASSWORD=your_secure_password

   # JWT Configuration
   JWT_SECRET=generate_a_secure_random_string
   JWT_EXPIRES_IN=1d
   JWT_REFRESH_EXPIRES_IN=7d

   # Logging
   LOG_LEVEL=info

   # API Rate Limiting
   RATE_LIMIT_WINDOW_MS=60000
   RATE_LIMIT_MAX=100
   ```

5. Run database migrations:
   ```bash
   npx knex migrate:latest
   ```

### 3. Start the Backend Server

For development:
```bash
npm run dev
```

For production (using PM2 for process management):
```bash
npm install -g pm2
pm2 start src/index.js --name cloud-accounting-api
```

## Frontend Deployment

### 1. Frontend Configuration

1. Navigate to the frontend directory:
   ```bash
   cd /path/to/cloud_accounting_app/frontend
   ```

2. Install dependencies:
   ```bash
   npm install
   ```

3. Create a `.env` file for the frontend:
   ```
   REACT_APP_API_URL=http://your-backend-domain.com/api/v1
   ```
   
   Note: Replace `http://your-backend-domain.com/api/v1` with your actual backend API URL.

### 2. Build the Frontend

```bash
npm run build
```

### 3. Deploy the Frontend

You can deploy the frontend using various methods:

#### Option 1: Using a static file server (like Nginx)

1. Install Nginx:
   ```bash
   sudo apt update
   sudo apt install nginx
   ```

2. Configure Nginx:
   ```
   server {
       listen 80;
       server_name your-domain.com;
       root /path/to/cloud_accounting_app/frontend/build;
       index index.html;
       
       location / {
           try_files $uri $uri/ /index.html;
       }
       
       location /api {
           proxy_pass http://localhost:3000;
           proxy_http_version 1.1;
           proxy_set_header Upgrade $http_upgrade;
           proxy_set_header Connection 'upgrade';
           proxy_set_header Host $host;
           proxy_cache_bypass $http_upgrade;
       }
   }
   ```

3. Restart Nginx:
   ```bash
   sudo systemctl restart nginx
   ```

#### Option 2: Using a Node.js server

1. Install serve:
   ```bash
   npm install -g serve
   ```

2. Start the server:
   ```bash
   serve -s build -l 3001
   ```

## CORS Configuration

If your frontend and backend are hosted on different domains, ensure the backend CORS configuration is updated to allow requests from your frontend domain:

Edit `src/index.js` and update the CORS configuration:

```javascript
app.use(cors({
  origin: ['https://your-frontend-domain.com', 'http://localhost:3001'],
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization']
}));
```

## Production Considerations

1. **SSL/TLS**: Always use HTTPS in production. You can set up SSL certificates using Let's Encrypt.

2. **Environment Variables**: Never commit sensitive information like API keys or database credentials to your repository.

3. **Database Backups**: Set up regular database backups.

4. **Monitoring**: Implement monitoring for your application using tools like PM2, Prometheus, or commercial services.

5. **Logging**: Configure proper logging for troubleshooting and auditing.

## Troubleshooting

### Common Issues

1. **Database Connection Errors**:
   - Verify database credentials in `.env`
   - Ensure PostgreSQL is running
   - Check network connectivity and firewall settings

2. **CORS Errors**:
   - Verify the CORS configuration includes your frontend domain
   - Check for typos in domain names

3. **JWT Authentication Issues**:
   - Ensure JWT_SECRET is properly set
   - Check token expiration settings

For additional help, refer to the documentation or contact support.
