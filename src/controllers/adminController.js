const db = require('../../database');
const bcrypt = require('bcryptjs');

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
const adminLogin = async (req, res) => {
    const { password } = req.body;

    if (!password) {
        return res.status(400).json({ error: '비밀번호를 입력해주세요.' });
    }

    try {
        // DB에서 관리자 비밀번호 해시 가져오기
        const hashedPassword = await db.getAdminPassword();

        if (!hashedPassword) {
            console.error('관리자 비밀번호가 데이터베이스에 설정되지 않았습니다.');
            return res.status(500).json({ error: '관리자 비밀번호가 설정되지 않았습니다.' });
        }

        // bcrypt로 비밀번호 검증
        const isPasswordValid = await bcrypt.compare(password, hashedPassword);

        if (isPasswordValid) {
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
    } catch (error) {
        console.error('관리자 로그인 오류:', error);
        res.status(500).json({ error: '로그인 처리 중 오류가 발생했습니다.' });
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

// 관리자 비밀번호 변경
const changeAdminPassword = async (req, res) => {
    const { currentPassword, newPassword } = req.body;

    // 입력값 검증
    if (!currentPassword || !newPassword) {
        return res.status(400).json({ error: '현재 비밀번호와 새 비밀번호를 모두 입력해주세요.' });
    }

    if (newPassword.length < 4) {
        return res.status(400).json({ error: '새 비밀번호는 최소 4자 이상이어야 합니다.' });
    }

    try {
        // DB에서 현재 관리자 비밀번호 해시 가져오기
        const currentHashedPassword = await db.getAdminPassword();

        if (!currentHashedPassword) {
            console.error('관리자 비밀번호가 데이터베이스에 설정되지 않았습니다.');
            return res.status(500).json({ error: '관리자 비밀번호가 설정되지 않았습니다.' });
        }

        // 현재 비밀번호 확인
        const isCurrentPasswordValid = await bcrypt.compare(currentPassword, currentHashedPassword);

        if (!isCurrentPasswordValid) {
            return res.status(401).json({ error: '현재 비밀번호가 올바르지 않습니다.' });
        }

        // 새 비밀번호 해시화 (salt rounds 12)
        const newHashedPassword = await bcrypt.hash(newPassword, 12);

        // DB에 새 비밀번호 저장
        await db.setAdminPassword(newHashedPassword);

        console.log('관리자 비밀번호 변경 성공');
        res.json({ success: true, message: '관리자 비밀번호가 성공적으로 변경되었습니다.' });
    } catch (error) {
        console.error('관리자 비밀번호 변경 오류:', error);
        res.status(500).json({ error: '비밀번호 변경 중 오류가 발생했습니다.' });
    }
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
    adminLogout,
    changeAdminPassword
}; 