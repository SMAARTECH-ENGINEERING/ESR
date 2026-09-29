const mongoose = require('mongoose');

// Outbox of readings to transmit to IWCRCM — one per tank per send interval.
// Holds a snapshot of the reading (never the auth key), so local data is
// preserved and can be retried even after live_data (24h TTL) has expired.
//
// Status lifecycle:
//   PENDING → SENT (in flight, claimed by one process) → SUCCESS
//                                                      ↘ PENDING (retry scheduled)
//                                                      ↘ FAILED  (permanent / attempts exhausted)
const STATUSES = ['PENDING', 'SENT', 'SUCCESS', 'FAILED'];

const iwcrcmTransmissionSchema = new mongoose.Schema(
  {
    tankId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Tank',
      required: true,
    },
    iwcrcmDeviceId: { type: String, required: true, uppercase: true },

    // Start of the send interval this reading represents (local-time aligned)
    slotStart: { type: Date, required: true },

    // Reading snapshot mapped to IWCRCM fields (no `key`)
    snapshot: {
      id:   { type: String, required: true },
      loc:  { type: String, required: true },
      ts:   { type: Number, required: true },
      flow: { type: Number, required: true },
      qty:  { type: Number, required: true },
      roll: { type: Number, required: true },
      _id:  false,
    },

    status:         { type: String, enum: STATUSES, default: 'PENDING' },
    attempts:       { type: Number, default: 0 },
    nextAttemptAt:  { type: Date, default: Date.now },
    lockedUntil:    { type: Date, default: null },
    lastAttemptAt:  { type: Date, default: null },
    succeededAt:    { type: Date, default: null },
    lastHttpStatus: { type: Number, default: null },
    lastErrorKind:  { type: String, default: null },
    lastError:      { type: String, default: null },

    createdAt: { type: Date, default: Date.now },
  },
  { versionKey: false, timestamps: false }
);

// Local idempotency: a slot can only be enqueued once per tank, even when
// several PM2 instances run the scheduler at the same moment.
iwcrcmTransmissionSchema.index({ tankId: 1, slotStart: 1 }, { unique: true, name: 'uniq_tank_slot' });
iwcrcmTransmissionSchema.index({ status: 1, nextAttemptAt: 1 });
iwcrcmTransmissionSchema.index({ iwcrcmDeviceId: 1, slotStart: -1 });

// Retention TTL index on `createdAt` is managed in src/config/retention.js

module.exports = mongoose.model('IwcrcmTransmission', iwcrcmTransmissionSchema, 'iwcrcm_transmissions');
module.exports.STATUSES = STATUSES;
