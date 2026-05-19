const express = require('express');

const router = express.Router();

// Vet routes have been consolidated into auth/vets endpoint (public)
// and admin/users endpoints (for management)
// All appointment-related functionality is in appointmentRoutes.js

module.exports = router;
