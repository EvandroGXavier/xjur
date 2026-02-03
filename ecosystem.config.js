module.exports = {
  apps: [
    {
      name: 'drx-api',
      script: '/www/wwwroot/DrX/apps/api/dist/apps/api/src/main.js',
      cwd: '/www/wwwroot/DrX/apps/api',
      instances: 1,
      autorestart: true,
      watch: false,
      max_memory_restart: '1G',
      env: {
        NODE_ENV: 'production'
      }
    }
  ]
};
