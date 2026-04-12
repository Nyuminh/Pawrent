require('dotenv').config();
const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
const connectDB = require('../config/db');

// Models
const User = require('../models/User');
const Pet = require('../models/Pet');
const Vet = require('../models/Vet');
const PetHotel = require('../models/PetHotel');

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
