const PetHotel = require('../models/PetHotel');
const HotelBooking = require('../models/HotelBooking');

// ==================== HELPER FUNCTIONS ====================

// Transform hotel response with renamed ID fields
const transformHotelResponse = (hotel) => {
  const hotelObj = hotel.toObject ? hotel.toObject() : hotel;
  
  return {
    hotelId: hotelObj._id,
    name: hotelObj.name,
    description: hotelObj.description,
    owner: hotelObj.owner ? {
      ownerId: hotelObj.owner._id,
      fullName: hotelObj.owner.fullName,
      avatar: hotelObj.owner.avatar,
    } : null,
    address: hotelObj.address,
    phone: hotelObj.phone,
    email: hotelObj.email,
    acceptedPets: hotelObj.acceptedPets,
    services: hotelObj.services ? hotelObj.services.map(s => ({
      serviceId: s._id,
      name: s.name,
      description: s.description,
      price: s.price,
      currency: s.currency,
    })) : [],
    rooms: hotelObj.rooms ? hotelObj.rooms.map(r => ({
      roomId: r._id,
      type: r.type,
      name: r.name,
      description: r.description,
      pricePerNight: r.pricePerNight,
      capacity: r.capacity,
      totalRooms: r.totalRooms,
      availableRooms: r.availableRooms,
      amenities: r.amenities,
    })) : [],
    images: hotelObj.images ? hotelObj.images.map(img => ({
      imageId: img._id,
      url: img.url,
      caption: img.caption,
    })) : [],
    rating: hotelObj.rating,
    operatingHours: hotelObj.operatingHours,
    policies: hotelObj.policies,
    commissionRate: hotelObj.commissionRate,
    slug: hotelObj.slug,
    isVerified: hotelObj.isVerified,
    isActive: hotelObj.isActive,
    createdAt: hotelObj.createdAt,
    updatedAt: hotelObj.updatedAt,
  };
};

// ==================== HOTEL MANAGEMENT ====================

// @desc    Register hotel
// @route   POST /api/v1/hotels
// @access  Private
exports.createHotel = async (req, res, next) => {
  try {
    req.body.owner = req.user.id;
    const hotel = await PetHotel.create(req.body);

    // Update user role
    if (req.user.role === 'user') {
      req.user.role = 'hotel_owner';
      await req.user.save({ validateBeforeSave: false });
    }

    // Transform response with renamed ID fields
    const transformedHotel = transformHotelResponse(hotel);

    res.status(201).json({
      success: true,
      message: 'Đăng ký khách sạn thú cưng thành công.',
      data: transformedHotel,
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Get all hotels
// @route   GET /api/v1/hotels
// @access  Public
exports.getHotels = async (req, res, next) => {
  try {
    const {
      city,
      petType,
      minRating,
      minPrice,
      maxPrice,
      sortBy = '-rating.average',
      page = 1,
      limit = 20,
    } = req.query;

    const query = { isActive: true };

    if (city) query['address.city'] = new RegExp(city, 'i');
    if (petType) query.acceptedPets = petType;
    if (minRating) query['rating.average'] = { $gte: Number(minRating) };

    if (minPrice || maxPrice) {
      query['rooms.pricePerNight'] = {};
      if (minPrice) query['rooms.pricePerNight'].$gte = Number(minPrice);
      if (maxPrice) query['rooms.pricePerNight'].$lte = Number(maxPrice);
    }

    const total = await PetHotel.countDocuments(query);
    const hotels = await PetHotel.find(query)
      .populate('owner', 'fullName avatar')
      .sort(sortBy)
      .skip((page - 1) * limit)
      .limit(Number(limit));

    // Transform response with renamed ID fields
    const transformedHotels = hotels.map(hotel => transformHotelResponse(hotel));

    res.status(200).json({
      success: true,
      count: transformedHotels.length,
      total,
      page: Number(page),
      totalPages: Math.ceil(total / limit),
      data: transformedHotels,
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Get single hotel
// @route   GET /api/v1/hotels/:id
// @access  Public
exports.getHotel = async (req, res, next) => {
  try {
    const hotel = await PetHotel.findById(req.params.id).populate(
      'owner',
      'fullName avatar phone email'
    );

    if (!hotel) {
      return res.status(404).json({
        success: false,
        message: 'Không tìm thấy khách sạn.',
      });
    }

    // Transform response with renamed ID fields
    const transformedHotel = transformHotelResponse(hotel);

    res.status(200).json({
      success: true,
      data: transformedHotel,
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Update hotel
// @route   PUT /api/v1/hotels/:id
// @access  Private (hotel owner)
exports.updateHotel = async (req, res, next) => {
  try {
    let hotel = await PetHotel.findOne({
      _id: req.params.id,
      owner: req.user.id,
    });

    if (!hotel) {
      return res.status(404).json({
        success: false,
        message: 'Không tìm thấy khách sạn hoặc bạn không có quyền.',
      });
    }

    delete req.body.owner;
    delete req.body.rating;
    delete req.body.commissionRate;

    // Handle multiple image uploads
    if (req.files && req.files.length > 0) {
      const newImages = req.files.map(file => ({
        url: file.path, // Cloudinary URL
        caption: ''
      }));
      req.body.images = newImages;
    }

    hotel = await PetHotel.findByIdAndUpdate(req.params.id, req.body, {
      new: true,
      runValidators: true,
    });

    // Transform response with renamed ID fields
    const transformedHotel = transformHotelResponse(hotel);

    res.status(200).json({
      success: true,
      message: 'Cập nhật khách sạn thành công.',
      data: transformedHotel,
    });
  } catch (error) {
    next(error);
  }
};

// ==================== HOTEL BOOKINGS ====================

// @desc    Create hotel booking
// @route   POST /api/v1/hotel-bookings
// @access  Private
exports.createBooking = async (req, res, next) => {
  try {
    const { hotel: hotelId, roomType, checkIn, checkOut, additionalServices, specialRequests } = req.body;

    // Verify hotel
    const hotel = await PetHotel.findById(hotelId);
    if (!hotel || !hotel.isActive) {
      return res.status(404).json({
        success: false,
        message: 'Không tìm thấy khách sạn.',
      });
    }

    // Find room and pricing
    const room = hotel.rooms.find((r) => r.type === roomType);
    if (!room) {
      return res.status(400).json({
        success: false,
        message: 'Loại phòng không tồn tại.',
      });
    }

    if (room.availableRooms <= 0) {
      return res.status(400).json({
        success: false,
        message: 'Phòng đã hết. Vui lòng chọn loại khác.',
      });
    }

    const booking = await HotelBooking.create({
      user: req.user.id,
      hotel: hotelId,
      roomType,
      checkIn: new Date(checkIn),
      checkOut: new Date(checkOut),
      additionalServices,
      specialRequests,
      pricing: {
        nightlyRate: room.pricePerNight,
        commission: {
          rate: hotel.commissionRate,
        },
      },
    });

    res.status(201).json({
      success: true,
      message: 'Đặt phòng thành công!',
      data: booking,
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Get user's bookings
// @route   GET /api/v1/hotel-bookings
// @access  Private
exports.getMyBookings = async (req, res, next) => {
  try {
    const { status, page = 1, limit = 20 } = req.query;
    const query = { user: req.user.id };
    if (status) query.status = status;

    const total = await HotelBooking.countDocuments(query);
    const bookings = await HotelBooking.find(query)
      .populate('pet', 'name species avatar')
      .populate('hotel', 'name address images rating')
      .sort('-createdAt')
      .skip((page - 1) * limit)
      .limit(Number(limit));

    res.status(200).json({
      success: true,
      count: bookings.length,
      total,
      page: Number(page),
      totalPages: Math.ceil(total / limit),
      data: bookings,
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Get hotel owner's bookings
// @route   GET /api/v1/hotel-bookings/hotel/:hotelId
// @access  Private (hotel owner)
exports.getHotelBookings = async (req, res, next) => {
  try {
    const hotel = await PetHotel.findOne({
      _id: req.params.hotelId,
      owner: req.user.id,
    });

    if (!hotel) {
      return res.status(404).json({
        success: false,
        message: 'Không tìm thấy khách sạn hoặc bạn không có quyền.',
      });
    }

    const { status, page = 1, limit = 20 } = req.query;
    const query = { hotel: hotel._id };
    if (status) query.status = status;

    const total = await HotelBooking.countDocuments(query);
    const bookings = await HotelBooking.find(query)
      .populate('user', 'fullName phone email')
      .populate('pet', 'name species breed gender weight allergies')
      .sort('-checkIn')
      .skip((page - 1) * limit)
      .limit(Number(limit));

    res.status(200).json({
      success: true,
      count: bookings.length,
      total,
      page: Number(page),
      totalPages: Math.ceil(total / limit),
      data: bookings,
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Update booking status
// @route   PUT /api/v1/hotel-bookings/:id/status
// @access  Private
exports.updateBookingStatus = async (req, res, next) => {
  try {
    const { status, cancellationReason } = req.body;
    const booking = await HotelBooking.findById(req.params.id);

    if (!booking) {
      return res.status(404).json({
        success: false,
        message: 'Không tìm thấy booking.',
      });
    }

    // Check permission
    const hotel = await PetHotel.findById(booking.hotel);
    const isUser = booking.user.toString() === req.user.id;
    const isHotelOwner = hotel && hotel.owner.toString() === req.user.id;

    if (!isUser && !isHotelOwner && req.user.role !== 'admin') {
      return res.status(403).json({
        success: false,
        message: 'Bạn không có quyền thay đổi booking này.',
      });
    }

    booking.status = status;

    if (status === 'cancelled') {
      booking.cancellation = {
        cancelledBy: isHotelOwner ? 'hotel' : 'user',
        reason: cancellationReason,
        cancelledAt: new Date(),
      };
    }

    if (status === 'checked_out') {
      booking.payment.status = 'paid';
      booking.payment.paidAt = new Date();
    }

    await booking.save();

    res.status(200).json({
      success: true,
      message: 'Cập nhật booking thành công.',
      data: booking,
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Review hotel booking
// @route   POST /api/v1/hotel-bookings/:id/review
// @access  Private
exports.reviewBooking = async (req, res, next) => {
  try {
    const { rating, comment } = req.body;

    const booking = await HotelBooking.findOne({
      _id: req.params.id,
      user: req.user.id,
      status: 'checked_out',
    });

    if (!booking) {
      return res.status(404).json({
        success: false,
        message: 'Không tìm thấy booking đã hoàn thành.',
      });
    }

    if (booking.review && booking.review.rating) {
      return res.status(400).json({
        success: false,
        message: 'Bạn đã đánh giá booking này.',
      });
    }

    booking.review = { rating, comment, createdAt: new Date() };
    await booking.save();

    // Update hotel rating
    const allReviews = await HotelBooking.find({
      hotel: booking.hotel,
      'review.rating': { $exists: true },
    }).select('review.rating');

    const avgRating =
      allReviews.reduce((sum, b) => sum + b.review.rating, 0) / allReviews.length;

    await PetHotel.findByIdAndUpdate(booking.hotel, {
      'rating.average': Math.round(avgRating * 10) / 10,
      'rating.count': allReviews.length,
    });

    res.status(200).json({
      success: true,
      message: 'Đánh giá thành công!',
      data: booking.review,
    });
  } catch (error) {
    next(error);
  }
};
