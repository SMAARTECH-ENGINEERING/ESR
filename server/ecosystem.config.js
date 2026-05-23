module.exports = {
  apps: [
    {
      name: 'esr-tank-api',
      script: 'server.js',

      // Cluster mode uses all available CPU cores
      instances:  'max',
      exec_mode:  'cluster',

      watch:               false,
      max_memory_restart:  '500M',

      // Environment configs
      env: {
        NODE_ENV: 'development',
        PORT:     5000,
      },
      env_production: {
        NODE_ENV: 'production',
        PORT:     5000,
      },

      // Log configuration
      error_file:      './logs/pm2-error.log',
      out_file:        './logs/pm2-out.log',
      log_file:        './logs/pm2-combined.log',
      time:            true,
      merge_logs:      true,
      log_date_format: 'YYYY-MM-DD HH:mm:ss',

      // Restart policy
      restart_delay:  4000,
      max_restarts:   10,
      min_uptime:     '10s',

      // Graceful shutdown
      kill_timeout:          5000,
      listen_timeout:        3000,
      shutdown_with_message: true,
    },
  ],
};
