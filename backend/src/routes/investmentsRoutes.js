const express = require('express');
const router = express.Router();
const investmentsController = require('../controllers/investmentsController');
const authMiddleware = require('../middlewares/authMiddleware');

router.use(authMiddleware);

router.get('/', investmentsController.getInvestments);
router.post('/', investmentsController.createInvestment);

module.exports = router;
