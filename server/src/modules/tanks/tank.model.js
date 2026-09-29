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
    // Optional IWCRCM (Industrial Water Consumption and Revenue Monitoring)
    // mapping. deviceId is the department-issued IWCRCM id, which may differ
    // from the local deviceId above. Coordinates are fixed per tank because
    // the meters have no GPS.
    iwcrcm: {
      enabled:   { type: Boolean, default: false },
      deviceId:  {
        type: String,
        trim: true,
        uppercase: true,
        match: [/^[A-Z0-9]{1,11}$/, 'IWCRCM device ID must be 1-11 characters [A-Z0-9]'],
      },
      longitude: { type: Number, min: -180, max: 180 },
      latitude:  { type: Number, min: -90,  max: 90 },
      _id: false,
    },
  },
  { timestamps: true, versionKey: false }
);

tankSchema.index({ status: 1 });
tankSchema.index({ lastSeen: -1 });
// Each IWCRCM device id may belong to one tank only (so device data never mixes)
tankSchema.index(
  { 'iwcrcm.deviceId': 1 },
  { unique: true, partialFilterExpression: { 'iwcrcm.deviceId': { $type: 'string' } }, name: 'uniq_iwcrcm_device_id' }
);
tankSchema.index({ 'iwcrcm.enabled': 1 });

module.exports = mongoose.model('Tank', tankSchema);
