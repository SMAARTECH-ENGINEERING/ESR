const mongoose = require('mongoose');

// One document per IWCRCM device id. Shared across PM2 instances so every
// process reuses the same 24h auth key instead of each authenticating
// separately. The key itself is AES-256-GCM encrypted and never selected
// by default. NOT subject to data retention.
const iwcrcmCredentialSchema = new mongoose.Schema(
  {
    deviceId: {
      type: String,
      required: true,
      unique: true,
      uppercase: true,
      trim: true,
    },
    authKeyEncrypted: {
      type: String,
      default: null,
      select: false,
    },
    authKeyExpiresAt: { type: Date, default: null },
    lastAuthAt:       { type: Date, default: null },
    lastAuthError:    { type: String, default: null },
    authFailures:     { type: Number, default: 0 },
    // Cross-process lock so only one instance runs the /auth handshake
    lockUntil:        { type: Date, default: null },
  },
  { timestamps: true, versionKey: false }
);

module.exports = mongoose.model('IwcrcmCredential', iwcrcmCredentialSchema, 'iwcrcm_credentials');
