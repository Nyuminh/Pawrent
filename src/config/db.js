const mongoose = require('mongoose');

let isConnected = false;

const connectDB = async () => {
  if (isConnected) {
    console.log('=> Using existing database connection');
    return;
  }

  try {
    const db = await mongoose.connect(process.env.MONGO_URI, {
      serverSelectionTimeoutMS: 5000, // Timeout sau 5s thay vi 30s
    });

    isConnected = db.connections[0].readyState;
    console.log(`✅ MongoDB Connected: ${db.connection.host}`);
  } catch (error) {
    console.error(`❌ MongoDB Connection Error: ${error.message}`);
    // Khong su dung process.exit(1) tren Vercel
    throw error; // Throw de Middleware handler co the bat duoc
  }
};

module.exports = connectDB;
