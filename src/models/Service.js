const mongoose = require('mongoose');

const ServiceSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: [true, 'Vui lòng nhập tên dịch vụ'],
      trim: true,
      maxlength: [100, 'Tên dịch vụ không quá 100 ký tự'],
      unique: true,
    },
    description: {
      type: String,
      required: [true, 'Vui lòng nhập mô tả dịch vụ'],
      trim: true,
      maxlength: [2000, 'Mô tả dịch vụ không quá 2000 ký tự'],
    },
    price: {
      type: Number,
      required: [true, 'Vui lòng nhập giá dịch vụ'],
      min: [0, 'Giá dịch vụ phải lớn hơn 0'],
    },
    promotion: {
      type: Number,
      min: [0, 'Khuyến mãi phải lớn hơn 0'],
      max: [100, 'Khuyến mãi không quá 100%'],
      default: 0,
    },
    images: [
      {
        type: String,
        description: 'URL hình ảnh được lưu trữ trên Cloudinary',
      },
    ],
    isActive: {
      type: Boolean,
      default: true,
    },
    createdBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
    },
  },
  { timestamps: true }
);

module.exports = mongoose.model('Service', ServiceSchema);
