const mongoose = require('mongoose');

// Cache the connection promise so all requests during cold start
// await the SAME connection instead of creating multiple ones.
let cachedConnection = null;

const connectDB = async () => {
  // If already connected, reuse
  if (mongoose.connection.readyState === 1) {
    return;
  }

  // If a connection attempt is already in progress, await it
  if (cachedConnection) {
    await cachedConnection;
    return;
  }

  try {
    cachedConnection = mongoose.connect(process.env.MONGO_URI, {
      serverSelectionTimeoutMS: 5000,
      bufferCommands: false, // Disable buffering — fail fast if not connected
    });

    const db = await cachedConnection;
    console.log(`✅ MongoDB Connected: ${db.connection.host}`);
  } catch (error) {
    cachedConnection = null; // Reset so next request can retry
    console.error(`❌ MongoDB Connection Error: ${error.message}`);
    throw error;
  }
};

module.exports = connectDB;
