const mongoose = require('mongoose');

const reportDataSchema = new mongoose.Schema(
  {
    tankId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Tank',
      required: true,
    },
    deviceId: {
      type: String,
      required: true,
      uppercase: true,
    },
    flowRate: {
      type: Number,
      required: true,
      min: 0,
    },
    totalizer: {
      type: Number,
      required: true,
      min: 0,
    },
    // The 30-minute bucket timestamp when this snapshot was taken
    intervalTime: {
      type: Date,
      required: true,
    },
    createdAt: {
      type: Date,
      default: Date.now,
    },
  },
  { versionKey: false, timestamps: false }
);

// Indexes for fast report aggregation queries
reportDataSchema.index({ tankId: 1, createdAt: -1 });
reportDataSchema.index({ tankId: 1, intervalTime: -1 });

// TTL safety net: MongoDB auto-deletes records older than 3 months (90 days)
// The cleanup cron job also handles this for predictable timing
reportDataSchema.index(
  { createdAt: 1 },
  { expireAfterSeconds: 7776000, name: 'ttl_report_data_3months' }
);

module.exports = mongoose.model('ReportData', reportDataSchema, 'report_data');
