const mongoose = require('mongoose');

const liveDataSchema = new mongoose.Schema(
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
      trim: true,
    },
    flowRate: {
      type: Number,
      required: true,
      min: [0, 'Flow rate cannot be negative'],
    },
    totalizer: {
      type: Number,
      required: true,
      min: [0, 'Totalizer cannot be negative'],
    },
    timestamp: {
      type: Date,
      required: true,
      default: Date.now,
    },
  },
  { versionKey: false }
);

// Compound indexes for efficient time-series queries
liveDataSchema.index({ tankId: 1, timestamp: -1 });
liveDataSchema.index({ deviceId: 1, timestamp: -1 });

// TTL index — MongoDB auto-deletes documents after 24 hours
liveDataSchema.index(
  { timestamp: 1 },
  { expireAfterSeconds: 86400, name: 'ttl_live_data_24h' }
);

module.exports = mongoose.model('LiveData', liveDataSchema, 'live_data');
