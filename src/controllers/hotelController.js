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

    // Parse JSON string fields từ multipart/form-data
    const jsonFields = ['operatingHours', 'address', 'capacity', 'policies'];
    jsonFields.forEach((field) => {
      if (req.body[field] && typeof req.body[field] === 'string') {
        try {
          req.body[field] = JSON.parse(req.body[field]);
        } catch (e) {
          // giữ nguyên nếu không phải JSON hợp lệ
        }
      }
    });

    // Parse services array từ JSON string
    if (req.body.services && typeof req.body.services === 'string') {
      try {
        req.body.services = JSON.parse(req.body.services);
      } catch (e) {}
    }

    // Parse rooms array từ JSON string
    if (req.body.rooms && typeof req.body.rooms === 'string') {
      try {
        req.body.rooms = JSON.parse(req.body.rooms);
      } catch (e) {}
    }

    // Xử lý upload ảnh từ Cloudinary
    if (req.files && req.files.length > 0) {
      req.body.images = req.files.map((file) => ({
        url: file.path,
        caption: '',
      }));
    }

    const hotel = await PetHotel.create(req.body);

    // Cập nhật role user thành hotel_owner
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

// @desc    Get my hotels (hotel owner)
// @route   GET /api/v1/hotels/my
// @access  Private (hotel_owner, admin)
exports.getMyHotels = async (req, res, next) => {
  try {
    const hotels = await PetHotel.find({ owner: req.user.id })
      .populate('owner', 'fullName avatar phone email')
      .sort('-createdAt');

    const transformedHotels = hotels.map((hotel) => transformHotelResponse(hotel));

    res.status(200).json({
      success: true,
      count: transformedHotels.length,
      data: transformedHotels,
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
    let hotel;

    // Admin có thể cập nhật bất kỳ hotel nào, owner chỉ cập nhật của mình
    if (req.user.role === 'admin') {
      hotel = await PetHotel.findById(req.params.id);
    } else {
      hotel = await PetHotel.findOne({
        _id: req.params.id,
        owner: req.user.id,
      });
    }

    if (!hotel) {
      // Kiểm tra xem hotel có tồn tại không để trả về lỗi đúng
      const exists = await PetHotel.exists({ _id: req.params.id });
      return res.status(exists ? 403 : 404).json({
        success: false,
        message: exists
          ? 'Bạn không có quyền cập nhật khách sạn này.'
          : 'Không tìm thấy khách sạn.',
      });
    }

    delete req.body.owner;
    delete req.body.rating;
    delete req.body.commissionRate;

    // Parse JSON string fields từ multipart/form-data
    const jsonFields = ['operatingHours', 'address', 'capacity', 'policies'];
    jsonFields.forEach((field) => {
      if (req.body[field] && typeof req.body[field] === 'string') {
        try {
          req.body[field] = JSON.parse(req.body[field]);
        } catch (e) {}
      }
    });

    // Parse services array từ JSON string
    if (req.body.services && typeof req.body.services === 'string') {
      try {
        req.body.services = JSON.parse(req.body.services);
      } catch (e) {}
    }

    // Parse rooms array từ JSON string
    if (req.body.rooms && typeof req.body.rooms === 'string') {
      try {
        req.body.rooms = JSON.parse(req.body.rooms);
      } catch (e) {}
    }

    // Xử lý upload ảnh từ Cloudinary
    if (req.files && req.files.length > 0) {
      req.body.images = req.files.map((file) => ({
        url: file.path,
        caption: '',
      }));
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


// @desc    Delete hotel
// @route   DELETE /api/v1/hotels/:id
// @access  Private (hotel owner or admin)
exports.deleteHotel = async (req, res, next) => {
  try {
    const hotel = await PetHotel.findById(req.params.id);

    if (!hotel) {
      return res.status(404).json({
        success: false,
        message: 'Không tìm thấy khách sạn.',
      });
    }

    // Check if user is owner or admin
    const isOwner = hotel.owner.toString() === req.user.id;
    const isAdmin = req.user.role === 'admin';

    if (!isOwner && !isAdmin) {
      return res.status(403).json({
        success: false,
        message: 'Bạn không có quyền xóa khách sạn này.',
      });
    }

    // Delete associated bookings
    await HotelBooking.deleteMany({ hotel: req.params.id });

    // Delete hotel
    await PetHotel.findByIdAndDelete(req.params.id);

    res.status(200).json({
      success: true,
      message: 'Xóa khách sạn thành công.',
      data: {},
    });
  } catch (error) {
    next(error);
  }
};

// ==================== HOTEL BOOKINGS ====================

// @desc    Create hotel booking
// @route   POST /api/v1/hotel-bookings
exports.createBooking = async (req, res, next) => {
  try {
    const { hotel: hotelId, checkIn, checkOut, additionalServices, specialRequests, fullName, phone, email } = req.body;

    // Verify hotel
    const hotel = await PetHotel.findById(hotelId);
    if (!hotel || !hotel.isActive) {
      return res.status(404).json({
        success: false,
        message: 'Không tìm thấy khách sạn.',
      });
    }

    const checkInDate = new Date(checkIn);
    const checkOutDate = new Date(checkOut);

    if (checkOutDate <= checkInDate) {
      return res.status(400).json({
        success: false,
        message: 'Ngày check-out phải sau ngày check-in.',
      });
    }

    const booking = await HotelBooking.create({
      user: req.user.id,
      hotel: hotelId,
      fullName: fullName || req.user.fullName,
      phone: phone || req.user.phone,
      email: email || req.user.email,
      checkIn: checkInDate,
      checkOut: checkOutDate,
      additionalServices,
      specialRequests,
      pricing: {
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

// @desc    Cancel hotel booking (khách hàng hủy)
// @route   PUT /api/v1/hotel-bookings/:id/cancel
// @access  Private (user sở hữu booking)
exports.cancelBooking = async (req, res, next) => {
  try {
    const { reason } = req.body;

    const booking = await HotelBooking.findOne({
      _id: req.params.id,
      user: req.user.id,
    });

    if (!booking) {
      return res.status(404).json({
        success: false,
        message: 'Không tìm thấy booking.',
      });
    }

    const nonCancellableStatuses = ['checked_in', 'checked_out', 'cancelled'];
    if (nonCancellableStatuses.includes(booking.status)) {
      return res.status(400).json({
        success: false,
        message: `Không thể hủy booking đang ở trạng thái "${booking.status}".`,
      });
    }

    booking.status = 'cancelled';
    booking.cancellation = {
      cancelledBy: 'user',
      reason: reason || 'Khách hàng hủy',
      cancelledAt: new Date(),
    };
    await booking.save();

    res.status(200).json({
      success: true,
      message: 'Hủy đặt phòng thành công.',
      data: booking,
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Get all bookings of all hotels owned by the current hotel owner
// @route   GET /api/v1/hotel-bookings/owner/all
// @access  Private (hotel_owner)
exports.getAllBookingsForOwner = async (req, res, next) => {
  try {
    const { status, page = 1, limit = 20, hotelId } = req.query;

    // Lấy tất cả khách sạn thuộc hotel owner
    const hotelQuery = { owner: req.user.id };
    if (hotelId) hotelQuery._id = hotelId;

    const ownerHotels = await PetHotel.find(hotelQuery).select('_id name');
    if (!ownerHotels.length) {
      return res.status(200).json({
        success: true,
        count: 0,
        total: 0,
        data: [],
        message: 'Bạn chưa có khách sạn nào.',
      });
    }

    const hotelIds = ownerHotels.map((h) => h._id);
    const bookingQuery = { hotel: { $in: hotelIds } };
    if (status) bookingQuery.status = status;

    const total = await HotelBooking.countDocuments(bookingQuery);
    const bookings = await HotelBooking.find(bookingQuery)
      .populate('user', 'fullName phone email')
      .populate('hotel', 'name address')
      .sort('-createdAt')
      .skip((page - 1) * limit)
      .limit(Number(limit));

    res.status(200).json({
      success: true,
      count: bookings.length,
      total,
      page: Number(page),
      totalPages: Math.ceil(total / limit),
      hotels: ownerHotels,
      data: bookings,
    });
  } catch (error) {
    next(error);
  }
};


// ==================== ROOM OCCUPANCY DASHBOARD ====================

// @desc    Get room occupancy status for hotel owner dashboard
// @route   GET /api/v1/hotels/:hotelId/rooms/occupancy
// @access  Private (hotel owner)
exports.getRoomOccupancy = async (req, res, next) => {
  try {
    const { hotelId } = req.params;
    const { dateFrom, dateTo } = req.query;

    // Verify hotel ownership
    const hotel = await PetHotel.findOne({
      _id: hotelId,
      owner: req.user.id,
    });

    if (!hotel) {
      return res.status(404).json({
        success: false,
        message: 'Không tìm thấy khách sạn hoặc bạn không có quyền.',
      });
    }

    // Build occupancy data for each room type
    const occupancyData = [];

    for (const room of hotel.rooms) {
      const roomTypeData = {
        roomId: room._id,
        type: room.type,
        name: room.name,
        description: room.description,
        pricePerNight: room.pricePerNight,
        capacity: room.capacity,
        totalRooms: room.totalRooms,
        amenities: room.amenities,
        bookings: [],
        summary: {
          totalRooms: room.totalRooms,
          availableRooms: room.totalRooms,
          occupiedRooms: 0,
          occupancyRate: 0,
        },
      };

      // Get all bookings for this room type
      let bookingQuery = {
        hotel: hotelId,
        roomId: room._id,
        status: { $in: ['confirmed', 'checked_in'] },
      };

      // Filter by date range if provided
      if (dateFrom || dateTo) {
        bookingQuery.$or = [];
        if (dateFrom && dateTo) {
          // Bookings that overlap with date range
          bookingQuery.$or.push({
            checkIn: { $lte: new Date(dateTo) },
            checkOut: { $gte: new Date(dateFrom) },
          });
        } else if (dateFrom) {
          bookingQuery.$or.push({
            checkOut: { $gte: new Date(dateFrom) },
          });
        } else if (dateTo) {
          bookingQuery.$or.push({
            checkIn: { $lte: new Date(dateTo) },
          });
        }
      }

      const bookings = await HotelBooking.find(bookingQuery)
        .populate('user', 'fullName phone email')
        .select('roomNumber checkIn checkOut user status specialRequests');

      roomTypeData.bookings = bookings.map(b => ({
        bookingId: b._id,
        roomNumber: b.roomNumber || 'TBD',
        guestName: b.user?.fullName,
        guestPhone: b.user?.phone,
        guestEmail: b.user?.email,
        checkIn: b.checkIn,
        checkOut: b.checkOut,
        status: b.status,
        specialRequests: b.specialRequests,
        duration: Math.ceil(
          (new Date(b.checkOut) - new Date(b.checkIn)) / (1000 * 60 * 60 * 24)
        ),
      }));

      // Calculate occupancy
      roomTypeData.summary.occupiedRooms = bookings.length;
      roomTypeData.summary.availableRooms = room.totalRooms - bookings.length;
      roomTypeData.summary.occupancyRate = Math.round(
        (bookings.length / room.totalRooms) * 100
      );

      occupancyData.push(roomTypeData);
    }

    // Calculate total occupancy
    const totalRooms = occupancyData.reduce((sum, r) => sum + r.summary.totalRooms, 0);
    const totalOccupied = occupancyData.reduce((sum, r) => sum + r.summary.occupiedRooms, 0);
    const totalAvailable = occupancyData.reduce((sum, r) => sum + r.summary.availableRooms, 0);

    res.status(200).json({
      success: true,
      hotel: {
        hotelId: hotel._id,
        name: hotel.name,
      },
      totalOccupancy: {
        totalRooms,
        occupiedRooms: totalOccupied,
        availableRooms: totalAvailable,
        occupancyRate: Math.round((totalOccupied / totalRooms) * 100),
      },
      dateRange: {
        from: dateFrom || new Date().toISOString().split('T')[0],
        to: dateTo || new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
      },
      roomTypes: occupancyData,
    });
  } catch (error) {
    next(error);
  }
};
