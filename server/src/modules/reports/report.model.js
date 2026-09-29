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

// Retention TTL index on `createdAt` (DATA_RETENTION_DAYS, default 120) is
// managed in src/config/retention.js — not declared here, because Mongoose
// autoIndex cannot change expireAfterSeconds on an existing index.

module.exports = mongoose.model('ReportData', reportDataSchema, 'report_data');
