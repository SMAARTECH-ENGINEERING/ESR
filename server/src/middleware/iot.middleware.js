const { sendError } = require('../utils/apiResponse.util');

// IoT devices authenticate using a shared secret key
// sent in the X-Device-Secret request header
const verifyDeviceSecret = (req, res, next) => {
  const deviceSecret = req.headers['x-device-secret'];

  if (!deviceSecret) {
    return sendError(res, 'Missing X-Device-Secret header.', 401);
  }

  if (deviceSecret !== process.env.IOT_DEVICE_SECRET) {
    return sendError(res, 'Invalid device secret.', 401);
  }

  next();
};

module.exports = { verifyDeviceSecret };
