const logger = require('./logger');

// ─── Historical data retention ────────────────────────────────────────────────
// Single source of truth for how long high-volume IoT history is kept.
// Applies ONLY to the collections registered in getRetentionTargets() —
// never to users, tanks, IWCRCM credentials or other master/config data.

const DEFAULT_RETENTION_DAYS = 120;
const SECONDS_PER_DAY = 24 * 60 * 60;

const getRetentionDays = (env = process.env) => {
  const raw = env.DATA_RETENTION_DAYS;
  if (raw === undefined || raw === '') return DEFAULT_RETENTION_DAYS;

  const days = Number(raw);
  if (!Number.isInteger(days) || days < 1) {
    logger.warn(`Invalid DATA_RETENTION_DAYS="${raw}" — falling back to ${DEFAULT_RETENTION_DAYS}`);
    return DEFAULT_RETENTION_DAYS;
  }
  return days;
};

// 120 days × 24 × 60 × 60 = 10,368,000 seconds
const getRetentionSeconds = (env = process.env) => getRetentionDays(env) * SECONDS_PER_DAY;

// Exact day-based cutoff (not calendar months) so it matches the TTL index
const getRetentionCutoff = (now = new Date(), env = process.env) =>
  new Date(now.getTime() - getRetentionSeconds(env) * 1000);

// Collections subject to retention. Models are required lazily to avoid
// circular imports (models → config → models).
const getRetentionTargets = () => [
  {
    label:       'report_data',
    model:       require('../modules/reports/report.model'),
    field:       'createdAt',
    indexName:   'ttl_report_data_retention',
    legacyNames: ['ttl_report_data_3months'],
  },
  {
    label:       'iwcrcm_transmissions',
    model:       require('../integrations/iwcrcm/iwcrcm.transmission.model'),
    field:       'createdAt',
    indexName:   'ttl_iwcrcm_transmissions_retention',
    legacyNames: [],
  },
];

const isIndexNotFound = (err) => err && (err.code === 27 || err.codeName === 'IndexNotFound');
const isNamespaceNotFound = (err) => err && (err.code === 26 || err.codeName === 'NamespaceNotFound');

/**
 * Make sure `collection` has exactly one TTL index on `field` with the wanted
 * expireAfterSeconds. Uses dropIndex + createIndex (both allowed for the
 * Atlas readWrite role) instead of collMod (needs dbAdmin).
 * Safe to run concurrently from several PM2 instances.
 */
const ensureTtlIndex = async (collection, { field, indexName, legacyNames = [], seconds }) => {
  let indexes = [];
  try {
    indexes = await collection.indexes();
  } catch (err) {
    if (!isNamespaceNotFound(err)) throw err; // collection not created yet → nothing to drop
  }

  const sameKey = (idx) => {
    const keys = Object.keys(idx.key || {});
    return keys.length === 1 && keys[0] === field;
  };

  const toDrop = indexes.filter((idx) =>
    legacyNames.includes(idx.name) ||
    (idx.name !== '_id_' && sameKey(idx) &&
      (idx.name !== indexName || idx.expireAfterSeconds !== seconds))
  );

  const alreadyCorrect = indexes.some((idx) =>
    idx.name === indexName && sameKey(idx) && idx.expireAfterSeconds === seconds
  );

  for (const idx of toDrop) {
    try {
      await collection.dropIndex(idx.name);
      logger.info(`Retention: dropped index ${idx.name} (expireAfterSeconds=${idx.expireAfterSeconds ?? 'none'})`);
    } catch (err) {
      if (!isIndexNotFound(err)) throw err; // another instance dropped it first
    }
  }

  if (alreadyCorrect && toDrop.length === 0) return { changed: false };

  await collection.createIndex(
    { [field]: 1 },
    { name: indexName, expireAfterSeconds: seconds }
  );
  logger.info(`Retention: TTL index ${indexName} set to ${seconds}s (${seconds / SECONDS_PER_DAY} days)`);
  return { changed: true };
};

// Called once at startup after the DB connection is ready
const ensureRetentionIndexes = async (targets = getRetentionTargets(), env = process.env) => {
  const seconds = getRetentionSeconds(env);
  for (const t of targets) {
    try {
      await ensureTtlIndex(t.model.collection, { ...t, seconds });
    } catch (err) {
      // Never block server start — the daily cron cleanup still enforces retention
      logger.error(`Retention: failed to ensure TTL index on ${t.label}: ${err.message}`);
    }
  }
};

// Predictable, logged cleanup (belt-and-braces alongside the TTL monitor)
const purgeExpiredData = async (targets = getRetentionTargets(), now = new Date(), env = process.env) => {
  const cutoff = getRetentionCutoff(now, env);
  const results = {};
  for (const t of targets) {
    const res = await t.model.deleteMany({ [t.field]: { $lt: cutoff } });
    results[t.label] = res.deletedCount || 0;
  }
  return { cutoff, results };
};

module.exports = {
  DEFAULT_RETENTION_DAYS,
  getRetentionDays,
  getRetentionSeconds,
  getRetentionCutoff,
  getRetentionTargets,
  ensureTtlIndex,
  ensureRetentionIndexes,
  purgeExpiredData,
};
