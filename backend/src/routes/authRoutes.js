const express = require('express');
const router = express.Router();
const authController = require('../controllers/authController');
const authMiddleware = require('../middlewares/authMiddleware');
const accountSecurityController = require('../controllers/accountSecurityController');
const { clearSessionCookie } = require('../utils/sessionCookie');

router.post('/register', authController.register);
router.post('/login', authController.login);
router.post('/logout', (req, res) => {
  clearSessionCookie(res);
  return res.status(204).end();
});
router.post('/verify-email', accountSecurityController.verifyEmail);
router.post('/resend-verification', accountSecurityController.resendVerification);
router.post('/password/forgot', accountSecurityController.requestPasswordReset);
router.post('/password/reset', accountSecurityController.resetPassword);
router.post('/password/change', authMiddleware, accountSecurityController.changePassword);
router.post('/invitations/accept', authController.acceptInvitation);
router.get('/session', authMiddleware, authController.getSession);

module.exports = router;
