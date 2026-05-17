const mongoose = require('mongoose');

const ProductSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: [true, 'Tên sản phẩm không được để trống'],
      trim: true,
      maxlength: [100, 'Tên sản phẩm tối đa 100 ký tự'],
    },
    description: {
      type: String,
      required: [true, 'Mô tả sản phẩm không được để trống'],
      maxlength: [2000, 'Mô tả tối đa 2000 ký tự'],
    },
    category: {
      type: String,
      enum: [
        'gps_tracker',      // Thiết bị GPS
        'collar',           // Vòng cổ
        'food',             // Thức ăn
        'toy',              // Đồ chơi
        'bed',              // Giường
        'grooming',         // Làm sạch/chăm sóc
        'health',           // Sức khỏe
        'clothing',         // Quần áo
        'accessory',        // Phụ kiện
        'other'             // Khác
      ],
      required: [true, 'Danh mục sản phẩm không được để trống'],
    },
    price: {
      type: Number,
      required: [true, 'Giá sản phẩm không được để trống'],
      min: [0, 'Giá không được âm'],
    },
    discount: {
      percentage: {
        type: Number,
        default: 0,
        min: [0, 'Giảm giá không được âm'],
        max: [100, 'Giảm giá không vượt quá 100%'],
      },
      active: {
        type: Boolean,
        default: false,
      },
      validUntil: Date,
    },
    stock: {
      quantity: {
        type: Number,
        required: [true, 'Số lượng tồn kho không được để trống'],
        min: [0, 'Số lượng không được âm'],
      },
      status: {
        type: String,
        enum: ['in_stock', 'low_stock', 'out_of_stock'],
        default: 'in_stock',
      },
    },
    images: {
      type: [
        {
          url: String,
          caption: String,
        },
      ],
      validate: {
        validator: function (v) {
          return v.length > 0;
        },
        message: 'Phải có ít nhất 1 hình ảnh',
      },
    },
    petTypes: {
      type: [String],
      enum: ['dog', 'cat', 'bird', 'hamster', 'rabbit', 'other'],
      required: [true, 'Phải chọn ít nhất 1 loại thú cưng'],
    },
    specifications: {
      type: Map,
      of: String,
      description: 'Các thông số kỹ thuật (tuỳ theo loại sản phẩm)',
    },
    rating: {
      average: {
        type: Number,
        default: 0,
        min: [0, 'Xếp hạng không được dưới 0'],
        max: [5, 'Xếp hạng không được vượt quá 5'],
      },
      count: {
        type: Number,
        default: 0,
      },
    },
    reviews: [
      {
        user: {
          type: mongoose.Schema.Types.ObjectId,
          ref: 'User',
        },
        rating: {
          type: Number,
          min: 1,
          max: 5,
        },
        comment: String,
        createdAt: {
          type: Date,
          default: Date.now,
        },
      },
    ],
    seller: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    status: {
      type: String,
      enum: ['active', 'inactive', 'discontinued'],
      default: 'active',
    },
  },
  {
    timestamps: true,
  }
);

// Index for search
ProductSchema.index({ name: 'text', description: 'text' });
ProductSchema.index({ category: 1 });
ProductSchema.index({ petTypes: 1 });
ProductSchema.index({ 'stock.status': 1 });

module.exports = mongoose.model('Product', ProductSchema);
