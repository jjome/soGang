const bcrypt = require('bcryptjs');
const db = require('../../database');

// 사용자 정보 조회
const getUserInfo = (req, res) => {
    if (req.session.username) {
        res.json({ username: req.session.username });
    } else {
        res.status(401).json({ error: '로그인이 필요합니다.' });
    }
};

// 비밀번호 변경
const changePassword = async (req, res) => {
    if (!req.session.userId) {
        return res.status(401).json({ error: '로그인이 필요합니다.' });
    }
    
    const { currentPassword, newPassword } = req.body;
    
    if (!currentPassword || !newPassword) {
        return res.status(400).json({ error: '현재 비밀번호와 새 비밀번호를 입력해주세요.' });
    }
    
    if (newPassword.length < 4) {
        return res.status(400).json({ error: '새 비밀번호는 최소 4자 이상이어야 합니다.' });
    }
    
    try {
        // 현재 사용자 정보 가져오기
        const user = await db.getUserById(req.session.userId);
        if (!user) {
            return res.status(404).json({ error: '사용자를 찾을 수 없습니다.' });
        }
        
        // 현재 비밀번호 확인
        const isCurrentPasswordValid = await bcrypt.compare(currentPassword, user.password);
        if (!isCurrentPasswordValid) {
            return res.status(401).json({ error: '현재 비밀번호가 올바르지 않습니다.' });
        }
        
        // 새 비밀번호 해시화
        const hashedNewPassword = await bcrypt.hash(newPassword, 10);
        
        // 비밀번호 업데이트
        await db.updateUserPassword(req.session.userId, hashedNewPassword);
        
        res.json({ success: true, message: '비밀번호가 성공적으로 변경되었습니다.' });
    } catch (error) {
        console.error('비밀번호 변경 오류:', error);
        res.status(500).json({ error: '비밀번호 변경에 실패했습니다.' });
    }
};

// 회원가입
const register = async (req, res) => {
    const { username, password } = req.body;
    
    // 입력값 검증
    if (!username || !password) {
        return res.status(400).json({ 
            success: false,
            error: '사용자명과 비밀번호를 모두 입력해주세요.' 
        });
    }
    
    // 사용자명 길이 검증
    if (username.length < 2) {
        return res.status(400).json({ 
            success: false,
            error: '사용자명은 최소 2자 이상이어야 합니다.' 
        });
    }
    
    if (username.length > 20) {
        return res.status(400).json({ 
            success: false,
            error: '사용자명은 최대 20자까지 가능합니다.' 
        });
    }
    
    // 사용자명 형식 검증 (한글, 영문, 숫자만 허용)
    if (!/^[가-힣a-zA-Z0-9]+$/.test(username)) {
        return res.status(400).json({ 
            success: false,
            error: '사용자명은 한글, 영문, 숫자만 사용 가능합니다.' 
        });
    }
    
    try {
        const existingUser = await db.getUser(username);
        if (existingUser) {
            return res.status(400).json({ 
                success: false,
                error: '이미 존재하는 사용자명입니다. 다른 사용자명을 선택해주세요.' 
            });
        }
        
        const hashedPassword = await bcrypt.hash(password, 10);
        await db.createUser(username, hashedPassword);
        res.json({ success: true });
    } catch (error) {
        console.error('회원가입 오류:', error);
        
        // 데이터베이스 오류에 대한 구체적인 메시지
        if (error.code === 'SQLITE_CONSTRAINT') {
            res.status(400).json({ 
                success: false,
                error: '이미 존재하는 사용자명입니다.' 
            });
        } else {
            res.status(500).json({ 
                success: false,
                error: '서버 오류가 발생했습니다. 잠시 후 다시 시도해주세요.' 
            });
        }
    }
};

// 로그인
const login = async (req, res) => {
    const { username, password, accessCode } = req.body;
    if (!username || !password) {
        return res.status(400).json({ message: '아이디와 비밀번호를 입력해주세요.' });
    }
    try {
        const currentAccessCode = await db.getAccessCode();
        // accessCode가 없는 경우(최초 로그인 시) 프론트에 암구호 입력 요구
        if (typeof accessCode === 'undefined') {
            return res.status(400).json({ requireAccessCode: true, message: '암구호를 입력하세요.' });
        }
        if (accessCode !== currentAccessCode) {
            return res.status(401).json({ message: '암구호가 올바르지 않습니다.' });
        }
        const user = await db.getUser(username);
        if (!user || !(await bcrypt.compare(password, user.password))) {
            return res.status(401).json({ message: '아이디 또는 비밀번호가 올바르지 않습니다.' });
        }
        req.session.userId = user.id;
        req.session.username = user.username;
        req.session.save((err) => {
            if (err) {
                console.error('세션 저장 오류:', err);
                return res.status(500).json({ message: '로그인 처리 중 오류가 발생했습니다.' });
            }
            res.json({ success: true, username: user.username });
        });
    } catch (error) {
        console.error('로그인 오류:', error);
        res.status(500).json({ message: '서버 오류가 발생했습니다.' });
    }
};

// 로그아웃
const logout = (req, res) => {
    req.session.destroy(err => {
        if (err) {
            console.error('로그아웃 오류:', err);
            return res.status(500).json({ error: '로그아웃에 실패했습니다.' });
        }
        res.clearCookie('connect.sid');
        res.json({ success: true });
    });
};

// 암구호 검증
const verifyAccessCode = async (req, res) => {
    const { accessCode } = req.body;
    if (!accessCode) {
        return res.status(400).json({ success: false, message: '암구호를 입력하세요.' });
    }
    try {
        const currentAccessCode = await db.getAccessCode();
        if (accessCode !== currentAccessCode) {
            return res.status(401).json({ success: false, message: '암구호가 올바르지 않습니다.' });
        }
        // 암구호가 맞으면 성공 응답
        res.json({ success: true });
    } catch (error) {
        res.status(500).json({ success: false, message: '서버 오류가 발생했습니다.' });
    }
};

module.exports = {
    getUserInfo,
    changePassword,
    register,
    login,
    logout,
    verifyAccessCode
}; 