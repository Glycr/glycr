// ============================================
// FILE: routes/favoriteRoutes.js
// ============================================
const express = require('express');
const router = express.Router();
const favoriteController = require('../controllers/favoriteController');
const { authenticateToken } = require('../middleware/auth');

router.post('/toggle', authenticateToken, favoriteController.toggleFavorite);
router.get('/', authenticateToken, favoriteController.getFavorites);

module.exports = router;
