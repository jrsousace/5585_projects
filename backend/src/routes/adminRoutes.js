const express = require('express');
const router = express.Router();
const adminController = require('../controllers/adminController');
const authMiddleware = require('../middlewares/authMiddleware');
const { requireMaster } = require('../middlewares/permissionMiddleware');

router.use(authMiddleware, requireMaster);
router.get('/organizations', adminController.listOrganizations);
router.get('/organizations/:organizationId/audit', adminController.listOrganizationAudit);
router.put('/users/:userId/status', adminController.setUserStatus);
router.put('/organizations/:organizationId/subscription', adminController.setOrganizationSubscription);

module.exports = router;
