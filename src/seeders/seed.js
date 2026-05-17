require('dotenv').config();
const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
const connectDB = require('../config/db');

// Models
const User = require('../models/User');
const Pet = require('../models/Pet');
const Vet = require('../models/Vet');
const PetHotel = require('../models/PetHotel');
const Product = require('../models/Product');

const seedData = async () => {
  try {
    await connectDB();
    console.log('🗑️  Clearing existing data...');

    await mongoose.connection.dropDatabase();

    // ========== CREATE USERS ==========
    console.log('👤 Creating users...');

    const adminUser = await User.create({
      fullName: 'PAWRENT Admin',
      email: 'admin@pawrent.vn',
      phone: '0901234567',
      password: 'admin123',
      role: 'admin',
      subscription: { plan: 'premium', isActive: true, maxPets: 99 },
    });

    const normalUser = await User.create({
      fullName: 'Nguyễn Văn Sen',
      email: 'sen@example.com',
      phone: '0912345678',
      password: 'user123',
      role: 'user',
      address: {
        street: '123 Nguyễn Huệ',
        city: 'Hồ Chí Minh',
        district: 'Quận 1',
      },
      subscription: { plan: 'free', isActive: true, maxPets: 1 },
    });

    const premiumUser = await User.create({
      fullName: 'Trần Thị Yêu Mèo',
      email: 'premium@example.com',
      phone: '0923456789',
      password: 'premium123',
      role: 'user',
      address: {
        street: '456 Lê Lợi',
        city: 'Hồ Chí Minh',
        district: 'Quận 3',
      },
      subscription: {
        plan: 'premium',
        isActive: true,
        maxPets: 3,
        startDate: new Date(),
        endDate: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000),
      },
    });

    const vetUser = await User.create({
      fullName: 'BS. Lê Minh Thú Y',
      email: 'vet@example.com',
      phone: '0934567890',
      password: 'vet123',
      role: 'vet',
      subscription: { plan: 'free', isActive: true, maxPets: 1 },
    });

    const hotelUser = await User.create({
      fullName: 'Chủ KS Paw Paradise',
      email: 'hotel@example.com',
      phone: '0945678901',
      password: 'hotel123',
      role: 'hotel_owner',
      subscription: { plan: 'free', isActive: true, maxPets: 1 },
    });

    // ========== CREATE PETS ==========
    console.log('🐶 Creating pets...');

    await Pet.create([
      {
        owner: premiumUser._id,
        name: 'Lucky',
        species: 'dog',
        breed: 'Golden Retriever',
        gender: 'male',
        dateOfBirth: new Date('2022-03-15'),
        weight: 28,
        color: 'Vàng',
        isNeutered: true,
        healthStatus: 'healthy',
      },
      {
        owner: premiumUser._id,
        name: 'Mimi',
        species: 'cat',
        breed: 'British Shorthair',
        gender: 'female',
        dateOfBirth: new Date('2023-06-20'),
        weight: 4.5,
        color: 'Xám xanh',
        healthStatus: 'healthy',
        allergies: ['Hải sản'],
      },
      {
        owner: normalUser._id,
        name: 'Bông',
        species: 'dog',
        breed: 'Poodle',
        gender: 'female',
        dateOfBirth: new Date('2023-01-10'),
        weight: 5,
        color: 'Trắng',
        healthStatus: 'healthy',
      },
    ]);

    // ========== CREATE VET ==========
    console.log('👨‍⚕️ Creating vet profiles...');

    await Vet.create({
      user: vetUser._id,
      licenseNumber: 'VN-VET-2024-001',
      specializations: ['general', 'surgery', 'dentistry'],
      speciesExpertise: ['dog', 'cat'],
      yearsOfExperience: 8,
      education: [
        {
          degree: 'Tiến sĩ Thú y',
          school: 'Đại học Nông Lâm TP.HCM',
          year: 2016,
        },
      ],
      clinic: {
        name: 'Phòng khám Thú y Sài Gòn',
        address: {
          street: '789 Điện Biên Phủ',
          city: 'Hồ Chí Minh',
          district: 'Quận Bình Thạnh',
          coordinates: { lat: 10.8021, lng: 106.7102 },
        },
        phone: '028-1234-5678',
      },
      workingHours: [
        { dayOfWeek: 1, startTime: '08:00', endTime: '17:00', isOpen: true },
        { dayOfWeek: 2, startTime: '08:00', endTime: '17:00', isOpen: true },
        { dayOfWeek: 3, startTime: '08:00', endTime: '17:00', isOpen: true },
        { dayOfWeek: 4, startTime: '08:00', endTime: '17:00', isOpen: true },
        { dayOfWeek: 5, startTime: '08:00', endTime: '17:00', isOpen: true },
        { dayOfWeek: 6, startTime: '08:00', endTime: '12:00', isOpen: true },
        { dayOfWeek: 0, startTime: '00:00', endTime: '00:00', isOpen: false },
      ],
      consultationFee: {
        inPerson: 300000,
        online: 150000,
        currency: 'VND',
      },
      isAvailableOnline: true,
      bio: 'Bác sĩ thú y với 8 năm kinh nghiệm chuyên khoa tổng quát, phẫu thuật và nha khoa cho chó mèo.',
      rating: { average: 4.8, count: 45 },
      isVerified: true,
    });

    // ========== CREATE HOTEL ==========
    console.log('🏨 Creating pet hotels...');

    await PetHotel.create({
      owner: hotelUser._id,
      name: 'Paw Paradise Hotel',
      description: 'Khách sạn thú cưng 5 sao tại trung tâm Sài Gòn. Phòng rộng rãi, sạch sẽ, camera 24/7.',
      address: {
        street: '100 Nguyễn Thị Minh Khai',
        city: 'Hồ Chí Minh',
        district: 'Quận 3',
        coordinates: { lat: 10.7769, lng: 106.6869 },
      },
      phone: '028-9876-5432',
      email: 'info@pawparadise.vn',
      acceptedPets: ['dog', 'cat'],
      services: [
        { name: 'Tắm & Spa', description: 'Tắm sạch, sấy, cắt tỉa lông', price: 200000 },
        { name: 'Dắt đi dạo', description: '30 phút đi dạo công viên', price: 50000 },
        { name: 'Đồ ăn đặc biệt', description: 'Bữa ăn cao cấp', price: 100000 },
      ],
      rooms: [
        {
          type: 'standard',
          name: 'Phòng Standard',
          description: 'Phòng tiêu chuẩn, điều hòa, camera',
          pricePerNight: 250000,
          capacity: 1,
          totalRooms: 10,
          availableRooms: 8,
          amenities: ['Điều hòa', 'Camera', 'Nước uống'],
        },
        {
          type: 'deluxe',
          name: 'Phòng Deluxe',
          description: 'Phòng rộng, có sân chơi riêng',
          pricePerNight: 400000,
          capacity: 2,
          totalRooms: 5,
          availableRooms: 3,
          amenities: ['Điều hòa', 'Camera', 'Sân chơi', 'Đồ chơi'],
        },
        {
          type: 'vip',
          name: 'Phòng VIP',
          description: 'Suite sang trọng, phục vụ riêng',
          pricePerNight: 600000,
          capacity: 2,
          totalRooms: 3,
          availableRooms: 2,
          amenities: ['Điều hòa', 'Camera', 'Sân chơi', 'Đồ chơi', 'Phục vụ riêng', 'Live stream'],
        },
      ],
      operatingHours: {
        checkIn: '14:00',
        checkOut: '12:00',
      },
      rating: { average: 4.6, count: 120 },
      policies: {
        cancellationHours: 24,
        requireVaccination: true,
        maxPetWeight: 50,
      },
      isVerified: true,
    });

    // ========== CREATE PRODUCTS ==========
    console.log('🛍️  Creating products...');

    await Product.create([
      {
        name: 'GPS Tracker Cho Thú Cưng',
        description: 'Thiết bị theo dõi vị trí GPS cho chó, mèo. Công nghệ 4G, pin 8 ngày, chống nước IP67',
        category: 'gps_tracker',
        petTypes: ['dog', 'cat'],
        price: 499000,
        currency: 'VND',
        images: [
          {
            url: 'https://res.cloudinary.com/pawrent/image/upload/v124/products/gps-tracker-1.jpg',
            caption: 'GPS Tracker chính hãng',
          },
        ],
        stock: {
          quantity: 50,
          status: 'in_stock',
        },
        discount: {
          percentage: 10,
          active: true,
          validUntil: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
        },
        rating: { average: 4.8, count: 45 },
        reviews: [],
      },
      {
        name: 'Vòng Cổ Phát Sáng LED',
        description: 'Vòng cổ LED phát sáng 3 chế độ. An toàn, dễ sạc, pin lâu dài',
        category: 'collar',
        petTypes: ['dog', 'cat'],
        price: 150000,
        currency: 'VND',
        images: [
          {
            url: 'https://res.cloudinary.com/pawrent/image/upload/v124/products/led-collar-1.jpg',
            caption: 'Vòng cổ LED',
          },
        ],
        stock: {
          quantity: 100,
          status: 'in_stock',
        },
        discount: {
          percentage: 15,
          active: true,
          validUntil: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
        },
        rating: { average: 4.6, count: 78 },
        reviews: [],
      },
      {
        name: 'Thức Ăn Cao Cấp Premium Dog Food',
        description: 'Thức ăn chó cao cấp, đặc biệt dành cho chó lông dài. Giàu dinh dưỡng, 20kg',
        category: 'food',
        petTypes: ['dog'],
        price: 850000,
        currency: 'VND',
        images: [
          {
            url: 'https://res.cloudinary.com/pawrent/image/upload/v124/products/dog-food-1.jpg',
            caption: 'Thức ăn chó premium',
          },
        ],
        stock: {
          quantity: 30,
          status: 'in_stock',
        },
        discount: {
          percentage: 5,
          active: true,
          validUntil: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
        },
        rating: { average: 4.9, count: 120 },
        reviews: [],
      },
      {
        name: 'Đồ Chơi Cao Su Dẻo Cho Mèo',
        description: 'Bộ 5 đồ chơi cao su an toàn cho mèo. Giúp thú cưng vận động, giải tỏa stress',
        category: 'toy',
        petTypes: ['cat'],
        price: 89000,
        currency: 'VND',
        images: [
          {
            url: 'https://res.cloudinary.com/pawrent/image/upload/v124/products/cat-toys-1.jpg',
            caption: 'Bộ đồ chơi mèo',
          },
        ],
        stock: {
          quantity: 200,
          status: 'in_stock',
        },
        discount: {
          percentage: 20,
          active: true,
          validUntil: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
        },
        rating: { average: 4.5, count: 56 },
        reviews: [],
      },
      {
        name: 'Giường Nệm Ôm Ấp Cho Chó',
        description: 'Giường ngủ ấm cúng cho chó, mèo. Vải cotton dịu mềm, dễ giặt. Size M 60x50cm',
        category: 'bed',
        petTypes: ['dog', 'cat'],
        price: 350000,
        currency: 'VND',
        images: [
          {
            url: 'https://res.cloudinary.com/pawrent/image/upload/v124/products/pet-bed-1.jpg',
            caption: 'Giường nệm ôm ấp',
          },
        ],
        stock: {
          quantity: 25,
          status: 'in_stock',
        },
        discount: {
          percentage: 0,
          active: false,
        },
        rating: { average: 4.7, count: 89 },
        reviews: [],
      },
      {
        name: 'Dụng Cụ Tắm Gội Chuyên Nghiệp',
        description: 'Bộ dụng cụ tắm gội: chải lông, lược, kéo cắt tỉa lông cao cấp. Bằng thép không gỉ',
        category: 'grooming',
        petTypes: ['dog', 'cat'],
        price: 299000,
        currency: 'VND',
        images: [
          {
            url: 'https://res.cloudinary.com/pawrent/image/upload/v124/products/grooming-kit-1.jpg',
            caption: 'Bộ dụng cụ tắm gội',
          },
        ],
        stock: {
          quantity: 40,
          status: 'in_stock',
        },
        discount: {
          percentage: 8,
          active: true,
          validUntil: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
        },
        rating: { average: 4.8, count: 102 },
        reviews: [],
      },
      {
        name: 'Vitamin & Bổ Sung Sức Khỏe',
        description: 'Viên bổ sung canxi, vitamin D3, Omega-3 cho chó mèo. 90 viên/hộp',
        category: 'health',
        petTypes: ['dog', 'cat'],
        price: 250000,
        currency: 'VND',
        images: [
          {
            url: 'https://res.cloudinary.com/pawrent/image/upload/v124/products/vitamins-1.jpg',
            caption: 'Vitamin & bổ sung',
          },
        ],
        stock: {
          quantity: 60,
          status: 'in_stock',
        },
        discount: {
          percentage: 12,
          active: true,
          validUntil: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
        },
        rating: { average: 4.6, count: 73 },
        reviews: [],
      },
      {
        name: 'Áo Quần Dạo Phố Cho Chó',
        description: 'Bộ áo quần chó đáng yêu, chống nước, ấm. Size S M L XL. Nhiều mẫu mã',
        category: 'clothing',
        petTypes: ['dog'],
        price: 199000,
        currency: 'VND',
        images: [
          {
            url: 'https://res.cloudinary.com/pawrent/image/upload/v124/products/dog-clothes-1.jpg',
            caption: 'Áo quần chó',
          },
        ],
        stock: {
          quantity: 80,
          status: 'in_stock',
        },
        discount: {
          percentage: 18,
          active: true,
          validUntil: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
        },
        rating: { average: 4.4, count: 34 },
        reviews: [],
      },
      {
        name: 'Phụ Kiện Đi Dạo: Dây Xích & Vòng Cổ',
        description: 'Bộ dây xích và vòng cổ cao cấp. Da thật, khóa an toàn. Cho chó, mèo',
        category: 'accessory',
        petTypes: ['dog', 'cat'],
        price: 450000,
        currency: 'VND',
        images: [
          {
            url: 'https://res.cloudinary.com/pawrent/image/upload/v124/products/leash-collar-1.jpg',
            caption: 'Dây xích & vòng cổ',
          },
        ],
        stock: {
          quantity: 35,
          status: 'in_stock',
        },
        discount: {
          percentage: 10,
          active: true,
          validUntil: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
        },
        rating: { average: 4.7, count: 91 },
        reviews: [],
      },
      {
        name: 'Khay Vệ Sinh Tự Động',
        description: 'Khay vệ sinh thông minh tự vệ sinh cho mèo. Tiết kiệm cát, sạch sẽ, mùi hôi',
        category: 'other',
        petTypes: ['cat'],
        price: 1200000,
        currency: 'VND',
        images: [
          {
            url: 'https://res.cloudinary.com/pawrent/image/upload/v124/products/auto-litter-box-1.jpg',
            caption: 'Khay vệ sinh tự động',
          },
        ],
        stock: {
          quantity: 8,
          status: 'low_stock',
        },
        discount: {
          percentage: 0,
          active: false,
        },
        rating: { average: 4.9, count: 28 },
        reviews: [],
      },
    ]);

    console.log('\n✅ Seed data created successfully!');
    console.log('═══════════════════════════════════');
    console.log('Test Accounts:');
    console.log('───────────────────────────────────');
    console.log('Admin:    admin@pawrent.vn  / admin123');
    console.log('User:     sen@example.com   / user123');
    console.log('Premium:  premium@example.com / premium123');
    console.log('Vet:      vet@example.com   / vet123');
    console.log('Hotel:    hotel@example.com  / hotel123');
    console.log('═══════════════════════════════════\n');

    process.exit(0);
  } catch (error) {
    console.error('❌ Seed error:', error);
    process.exit(1);
  }
};

seedData();
