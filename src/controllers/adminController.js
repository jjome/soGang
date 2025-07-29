const db = require('../../database');

// 관리자 상태 확인
const getAdminStatus = (req, res) => {
    console.log('관리자 상태 확인 요청 - 세션:', req.session);
    
    // 세션이 없거나 isAdmin이 명시적으로 true가 아니면 false 반환
    if (!req.session || req.session.isAdmin !== true) {
        console.log('관리자 상태: false (세션 없음 또는 isAdmin이 true 아님)');
        return res.json({ isAdmin: false });
    }
    
    console.log('관리자 상태: true');
    res.json({ isAdmin: true });
};

// 온라인 유저 상태 조회
const getOnlineUsers = (req, res) => {
    if (!req.session || req.session.isAdmin !== true) {
        return res.status(401).json({ error: '관리자 권한이 필요합니다.' });
    }
    
    try {
        // socketHandlers는 app.js에서 주입받아야 함
        const socketHandlers = req.app.get('socketHandlers');
        const onlineUsers = socketHandlers.getOnlineUsersStatus();
        res.json({ onlineUsers });
    } catch (error) {
        console.error('온라인 유저 상태 조회 오류:', error);
        res.status(500).json({ error: '온라인 유저 상태 조회에 실패했습니다.' });
    }
};

// 사용자 목록 조회
const getAllUsers = async (req, res) => {
    try {
        const users = await db.getAllUsers();
        res.json({ users });
    } catch (error) {
        console.error('사용자 목록 조회 오류:', error);
        res.status(500).json({ error: '사용자 목록을 가져오는데 실패했습니다.' });
    }
};

// 암구호 변경
const changeAccessCode = async (req, res) => {
    const { newAccessCode } = req.body;
    if (!newAccessCode) return res.status(400).json({ error: '새 암구호를 입력해주세요.' });
    try {
        await db.setAccessCode(newAccessCode);
        res.json({ success: true });
    } catch (error) {
        console.error('암구호 변경 오류:', error);
        res.status(500).json({ error: '암구호 변경에 실패했습니다.' });
    }
};

// 데이터베이스 백업
const backupDatabase = async (req, res) => {
    try {
        await db.backupDatabase();
        res.json({ success: true, message: '데이터베이스 백업이 완료되었습니다.' });
    } catch (error) {
        console.error('데이터베이스 백업 오류:', error);
        res.status(500).json({ error: '데이터베이스 백업에 실패했습니다.' });
    }
};

// 데이터베이스 복원
const restoreDatabase = async (req, res) => {
    try {
        await db.restoreDatabase();
        res.json({ success: true, message: '데이터베이스 복원이 완료되었습니다.' });
    } catch (error) {
        console.error('데이터베이스 복원 오류:', error);
        res.status(500).json({ error: '데이터베이스 복원에 실패했습니다.' });
    }
};

// 사용자 삭제
const deleteUser = async (req, res) => {
    const { userId } = req.params;
    if (!userId) return res.status(400).json({ error: '사용자 ID가 필요합니다.' });
    
    try {
        const result = await db.deleteUser(userId);
        if (result.changes === 0) {
            return res.status(404).json({ error: '해당 사용자를 찾을 수 없습니다.' });
        }
        res.json({ success: true, message: '사용자가 성공적으로 삭제되었습니다.' });
    } catch (error) {
        console.error('사용자 삭제 오류:', error);
        res.status(500).json({ error: '사용자 삭제에 실패했습니다.' });
    }
};

// 관리자 로그인
const adminLogin = (req, res) => {
    const { password } = req.body;
    const { ADMIN_PASSWORD } = require('../config/app').config;
    
    console.log('관리자 로그인 시도:', { receivedPassword: password, expectedPassword: ADMIN_PASSWORD });
    
    if (password === ADMIN_PASSWORD) {
        console.log('관리자 로그인 성공');
        
        // 기존 세션 정리 (사용자 로그인 정보 제거)
        delete req.session.userId;
        delete req.session.username;
        
        // 관리자 세션 설정
        req.session.isAdmin = true;
        console.log('세션에 isAdmin 설정:', req.session.isAdmin);
        
        req.session.save((err) => {
            if (err) {
                console.error('관리자 세션 저장 오류:', err);
                return res.status(500).json({ error: '관리자 로그인 처리 중 오류가 발생했습니다.' });
            }
            console.log('관리자 세션 저장 완료, 최종 세션:', req.session);
            res.json({ success: true });
        });
    } else {
        console.log('관리자 로그인 실패: 비밀번호 불일치');
        res.status(401).json({ error: '관리자 비밀번호가 올바르지 않습니다.' });
    }
};

// 관리자 로그아웃
const adminLogout = (req, res) => {
    console.log('관리자 로그아웃 요청');
    
    // 관리자 세션만 제거
    delete req.session.isAdmin;
    
    req.session.save((err) => {
        if (err) {
            console.error('관리자 로그아웃 오류:', err);
            return res.status(500).json({ error: '관리자 로그아웃에 실패했습니다.' });
        }
        console.log('관리자 로그아웃 완료');
        res.json({ success: true });
    });
};

module.exports = {
    getAdminStatus,
    getOnlineUsers,
    getAllUsers,
    changeAccessCode,
    backupDatabase,
    restoreDatabase,
    deleteUser,
    adminLogin,
    adminLogout
}; 