const jwt = require('jsonwebtoken');
const User = require('../models/User');

// Helper: Send token response
const sendTokenResponse = async (user, statusCode, res, message) => {
  // Generate tokens manually to support lean objects
  const accessToken = jwt.sign(
    { id: user._id, role: user.role },
    process.env.JWT_SECRET,
    { expiresIn: process.env.JWT_EXPIRE }
  );
  const refreshToken = jwt.sign(
    { id: user._id },
    process.env.JWT_REFRESH_SECRET,
    { expiresIn: process.env.JWT_REFRESH_EXPIRE }
  );

  const lastLogin = new Date();

  // Save refresh token using updateOne (much faster than save())
  await User.updateOne(
    { _id: user._id },
    { $set: { refreshToken, lastLogin } }
  );

  // Remove sensitive fields
  const userData = user.toObject ? user.toObject() : { ...user };
  delete userData.password;
  delete userData.refreshToken;
  userData.lastLogin = lastLogin;

  res.status(statusCode).json({
    success: true,
    message,
    data: {
      user: userData,
      accessToken,
      refreshToken,
      tokenType: 'Bearer',
      expiresIn: process.env.JWT_EXPIRE,
    },
  });
};

// @desc    Register user or vet
// @route   POST /api/v1/auth/register
// @access  Public
// @param   role: 'user' - người dùng thường, 'vet' - bác sĩ thú y
exports.register = async (req, res, next) => {
  try {
    const { fullName, email, phone, password, role, ...vetData } = req.body;

    // --- Role validation ---
    const PUBLIC_ALLOWED_ROLES = ['user', 'vet'];
    const ALL_VALID_ROLES = ['user', 'vet', 'hotel_owner', 'admin'];

    if (role !== undefined && role !== null) {
      // Must be a non-empty string
      if (typeof role !== 'string' || role.trim().length === 0) {
        return res.status(400).json({
          success: false,
          message: 'Role phải là một chuỗi hợp lệ.',
        });
      }

      // Must be a known role
      if (!ALL_VALID_ROLES.includes(role)) {
        return res.status(400).json({
          success: false,
          message: `Role không hợp lệ. Các role hợp lệ: ${ALL_VALID_ROLES.join(', ')}.`,
        });
      }

      // admin & hotel_owner cannot self-register
      if (!PUBLIC_ALLOWED_ROLES.includes(role)) {
        return res.status(403).json({
          success: false,
          message: `Bạn không có quyền đăng ký với vai trò "${role}". Chỉ admin mới có thể tạo tài khoản này.`,
        });
      }
    }

    const assignedRole = role || 'user';

    // Check if user exists
    const existingUser = await User.findOne({ email });
    if (existingUser) {
      return res.status(400).json({
        success: false,
        message: 'Email đã được đăng ký. Vui lòng sử dụng email khác.',
      });
    }

    // Build subscription defaults based on role
    const subscription =
      assignedRole === 'vet'
        ? { plan: 'free', name: 'Miễn phí', durationUnit: 'year', isActive: true, maxPets: 0 }
        : { plan: 'free', name: 'Miễn phí', durationUnit: 'year', isActive: true, maxPets: 1 };

    const user = await User.create({
      fullName,
      email,
      phone,
      password,
      role: assignedRole,
      subscription,
    });

    // Generate token response
    const accessToken = user.generateAccessToken();
    const refreshToken = user.generateRefreshToken();

    user.refreshToken = refreshToken;
    user.lastLogin = new Date();
    await user.save({ validateBeforeSave: false });

    const userData = user.toObject();
    delete userData.password;
    delete userData.refreshToken;

    res.status(201).json({
      success: true,
      message: assignedRole === 'vet'
        ? 'Đăng ký bác sĩ thú y thành công!'
        : 'Đăng ký thành công!',
      data: {
        user: userData,
        accessToken,
        refreshToken,
        tokenType: 'Bearer',
        expiresIn: process.env.JWT_EXPIRE,
      },
    });
  } catch (error) {
    // Handle duplicate key error
    if (error.code === 11000) {
      const field = Object.keys(error.keyPattern)[0];
      return res.status(409).json({
        success: false,
        message: `${field === 'licenseNumber' ? 'Số giấy phép hành nghề' : field} này đã tồn tại.`,
      });
    }
    next(error);
  }
};

// @desc    Register hotel owner with initial hotel information
// @route   POST /api/v1/auth/register-hotel-owner
// @access  Public
// Creates user account with hotel_owner role + creates initial hotel
exports.registerHotelOwner = async (req, res, next) => {
  try {
    const {
      // User info
      fullName,
      email,
      phone,
      password,
      // Hotel info
      hotelName,
      hotelDescription,
      hotelPhone,
      hotelEmail,
      address,
    } = req.body;

    // Validate required fields
    if (!fullName || !email || !phone || !password) {
      return res.status(400).json({
        success: false,
        message: 'Vui lòng nhập đầy đủ thông tin tài khoản (tên, email, phone, mật khẩu).',
      });
    }

    if (!hotelName || !hotelDescription) {
      return res.status(400).json({
        success: false,
        message: 'Vui lòng nhập đầy đủ thông tin khách sạn (tên, mô tả).',
      });
    }

    if (!address || !address.street || !address.city) {
      return res.status(400).json({
        success: false,
        message: 'Vui lòng nhập đầy đủ địa chỉ (đường, thành phố).',
      });
    }

    if (password.length < 6) {
      return res.status(400).json({
        success: false,
        message: 'Mật khẩu phải có ít nhất 6 ký tự.',
      });
    }

    // Check if user exists
    const existingUser = await User.findOne({ email });
    if (existingUser) {
      return res.status(400).json({
        success: false,
        message: 'Email đã được đăng ký. Vui lòng sử dụng email khác.',
      });
    }

    // Create user with hotel_owner role
    const user = await User.create({
      fullName,
      email,
      phone,
      password,
      role: 'hotel_owner',
      subscription: { plan: 'free', name: 'Miễn phí', durationUnit: 'year', isActive: true, maxPets: 1 },
    });

    // Create initial hotel
    const PetHotel = require('../models/PetHotel');
    const hotel = await PetHotel.create({
      owner: user._id,
      name: hotelName,
      description: hotelDescription,
      phone: hotelPhone || phone,
      email: hotelEmail || email,
      address,
      services: [],
      rooms: [],
      operatingHours: {
        checkIn: '14:00',
        checkOut: '12:00',
        isOpen24h: false,
      },
      isActive: true,
    });

    // Generate tokens
    const accessToken = user.generateAccessToken();
    const refreshToken = user.generateRefreshToken();

    user.refreshToken = refreshToken;
    user.lastLogin = new Date();
    await user.save({ validateBeforeSave: false });

    const userData = user.toObject();
    delete userData.password;
    delete userData.refreshToken;

    res.status(201).json({
      success: true,
      message: 'Đăng ký chủ khách sạn thú cưng thành công! Khách sạn đã được tạo.',
      data: {
        user: userData,
        hotel: {
          hotelId: hotel._id,
          name: hotel.name,
          slug: hotel.slug,
        },
        accessToken,
        refreshToken,
        tokenType: 'Bearer',
        expiresIn: process.env.JWT_EXPIRE,
      },
    });
  } catch (error) {
    if (error.code === 11000) {
      const field = Object.keys(error.keyPattern)[0];
      return res.status(409).json({
        success: false,
        message: `${field} này đã tồn tại.`,
      });
    }
    next(error);
  }
};

// @desc    Login user
// @route   POST /api/v1/auth/login
// @access  Public
exports.login = async (req, res, next) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({
        success: false,
        message: 'Vui lòng nhập email và mật khẩu.',
      });
    }

    // Optimize performance: use .lean() to bypass heavy mongoose document instantiation
    const user = await User.findOne({ email }).select('+password').lean();
    if (!user) {
      return res.status(401).json({
        success: false,
        message: 'Email hoặc mật khẩu không chính xác.',
      });
    }

    if (!user.isActive) {
      return res.status(401).json({
        success: false,
        message: 'Tài khoản đã bị vô hiệu hóa. Vui lòng liên hệ admin.',
      });
    }

    const bcrypt = require('bcryptjs');
    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) {
      return res.status(401).json({
        success: false,
        message: 'Email hoặc mật khẩu không chính xác.',
      });
    }

    // Re-hash old passwords to lower cost (10) for faster future logins
    if (user.password && (user.password.startsWith('$2a$12$') || user.password.startsWith('$2b$12$'))) {
      const salt = await bcrypt.genSalt(10);
      const newHash = await bcrypt.hash(password, salt);
      await User.updateOne({ _id: user._id }, { $set: { password: newHash } });
    }

    await sendTokenResponse(user, 200, res, 'Đăng nhập thành công!');
  } catch (error) {
    next(error);
  }
};

// @desc    Refresh token
// @route   POST /api/v1/auth/refresh-token
// @access  Public
exports.refreshToken = async (req, res, next) => {
  try {
    const { refreshToken } = req.body;

    if (!refreshToken) {
      return res.status(400).json({
        success: false,
        message: 'Refresh token không được cung cấp.',
      });
    }

    // Verify refresh token
    const jwt = require('jsonwebtoken');
    const decoded = jwt.verify(refreshToken, process.env.JWT_REFRESH_SECRET);

    const user = await User.findById(decoded.id).select('+refreshToken role').lean();
    if (!user || user.refreshToken !== refreshToken) {
      return res.status(401).json({
        success: false,
        message: 'Refresh token không hợp lệ.',
      });
    }

    // Generate new tokens manually
    const newAccessToken = jwt.sign(
      { id: user._id, role: user.role },
      process.env.JWT_SECRET,
      { expiresIn: process.env.JWT_EXPIRE }
    );
    const newRefreshToken = jwt.sign(
      { id: user._id },
      process.env.JWT_REFRESH_SECRET,
      { expiresIn: process.env.JWT_REFRESH_EXPIRE }
    );

    await User.updateOne(
      { _id: user._id },
      { $set: { refreshToken: newRefreshToken } }
    );

    res.status(200).json({
      success: true,
      message: 'Token đã được làm mới.',
      data: {
        accessToken: newAccessToken,
        refreshToken: newRefreshToken,
        tokenType: 'Bearer',
        expiresIn: process.env.JWT_EXPIRE,
      },
    });
  } catch (error) {
    if (error.name === 'TokenExpiredError') {
      return res.status(401).json({
        success: false,
        message: 'Refresh token đã hết hạn. Vui lòng đăng nhập lại.',
      });
    }
    next(error);
  }
};

// @desc    Logout
// @route   POST /api/v1/auth/logout
// @access  Private
exports.logout = async (req, res, next) => {
  try {
    req.user.refreshToken = undefined;
    await req.user.save({ validateBeforeSave: false });

    res.status(200).json({
      success: true,
      message: 'Đăng xuất thành công.',
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Get current user
// @route   GET /api/v1/auth/me
// @access  Private
exports.getMe = async (req, res, next) => {
  try {
    const user = await User.findById(req.user.id).populate({
      path: 'pets',
      match: { isActive: true }
    });

    res.status(200).json({
      success: true,
      data: user,
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Update profile
// @route   PUT /api/v1/auth/profile
// @access  Private
exports.updateProfile = async (req, res, next) => {
  try {
    const allowedFields = ['fullName', 'phone', 'address'];
    const updates = {};

    allowedFields.forEach((field) => {
      if (req.body[field] !== undefined) {
        updates[field] = req.body[field];
      }
    });

    // Handle avatar upload from Cloudinary
    if (req.file) {
      updates.avatar = req.file.path; // Cloudinary returns file.path as URL
    }

    const user = await User.findByIdAndUpdate(req.user.id, updates, {
      new: true,
      runValidators: true,
    });

    res.status(200).json({
      success: true,
      message: 'Cập nhật thông tin thành công.',
      data: user,
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Change password
// @route   PUT /api/v1/auth/change-password
// @access  Private
exports.changePassword = async (req, res, next) => {
  try {
    const { currentPassword, newPassword } = req.body;

    if (!currentPassword || !newPassword) {
      return res.status(400).json({
        success: false,
        message: 'Vui lòng nhập mật khẩu hiện tại và mật khẩu mới.',
      });
    }

    if (newPassword.length < 6) {
      return res.status(400).json({
        success: false,
        message: 'Mật khẩu mới phải có ít nhất 6 ký tự.',
      });
    }

    const user = await User.findById(req.user.id).select('+password');

    const isMatch = await user.matchPassword(currentPassword);
    if (!isMatch) {
      return res.status(400).json({
        success: false,
        message: 'Mật khẩu hiện tại không chính xác.',
      });
    }

    user.password = newPassword;
    await user.save();

    await sendTokenResponse(user, 200, res, 'Đổi mật khẩu thành công.');
  } catch (error) {
    next(error);
  }
};

// @desc    Get all vets (users with vet role)
// @route   GET /api/v1/auth/vets
// @access  Public
exports.getAllVets = async (req, res, next) => {
  try {
    const { page = 1, limit = 20, search } = req.query;

    const query = { role: 'vet' };

    if (search) {
      query.$or = [
        { fullName: new RegExp(search, 'i') },
        { email: new RegExp(search, 'i') },
      ];
    }

    const total = await User.countDocuments(query);
    const vets = await User.find(query)
      .select('fullName avatar email phone address subscription')
      .sort('-createdAt')
      .skip((page - 1) * limit)
      .limit(Number(limit));

    res.status(200).json({
      success: true,
      count: vets.length,
      total,
      page: Number(page),
      totalPages: Math.ceil(total / limit),
      data: vets,
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Nâng cấp role lên hotel_owner (gọi sau khi thanh toán gói HOTEL_OWNER)
// @route   POST /api/v1/auth/upgrade-hotel-owner
// @access  Private
exports.upgradeToHotelOwner = async (req, res, next) => {
  try {
    const user = await User.findById(req.user.id);

    if (!user) {
      return res.status(404).json({ success: false, message: 'Không tìm thấy người dùng.' });
    }

    if (user.role === 'hotel_owner') {
      return res.status(400).json({
        success: false,
        message: 'Tài khoản của bạn đã là Hotel Owner.',
      });
    }

    // Chỉ cho phép nâng từ user thường lên hotel_owner
    const allowedRoles = ['user'];
    if (!allowedRoles.includes(user.role)) {
      return res.status(403).json({
        success: false,
        message: `Không thể nâng cấp từ role "${user.role}" lên hotel_owner.`,
      });
    }

    user.role = 'hotel_owner';
    await user.save({ validateBeforeSave: false });

    // Trả về user data mới (không có password)
    const userData = user.toObject();
    delete userData.password;
    delete userData.refreshToken;

    return res.status(200).json({
      success: true,
      message: 'Nâng cấp lên Hotel Owner thành công!',
      data: { user: userData },
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Login with Google
// @route   POST /api/v1/auth/google
// @access  Public
exports.googleLogin = async (req, res, next) => {
  try {
    const { idToken } = req.body;
    if (!idToken) {
      return res.status(400).json({ success: false, message: 'Google ID Token is required.' });
    }

    // Verify token with google-auth-library
    const { OAuth2Client } = require('google-auth-library');
    const client = new OAuth2Client(process.env.GOOGLE_CLIENT_ID);

    const ticket = await client.verifyIdToken({
      idToken,
      audience: process.env.GOOGLE_CLIENT_ID,
    });
    const payload = ticket.getPayload();
    const { sub: googleId, email, name: fullName, picture: avatar } = payload;

    // Check if user exists by googleId
    let user = await User.findOne({ googleId });

    if (!user) {
      // Check if user exists by email (to link accounts if they already registered with same email)
      user = await User.findOne({ email });
      if (user) {
        user.googleId = googleId;
        user.isGoogleLogin = true;
        if (!user.avatar || user.avatar === 'default-avatar.png') {
          user.avatar = avatar;
        }
        await user.save({ validateBeforeSave: false }); // skip validators if any
      } else {
        // Create new user
        user = await User.create({
          googleId,
          email,
          fullName,
          avatar,
          isGoogleLogin: true,
          role: 'user',
          subscription: { plan: 'free', name: 'Miễn phí', durationUnit: 'year', isActive: true, maxPets: 1 }
        });
      }
    } else if (!user.isActive) {
      return res.status(401).json({
        success: false,
        message: 'Tài khoản đã bị vô hiệu hóa. Vui lòng liên hệ admin.',
      });
    }

    await sendTokenResponse(user, 200, res, 'Đăng nhập Google thành công!');
  } catch (error) {
    console.error("Google Login Error:", error);
    res.status(401).json({ success: false, message: 'Xác thực Google thất bại hoặc Token không hợp lệ.' });
  }
};
