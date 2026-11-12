const express = require('express');
const router = express.Router();
const billingController = require('../controllers/billingController');
const authMiddleware = require('../middlewares/authMiddleware');
const { requireOrganizationOwner } = require('../middlewares/permissionMiddleware');

router.post('/checkout', authMiddleware, requireOrganizationOwner, billingController.createCheckout);
router.post('/cancel', authMiddleware, requireOrganizationOwner, billingController.cancelSubscription);

module.exports = router;
