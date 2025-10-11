const express = require('express');
const router = express.Router();
const adminController = require('../controllers/adminController');
const { requireAdmin } = require('../middleware/auth');

// 관리자 상태 확인
router.get('/status', adminController.getAdminStatus);

// 온라인 유저 상태 조회
router.get('/online-users', requireAdmin, adminController.getOnlineUsers);

// 사용자 목록 조회
router.get('/users', requireAdmin, adminController.getAllUsers);

// 암구호 변경
router.post('/change-access-code', requireAdmin, adminController.changeAccessCode);

// 데이터베이스 백업
router.post('/backup-database', requireAdmin, adminController.backupDatabase);

// 데이터베이스 복원
router.post('/restore-database', requireAdmin, adminController.restoreDatabase);

// 사용자 삭제
router.delete('/users/:userId', requireAdmin, adminController.deleteUser);

// 관리자 로그인
router.post('/login', adminController.adminLogin);

// 관리자 로그아웃
router.post('/logout', adminController.adminLogout);

// 관리자 비밀번호 변경
router.post('/change-password', requireAdmin, adminController.changeAdminPassword);

module.exports = router; 