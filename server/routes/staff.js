const express          = require('express');
const router           = express.Router();
const auth             = require('../middleware/auth');
const staffController  = require('../controllers/staffController');


// ── Staff CRUD ─────────────────────────────────────────────────
router.post('/staff/pin-login',       staffController.pinLogin);
router.post('/staff',           auth, staffController.createStaff);
router.get   ('/staff',         auth, staffController.listStaff);
router.get   ('/staff/:id',     auth, staffController.getStaff);
router.patch ('/staff/:id/status', auth, staffController.setStatus);
router.delete('/staff/:id',     auth, staffController.deleteStaff);

module.exports = router;
