const express = require('express');
const router = express.Router();
const authController = require('../controllers/authController');
const { requireAuth } = require('../middleware/auth');

// 사용자 정보 조회
router.get('/user', authController.getUserInfo);

// 비밀번호 변경
router.post('/change-password', requireAuth, authController.changePassword);

// 회원가입
router.post('/register', authController.register);

// 로그인
router.post('/login', authController.login);

// 로그아웃
router.post('/logout', authController.logout);

// 암구호 검증
router.post('/access-code', authController.verifyAccessCode);

module.exports = router; 