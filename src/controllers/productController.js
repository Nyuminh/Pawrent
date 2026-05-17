const Product = require('../models/Product');

// @desc    Get all products
// @route   GET /api/v1/products
// @access  Public
exports.getAllProducts = async (req, res, next) => {
  try {
    const {
      category,
      petType,
      minPrice,
      maxPrice,
      search,
      inStock = true,
      minRating,
      sortBy = '-createdAt',
      page = 1,
      limit = 20,
    } = req.query;

    const query = { status: 'active' };

    if (category) query.category = category;
    if (petType) query.petTypes = petType;
    if (minPrice || maxPrice) {
      query.price = {};
      if (minPrice) query.price.$gte = Number(minPrice);
      if (maxPrice) query.price.$lte = Number(maxPrice);
    }
    if (inStock === 'true') query['stock.status'] = { $ne: 'out_of_stock' };
    if (minRating) query['rating.average'] = { $gte: Number(minRating) };

    let searchQuery = query;
    if (search) {
      searchQuery = { $text: { $search: search }, ...query };
    }

    const total = await Product.countDocuments(searchQuery);
    const products = await Product.find(searchQuery)
      .populate('seller', 'fullName avatar phone')
      .sort(sortBy)
      .skip((page - 1) * limit)
      .limit(Number(limit));

    res.status(200).json({
      success: true,
      count: products.length,
      total,
      page: Number(page),
      totalPages: Math.ceil(total / limit),
      data: products,
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Get single product
// @route   GET /api/v1/products/:id
// @access  Public
exports.getProduct = async (req, res, next) => {
  try {
    const product = await Product.findById(req.params.id)
      .populate('seller', 'fullName avatar phone email')
      .populate('reviews.user', 'fullName avatar');

    if (!product || product.status === 'inactive') {
      return res.status(404).json({
        success: false,
        message: 'Không tìm thấy sản phẩm.',
      });
    }

    res.status(200).json({
      success: true,
      data: product,
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Create product
// @route   POST /api/v1/products
// @access  Private (seller/admin)
exports.createProduct = async (req, res, next) => {
  try {
    const {
      name,
      description,
      category,
      price,
      stock,
      petTypes,
      images,
      specifications,
    } = req.body;

    // Check if user is seller or admin
    if (req.user.role !== 'seller' && req.user.role !== 'admin') {
      return res.status(403).json({
        success: false,
        message: 'Chỉ người bán hàng có thể tạo sản phẩm.',
      });
    }

    const product = await Product.create({
      name,
      description,
      category,
      price,
      stock,
      petTypes,
      images: images || [],
      specifications,
      seller: req.user.id,
    });

    res.status(201).json({
      success: true,
      message: 'Tạo sản phẩm thành công.',
      data: product,
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Update product
// @route   PUT /api/v1/products/:id
// @access  Private (seller/admin)
exports.updateProduct = async (req, res, next) => {
  try {
    let product = await Product.findById(req.params.id);

    if (!product) {
      return res.status(404).json({
        success: false,
        message: 'Không tìm thấy sản phẩm.',
      });
    }

    // Check ownership
    if (
      product.seller.toString() !== req.user.id &&
      req.user.role !== 'admin'
    ) {
      return res.status(403).json({
        success: false,
        message: 'Bạn không có quyền cập nhật sản phẩm này.',
      });
    }

    // Don't allow updating seller
    delete req.body.seller;
    delete req.body.reviews;

    product = await Product.findByIdAndUpdate(req.params.id, req.body, {
      new: true,
      runValidators: true,
    });

    res.status(200).json({
      success: true,
      message: 'Cập nhật sản phẩm thành công.',
      data: product,
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Delete product
// @route   DELETE /api/v1/products/:id
// @access  Private (seller/admin)
exports.deleteProduct = async (req, res, next) => {
  try {
    const product = await Product.findById(req.params.id);

    if (!product) {
      return res.status(404).json({
        success: false,
        message: 'Không tìm thấy sản phẩm.',
      });
    }

    // Check ownership
    if (
      product.seller.toString() !== req.user.id &&
      req.user.role !== 'admin'
    ) {
      return res.status(403).json({
        success: false,
        message: 'Bạn không có quyền xóa sản phẩm này.',
      });
    }

    await Product.findByIdAndDelete(req.params.id);

    res.status(200).json({
      success: true,
      message: 'Xóa sản phẩm thành công.',
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Add review to product
// @route   POST /api/v1/products/:id/review
// @access  Private
exports.addReview = async (req, res, next) => {
  try {
    const { rating, comment } = req.body;

    const product = await Product.findById(req.params.id);

    if (!product) {
      return res.status(404).json({
        success: false,
        message: 'Không tìm thấy sản phẩm.',
      });
    }

    // Check if user already reviewed
    const existingReview = product.reviews.find(
      (r) => r.user.toString() === req.user.id
    );

    if (existingReview) {
      return res.status(400).json({
        success: false,
        message: 'Bạn đã đánh giá sản phẩm này rồi.',
      });
    }

    // Add review
    product.reviews.push({
      user: req.user.id,
      rating,
      comment,
    });

    // Update average rating
    const totalRating = product.reviews.reduce((sum, r) => sum + r.rating, 0);
    product.rating.average = Math.round((totalRating / product.reviews.length) * 10) / 10;
    product.rating.count = product.reviews.length;

    await product.save();

    res.status(201).json({
      success: true,
      message: 'Đánh giá sản phẩm thành công.',
      data: product.reviews[product.reviews.length - 1],
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Get seller's products
// @route   GET /api/v1/products/seller/my-products
// @access  Private (seller)
exports.getMyProducts = async (req, res, next) => {
  try {
    if (req.user.role !== 'seller' && req.user.role !== 'admin') {
      return res.status(403).json({
        success: false,
        message: 'Chỉ người bán hàng có thể xem danh sách sản phẩm của mình.',
      });
    }

    const { page = 1, limit = 20, status } = req.query;

    const query = {
      seller: req.user.id,
    };

    if (status) query.status = status;

    const total = await Product.countDocuments(query);
    const products = await Product.find(query)
      .sort('-createdAt')
      .skip((page - 1) * limit)
      .limit(Number(limit));

    res.status(200).json({
      success: true,
      count: products.length,
      total,
      page: Number(page),
      totalPages: Math.ceil(total / limit),
      data: products,
    });
  } catch (error) {
    next(error);
  }
};
