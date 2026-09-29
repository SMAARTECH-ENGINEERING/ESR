const cron = require('node-cron');
const { getIwcrcmService } = require('../integrations/iwcrcm/iwcrcm.service');
const { isValidInterval } = require('../integrations/iwcrcm/iwcrcm.config');
const logger = require('../config/logger');

// ─── IWCRCM transmission scheduler ────────────────────────────────────────────
// Independent of device ingestion (devices keep reporting every 60s as before).
// Ticks every minute:
//   • once per IWCRCM_SEND_INTERVAL_MINUTES slot → queue the latest reading per tank
//   • every tick → send queued/retry-due readings (bounded batch)
// Safe under PM2 cluster mode: slots are unique per tank and records are
// claimed atomically, so each reading is sent by exactly one process.

const startIwcrcmJob = () => {
  const service = getIwcrcmService();
  const { config, configIssues } = service;

  if (!config.enabled) {
    logger.info('IWCRCM integration disabled (IWCRCM_ENABLED=false)');
    return null;
  }
  if (!isValidInterval(config.sendIntervalMinutes)) {
    logger.error(`IWCRCM integration NOT started: invalid IWCRCM_SEND_INTERVAL_MINUTES=${config.sendIntervalMinutes}`);
    return null;
  }
  if (configIssues.length) {
    logger.warn('IWCRCM configuration incomplete — readings will be QUEUED but NOT SENT until resolved:');
    configIssues.forEach((issue) => logger.warn(`  • ${issue}`));
  }

  let running = false;
  const task = cron.schedule('* * * * *', async () => {
    if (running) return; // previous tick still sending
    running = true;
    try {
      await service.tick();
    } catch (error) {
      logger.error(`IWCRCM scheduler tick failed: ${error.message}`);
    } finally {
      running = false;
    }
  }, { name: 'iwcrcm-transmission', scheduled: true });

  logger.info(`Cron job registered: [iwcrcm-transmission every ${config.sendIntervalMinutes}min]`);
  return task;
};

module.exports = { startIwcrcmJob };
