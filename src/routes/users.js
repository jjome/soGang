const express = require('express');
const router = express.Router();
const userController = require('../controllers/userController');
const { requireAuth } = require('../middleware/auth');

// 유저 통계 관련 라우트들
router.get('/:username/stats', requireAuth, userController.getUserStats);
router.put('/:username/stats', requireAuth, userController.updateUserStats);

// 유저 장점 상태 관련 라우트들
router.get('/:username/adv-status', requireAuth, userController.getUserAdvStatus);
router.put('/:username/adv-status', requireAuth, userController.updateUserAdvStatus);

// 유저 단점 상태 관련 라우트들
router.get('/:username/dis-status', requireAuth, userController.getUserDisStatus);
router.put('/:username/dis-status', requireAuth, userController.updateUserDisStatus);

// 유저 게임 히스토리 관련 라우트들
router.get('/:username/games', requireAuth, userController.getUserGameHistory);
router.get('/:username/achievements', requireAuth, userController.getUserAchievements);

module.exports = router;
