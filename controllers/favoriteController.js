// ============================================
// FILE: controllers/favoriteController.js
// ============================================
const Favorite = require('../models/Favorite');

exports.toggleFavorite = async (req, res) => {
  try {
    const { eventId } = req.body;

    const existing = await Favorite.findOne({ userId: req.user.id, eventId });

    if (existing) {
      await Favorite.deleteOne({ _id: existing._id });
      return res.json({ message: 'Removed from favorites', isFavorite: false });
    }

    const favorite = new Favorite({ userId: req.user.id, eventId });
    await favorite.save();

    res.json({ message: 'Added to favorites', isFavorite: true });
  } catch (error) {
    console.error('Toggle favorite error:', error);
    res.status(500).json({ error: 'Server error' });
  }
};

exports.getFavorites = async (req, res) => {
  try {
    const favorites = await Favorite.find({ userId: req.user.id })
      .populate('eventId')
      .sort({ createdAt: -1 });

    res.json(favorites);
  } catch (error) {
    console.error('Get favorites error:', error);
    res.status(500).json({ error: 'Server error' });
  }
};
