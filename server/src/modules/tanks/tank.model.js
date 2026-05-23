const mongoose = require('mongoose');

const tankSchema = new mongoose.Schema(
  {
    tankName: {
      type: String,
      required: [true, 'Tank name is required'],
      unique: true,
      trim: true,
      minlength: [2, 'Tank name must be at least 2 characters'],
      maxlength: [100, 'Tank name cannot exceed 100 characters'],
    },
    deviceId: {
      type: String,
      required: [true, 'Device ID is required'],
      unique: true,
      trim: true,
      uppercase: true,
    },
    location: {
      type: String,
      required: [true, 'Location is required'],
      trim: true,
      maxlength: [200, 'Location cannot exceed 200 characters'],
    },
    status: {
      type: String,
      enum: {
        values: ['online', 'offline', 'inactive'],
        message: "Status must be 'online', 'offline', or 'inactive'",
      },
      default: 'inactive',
    },
    lastSeen: {
      type: Date,
      default: null,
    },
  },
  { timestamps: true, versionKey: false }
);

tankSchema.index({ status: 1 });
tankSchema.index({ lastSeen: -1 });

module.exports = mongoose.model('Tank', tankSchema);
