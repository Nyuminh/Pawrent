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

// @desc    Get current user cart
// @route   GET /api/v1/products/cart
// @access  Private
exports.getCart = async (req, res, next) => {
  try {
    await req.user.populate({
      path: 'cart.product',
      select: 'name price discount stock images status',
    });

    res.status(200).json({
      success: true,
      data: req.user.cart,
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Add product to cart
// @route   POST /api/v1/products/:id/cart
// @access  Private
exports.addToCart = async (req, res, next) => {
  try {
    const quantity = Number(req.body.quantity) || 1;
    if (quantity < 1) {
      return res.status(400).json({
        success: false,
        message: 'Số lượng phải lớn hơn hoặc bằng 1.',
      });
    }

    const product = await Product.findById(req.params.id);

    if (!product || product.status === 'inactive') {
      return res.status(404).json({
        success: false,
        message: 'Không tìm thấy sản phẩm.',
      });
    }

    if (product.stock.quantity <= 0 || product.stock.status === 'out_of_stock') {
      return res.status(400).json({
        success: false,
        message: 'Sản phẩm đã hết hàng.',
      });
    }

    const maxQuantity = product.stock.quantity;
    const user = req.user;
    const existingItem = user.cart.find(
      (item) => item.product.toString() === product._id.toString()
    );

    if (existingItem) {
      const updatedQuantity = Math.min(existingItem.quantity + quantity, maxQuantity);
      existingItem.quantity = updatedQuantity;
    } else {
      user.cart.push({
        product: product._id,
        quantity: Math.min(quantity, maxQuantity),
      });
    }

    await user.save();

    await user.populate({
      path: 'cart.product',
      select: 'name price discount stock images status',
    });

    res.status(200).json({
      success: true,
      message: 'Đã thêm sản phẩm vào giỏ hàng.',
      data: user.cart,
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Create product
// @route   POST /api/v1/products
// @access  Private (admin)
exports.createProduct = async (req, res, next) => {
  try {
    const {
      name,
      description,
      category,
      price,
      stock,
      petTypes,
      specifications,
    } = req.body;

    // Handle image uploads from Cloudinary
    const images = req.files ? req.files.map(file => file.path) : [];

    const product = await Product.create({
      name,
      description,
      category,
      price,
      stock,
      petTypes,
      images: images,
      specifications,
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
// @access  Private (admin)
exports.updateProduct = async (req, res, next) => {
  try {
    let product = await Product.findById(req.params.id);

    if (!product) {
      return res.status(404).json({
        success: false,
        message: 'Không tìm thấy sản phẩm.',
      });
    }

    // Don't allow updating reviews
    delete req.body.reviews;

    // Handle image uploads from Cloudinary
    if (req.files && req.files.length > 0) {
      req.body.images = req.files.map(file => file.path);
    }

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
// @access  Private (admin)
exports.deleteProduct = async (req, res, next) => {
  try {
    const product = await Product.findById(req.params.id);

    if (!product) {
      return res.status(404).json({
        success: false,
        message: 'Không tìm thấy sản phẩm.',
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

// @desc    Remove product from cart
// @route   DELETE /api/v1/products/:id/cart
// @access  Private
exports.removeFromCart = async (req, res, next) => {
  try {
    const user = req.user;
    const productId = req.params.id;

    const cartItemIndex = user.cart.findIndex(
      (item) => item.product.toString() === productId
    );

    if (cartItemIndex === -1) {
      return res.status(404).json({
        success: false,
        message: 'Sản phẩm không có trong giỏ hàng.',
      });
    }

    user.cart.splice(cartItemIndex, 1);
    await user.save();

    await user.populate({
      path: 'cart.product',
      select: 'name price discount stock images status',
    });

    res.status(200).json({
      success: true,
      message: 'Đã xóa sản phẩm khỏi giỏ hàng.',
      data: user.cart,
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


