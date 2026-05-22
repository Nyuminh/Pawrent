const Service = require('../models/Service');

// @desc    Get all services (public, no auth required)
// @route   GET /api/v1/services
// @access  Public
exports.getAllServices = async (req, res, next) => {
  try {
    const { search, sortBy = '-createdAt', page = 1, limit = 20 } = req.query;

    let query = Service.find({ isActive: true });

    // Search by name or description
    if (search) {
      query = query.or([
        { name: new RegExp(search, 'i') },
        { description: new RegExp(search, 'i') },
      ]);
    }

    // Sorting
    query = query.sort(sortBy);

    // Pagination
    const pageNum = parseInt(page, 10);
    const limitNum = parseInt(limit, 10);
    const startIndex = (pageNum - 1) * limitNum;

    const total = await Service.countDocuments(query);
    const services = await query.skip(startIndex).limit(limitNum);

    res.status(200).json({
      success: true,
      count: services.length,
      total,
      page: pageNum,
      totalPages: Math.ceil(total / limitNum),
      data: services,
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Get single service
// @route   GET /api/v1/services/:id
// @access  Public
exports.getServiceById = async (req, res, next) => {
  try {
    const service = await Service.findOne({
      _id: req.params.id,
      isActive: true,
    });

    if (!service) {
      return res.status(404).json({
        success: false,
        message: 'Không tìm thấy dịch vụ.',
      });
    }

    res.status(200).json({
      success: true,
      data: service,
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Create service
// @route   POST /api/v1/services
// @access  Private/Admin
exports.createService = async (req, res, next) => {
  try {
    const { name, description, price, promotion } = req.body;

    // Check if service already exists
    const existingService = await Service.findOne({ name });
    if (existingService) {
      return res.status(400).json({
        success: false,
        message: 'Dịch vụ này đã tồn tại.',
      });
    }

    // Handle multiple image uploads
    const images = [];
    if (req.files && Array.isArray(req.files)) {
      req.files.forEach((file) => {
        images.push(file.path); // Cloudinary returns file.path as URL
      });
    }

    const serviceData = {
      name,
      description,
      price,
      promotion: promotion || 0,
      images,
      createdBy: req.user.id,
      isActive: true,
    };

    const service = await Service.create(serviceData);

    res.status(201).json({
      success: true,
      message: 'Tạo dịch vụ thành công!',
      data: service,
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Update service
// @route   PUT /api/v1/services/:id
// @access  Private/Admin
exports.updateService = async (req, res, next) => {
  try {
    let service = await Service.findById(req.params.id);

    if (!service) {
      return res.status(404).json({
        success: false,
        message: 'Không tìm thấy dịch vụ.',
      });
    }

    const { name, description, price, promotion } = req.body;

    // Check if name is unique (if being updated)
    if (name && name !== service.name) {
      const existingService = await Service.findOne({ name });
      if (existingService) {
        return res.status(400).json({
          success: false,
          message: 'Tên dịch vụ này đã tồn tại.',
        });
      }
    }

    // Update basic fields
    if (name) service.name = name;
    if (description) service.description = description;
    if (price !== undefined) service.price = price;
    if (promotion !== undefined) service.promotion = promotion;

    // Handle image updates
    if (req.files && Array.isArray(req.files) && req.files.length > 0) {
      const newImages = [];
      req.files.forEach((file) => {
        newImages.push(file.path); // Cloudinary returns file.path as URL
      });
      service.images = newImages;
    }

    service = await service.save();

    res.status(200).json({
      success: true,
      message: 'Cập nhật dịch vụ thành công!',
      data: service,
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Delete service (soft delete - mark as inactive)
// @route   DELETE /api/v1/services/:id
// @access  Private/Admin
exports.deleteService = async (req, res, next) => {
  try {
    const service = await Service.findById(req.params.id);

    if (!service) {
      return res.status(404).json({
        success: false,
        message: 'Không tìm thấy dịch vụ.',
      });
    }

    service.isActive = false;
    await service.save();

    res.status(200).json({
      success: true,
      message: 'Xóa dịch vụ thành công!',
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Permanently delete service (hard delete)
// @route   DELETE /api/v1/services/:id/permanent
// @access  Private/Admin
exports.permanentlyDeleteService = async (req, res, next) => {
  try {
    const service = await Service.findByIdAndDelete(req.params.id);

    if (!service) {
      return res.status(404).json({
        success: false,
        message: 'Không tìm thấy dịch vụ.',
      });
    }

    res.status(200).json({
      success: true,
      message: 'Xóa vĩnh viễn dịch vụ thành công!',
    });
  } catch (error) {
    next(error);
  }
};
