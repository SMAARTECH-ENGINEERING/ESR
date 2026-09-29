const cron = require('node-cron');
const Tank = require('../modules/tanks/tank.model');
const { emitTankStatusChange } = require('../config/socket');
const { getRetentionDays, purgeExpiredData } = require('../config/retention');
const { saveReportSnapshot } = require('../modules/reports/report.service');
const logger = require('../config/logger');

const startCleanupJobs = () => {

  // ── Job 1: Online / Offline status check — every 1 minute ──────────────────
  // If a tank hasn't sent data for 5 minutes, mark it offline
  cron.schedule('* * * * *', async () => {
    try {
      const fiveMinutesAgo = new Date(Date.now() - 5 * 60 * 1000);

      const staleTanks = await Tank.find({
        status:   'online',
        lastSeen: { $lt: fiveMinutesAgo },
      }).lean();

      for (const tank of staleTanks) {
        await Tank.findByIdAndUpdate(tank._id, { status: 'offline' });
        emitTankStatusChange(tank._id.toString(), 'offline', tank.tankName);
        logger.warn(`Tank [${tank.tankName}] marked OFFLINE (no data for >5 min)`);
      }
    } catch (error) {
      logger.error('Status-check job error:', error);
    }
  }, { name: 'tank-status-check', scheduled: true });

  // ── Job 2: 30-minute report snapshot ───────────────────────────────────────
  // Saves the latest live reading of every online tank for reporting
  cron.schedule('*/30 * * * *', async () => {
    logger.info('Running 30-minute report snapshot...');
    await saveReportSnapshot();
  }, { name: 'report-snapshot', scheduled: true });

  // ── Job 3: Delete history older than DATA_RETENTION_DAYS — daily at midnight ─
  // Belt-and-suspenders alongside the MongoDB TTL indexes (see config/retention)
  cron.schedule('0 0 * * *', async () => {
    try {
      logger.info(`Running ${getRetentionDays()}-day history cleanup...`);
      const { results } = await purgeExpiredData();

      for (const [collection, deleted] of Object.entries(results)) {
        if (deleted > 0) logger.info(`Cleanup: deleted ${deleted} old ${collection} record(s)`);
      }
    } catch (error) {
      logger.error('History cleanup job error:', error);
    }
  }, { name: 'report-cleanup', scheduled: true });

  logger.info('Cron jobs registered: [status-check 1min] [report-snapshot 30min] [report-cleanup daily]');
};

module.exports = { startCleanupJobs };
