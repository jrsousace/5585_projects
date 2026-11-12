const express = require('express');
const router = express.Router();
const organizationController = require('../controllers/organizationController');
const authMiddleware = require('../middlewares/authMiddleware');
const { requireOrganizationManager } = require('../middlewares/permissionMiddleware');

router.use(authMiddleware, requireOrganizationManager);
router.get('/members', organizationController.listMembers);
router.get('/invitations', organizationController.listInvitations);
router.get('/audit', organizationController.listAudit);
router.post('/invitations', organizationController.createInvitation);
router.delete('/invitations/:invitationId', organizationController.revokeInvitation);
router.put('/members/:memberId/access-level', organizationController.setMemberAccessLevel);
router.put('/members/:memberId/status', organizationController.setMemberStatus);

module.exports = router;
