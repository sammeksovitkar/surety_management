const express = require('express');
const router = express.Router();
const userController = require('../controllers/userController');
const { authMiddleware, userMiddleware } = require('../middleware/auth');

// User only routes
router.post('/sureties', authMiddleware, userMiddleware, userController.createSurety);
router.get('/sureties', authMiddleware, userMiddleware, userController.getUserSureties);
router.get('/allsureties', authMiddleware, userController.getAllSureties);
router.get('/me', authMiddleware, userController.getMe);


// Dummy route to get user info, can be expanded
router.get('/me', authMiddleware, userController.getMe);

module.exports = router;

