const express = require('express');
const { register, login, getProfile } = require('./auth.controller');
const { registerSchema, loginSchema, validate } = require('./auth.validation');
const { authenticate } = require('../../middleware/auth.middleware');

const router = express.Router();

router.post('/register', validate(registerSchema), register);
router.post('/login',    validate(loginSchema),    login);
router.get('/profile',   authenticate,             getProfile);

module.exports = router;
