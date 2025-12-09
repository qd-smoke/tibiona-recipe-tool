/* eslint-disable @typescript-eslint/no-require-imports */
const fs = require('fs');
const path = require('path');

// Load .env file
const envPath = path.join(__dirname, 'standalone', '.env');
const parsedEnvVars = {};

if (fs.existsSync(envPath)) {
  const envContent = fs.readFileSync(envPath, 'utf8');
  envContent.split('\n').forEach((line) => {
    const trimmed = line.trim();
    if (trimmed && !trimmed.startsWith('#')) {
      const [key, ...valueParts] = trimmed.split('=');
      if (key && valueParts.length > 0) {
        let value = valueParts.join('=').trim();
        // Remove surrounding quotes if present
        if (
          (value.startsWith('"') && value.endsWith('"')) ||
          (value.startsWith("'") && value.endsWith("'"))
        ) {
          value = value.slice(1, -1);
        }
        parsedEnvVars[key.trim()] = value;
      }
    }
  });
}

const envVars = {
  ...process.env,
  ...parsedEnvVars,
};

module.exports = {
  apps: [
    {
      name: 'recipe-tool',
      script: 'standalone/server.js',
      args: '--hostname 0.0.0.0 --port 3000',
      env: envVars,
    },
  ],
};
