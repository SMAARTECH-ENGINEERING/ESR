const sendSuccess = (res, data = null, message = 'Success', statusCode = 200) => {
  const response = {
    status: 'success',
    message,
    timestamp: new Date().toISOString(),
  };
  if (data !== null) response.data = data;
  return res.status(statusCode).json(response);
};

const sendError = (res, message = 'Internal Server Error', statusCode = 500, errors = null) => {
  const response = {
    status: 'error',
    message,
    timestamp: new Date().toISOString(),
  };
  if (errors) response.errors = errors;
  return res.status(statusCode).json(response);
};

const sendPaginated = (res, data, pagination, message = 'Success') => {
  return res.status(200).json({
    status: 'success',
    message,
    timestamp: new Date().toISOString(),
    data,
    pagination,
  });
};

module.exports = { sendSuccess, sendError, sendPaginated };
