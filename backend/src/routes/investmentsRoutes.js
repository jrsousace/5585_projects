const express = require('express');
const router = express.Router();
const investmentsController = require('../controllers/investmentsController');
const authMiddleware = require('../middlewares/authMiddleware');
const { requirePermission } = require('../middlewares/permissionMiddleware');

router.use(authMiddleware);

router.get('/', requirePermission('investments', 'read'), investmentsController.getInvestments);
router.post('/', requirePermission('investments', 'write'), investmentsController.createInvestment);

module.exports = router;
