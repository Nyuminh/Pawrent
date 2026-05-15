// @desc    Upload single or multiple images
// @route   POST /api/v1/uploads
// @access  Private
exports.uploadImages = async (req, res, next) => {
  try {
    if (!req.files || req.files.length === 0) {
      return res.status(400).json({
        success: false,
        message: 'Vui lòng chọn ít nhất một ảnh để upload',
        code: 'NO_FILES_PROVIDED',
      });
    }

    // Extract URLs from uploaded files
    const imageUrls = req.files.map(file => file.path);

    // If only one file, return single URL as string
    // If multiple files, return array of URLs
    const result = imageUrls.length === 1 ? imageUrls[0] : imageUrls;

    res.status(200).json({
      success: true,
      message: `Upload ${req.files.length} ảnh thành công!`,
      data: {
        count: req.files.length,
        urls: imageUrls,
        url: result, // For backward compatibility
      },
    });
  } catch (error) {
    next(error);
  }
};
