module.exports = {
  apps: [
    {
      name: 'drx-api',
      script: '/www/wwwroot/DrX/apps/api/dist/main.js',
      cwd: '/www/wwwroot/DrX/apps/api',
      instances: 1,
      autorestart: true,
      watch: false,
      max_memory_restart: '1G',
      env: {
        NODE_ENV: 'production'
      }
    },
    {
      name: 'drx-web',
      script: 'http-server',
      args: 'dist -p 8080 -a 0.0.0.0',
      cwd: '/www/wwwroot/DrX/apps/web',
      instances: 1,
      autorestart: true,
      watch: false
    },
    {
      name: 'drx-studio',
      script: 'npx',
      args: 'prisma studio --port 5555',
      cwd: '/www/wwwroot/DrX/packages/database',
      instances: 1,
      autorestart: true,
      watch: false
    }
  ]
};
