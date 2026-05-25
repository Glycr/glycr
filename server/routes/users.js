const express = require('express');
const router = express.Router();
const userController = require('../controllers/userController');
const auth = require('../middleware/auth');
const { validate, updateProfileSchema } = require('../middleware/validation');

// Base path: /users
router.get('/users', auth, userController.getUsers);
router.get('/users/:id', auth, userController.getUser);
router.put('/users/:id', auth, validate(updateProfileSchema), userController.updateUser);
router.patch('/users/:id/suspend', auth, userController.suspendUser);
router.patch('/users/:id/unsuspend', auth, userController.unsuspendUser);
router.delete('/users/:id', auth, userController.deleteUser);
router.post('/users/favorites', auth, userController.toggleFavorite); // <-- ADD

module.exports = router;
