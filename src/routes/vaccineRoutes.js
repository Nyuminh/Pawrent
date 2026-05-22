const express = require('express');
const router = express.Router();
const vaccineController = require('../controllers/vaccineController');
const { protect } = require('../middleware/auth');

// Create vaccine(s) - POST array of vaccines
router.post('/', protect, vaccineController.createVaccines);

// Get all vaccines (vet only)
router.get('/all', protect, vaccineController.getAllVaccines);

// Get vaccines by pet
router.get('/pet/:petId', protect, vaccineController.getVaccinesByPet);

// Get upcoming vaccines for pet
router.get('/pet/:petId/upcoming', protect, vaccineController.getUpcomingVaccines);

// Get overdue vaccines for pet
router.get('/pet/:petId/overdue', protect, vaccineController.getOverdueVaccines);

// Get single vaccine
router.get('/:id', protect, vaccineController.getVaccine);

// Update vaccine
router.put('/:id', protect, vaccineController.updateVaccine);

// Delete vaccine
router.delete('/:id', protect, vaccineController.deleteVaccine);

module.exports = router;
