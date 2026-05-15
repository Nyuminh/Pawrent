const express = require('express');
const { protect } = require('../middleware/auth');
const { upload } = require('../middleware/upload');
const { uploadImages } = require('../controllers/uploadController');

const router = express.Router();

// All routes require authentication
router.use(protect);

// @route   POST /api/v1/uploads
// @desc    Upload single or multiple images
// @access  Private
// Accept up to 10 images in 'images' field
router.post('/', upload.array('images', 10), uploadImages);

module.exports = router;
