const mongoose = require('mongoose');
const { getIwcrcmService } = require('../../integrations/iwcrcm/iwcrcm.service');
const { sendSuccess } = require('../../utils/apiResponse.util');
const { AppError } = require('../../middleware/error.middleware');

// Never returns auth keys, challenge codes or the public key — expiry/status only.
const getStatus = async (req, res, next) => {
  try {
    const data = await getIwcrcmService().getStatus();
    return sendSuccess(res, data, 'IWCRCM integration status retrieved successfully');
  } catch (error) {
    next(error);
  }
};

const retryFailed = async (req, res, next) => {
  try {
    const { tankId } = req.body || {};
    if (tankId && !mongoose.Types.ObjectId.isValid(tankId)) {
      throw new AppError(`Invalid tank ID: ${tankId}`, 400);
    }
    const data = await getIwcrcmService().retryFailed({ tankId });
    return sendSuccess(res, data, `${data.requeued} failed transmission(s) re-queued`);
  } catch (error) {
    next(error);
  }
};

// Runs one scheduler tick immediately (queue current slot + send due records)
const runNow = async (req, res, next) => {
  try {
    const service = getIwcrcmService();
    if (!service.config.enabled) throw new AppError('IWCRCM integration is disabled (IWCRCM_ENABLED=false)', 409);
    const data = await service.tick();
    return sendSuccess(res, data, 'IWCRCM tick executed');
  } catch (error) {
    next(error);
  }
};

module.exports = { getStatus, retryFailed, runNow };
