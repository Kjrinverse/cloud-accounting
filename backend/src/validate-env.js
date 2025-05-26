// Environment variable validation
const requiredVars = [
  'DB_HOST',
  'DB_NAME',
  'DB_USER',
  'DB_PASSWORD',
  'JWT_SECRET'
];

function validateEnv() {
  const missing = [];
  
  for (const varName of requiredVars) {
    if (!process.env[varName]) {
      missing.push(varName);
    }
  }
  
  if (missing.length > 0) {
    console.error('ERROR: Missing required environment variables:', missing.join(', '));
    console.error('Application may not function correctly without these variables.');
    return false;
  }
  
  console.log('All required environment variables are set');
  return true;
}

module.exports = validateEnv;
