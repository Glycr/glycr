const express = require('express');
const router = express.Router();
const auth = require('../middleware/auth');
const { requireModeratorOrAdmin } = require('../middleware/rbac');   // use the guard your /admin routes use
const featuredController = require('../controllers/featuredController');

// public: feeds the homepage carousel
router.get('/events/featured', featuredController.getFeatured);



module.exports = router;
