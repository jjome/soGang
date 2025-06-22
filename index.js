const path = require('path');
const fs = require('fs');
const express = require('express');
const http = require('http');
const bcrypt = require('bcryptjs');
const session = require('express-session');
const FileStore = require('session-file-store')(session);
const socketIo = require('socket.io');
const db = require('./database');
const registerSocketHandlers = require('./socketHandlers');

// --- 초기 설정 ---
const app = express();
const server = http.createServer(app);
const io = socketIo(server);
const PORT = process.env.PORT || 3000;
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || 'happy';

// --- 미들웨어 설정 ---
app.use(express.static(path.join(__dirname, 'public')));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// 세션 저장소 디렉토리 생성
const sessionDir = path.join(__dirname, 'sessions');
if (!fs.existsSync(sessionDir)) {
    fs.mkdirSync(sessionDir, { recursive: true });
}

// 세션 설정 - session-file-store 사용
app.use(session({
    store: new FileStore({
        path: sessionDir,
        ttl: 86400, // 24시간
        reapInterval: 3600, // 1시간마다 만료된 세션 정리
        secret: 'a-truly-secret-key-for-sogang-reborn'
    }),
    secret: 'a-truly-secret-key-for-sogang-reborn',
    resave: false,
    saveUninitialized: false,
    cookie: {
        secure: false, // 로컬 환경에서는 false로 설정
        maxAge: 1000 * 60 * 60 * 24 // 1일
    }
}));

// --- 라우트 ---
// 기본 페이지 라우트
app.get('/', (req, res) => {
    if (!req.session.userId) {
        return res.redirect('/login.html');
    }
    res.sendFile(path.join(__dirname, 'public', 'game.html'));
});

app.get('/admin', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'admin.html'));
});

app.get('/game', (req, res) => {
    if (!req.session.userId) {
        return res.redirect('/login.html');
    }
    res.sendFile(path.join(__dirname, 'public', 'game.html'));
});

// 사용자 정보 API
app.get('/api/user', (req, res) => {
    if (req.session.username) {
        res.json({ username: req.session.username });
    } else {
        res.status(401).json({ error: '로그인이 필요합니다.' });
    }
});

// 비밀번호 변경 API
app.post('/api/change-password', async (req, res) => {
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
});

// 관리자 상태 API
app.get('/api/admin/status', (req, res) => {
    console.log('관리자 상태 확인 요청 - 세션:', req.session);
    
    // 세션이 없거나 isAdmin이 명시적으로 true가 아니면 false 반환
    if (!req.session || req.session.isAdmin !== true) {
        console.log('관리자 상태: false (세션 없음 또는 isAdmin이 true 아님)');
        return res.json({ isAdmin: false });
    }
    
    console.log('관리자 상태: true');
    res.json({ isAdmin: true });
});

// 로그인 & 회원가입
app.post('/register', async (req, res) => {
    const { username, password } = req.body;
    if (!username || !password) {
        return res.status(400).json({ error: '사용자명과 비밀번호를 입력해주세요.' });
    }
    try {
        const existingUser = await db.getUser(username);
        if (existingUser) {
            return res.status(400).json({ error: '이미 존재하는 사용자명입니다.' });
        }
        const hashedPassword = await bcrypt.hash(password, 10);
        await db.createUser(username, hashedPassword);
        res.json({ success: true });
    } catch (error) {
        console.error('회원가입 오류:', error);
        res.status(500).json({ error: '서버 오류가 발생했습니다.' });
    }
});

app.post('/login', async (req, res) => {
    const { username, password, accessCode } = req.body;
    if (!username || !password || !accessCode) {
        return res.status(400).json({ error: '모든 필드를 입력해주세요.' });
    }
    try {
        const currentAccessCode = await db.getAccessCode();
        if (accessCode !== currentAccessCode) {
            return res.status(401).json({ error: '암구호가 올바르지 않습니다.' });
        }
        const user = await db.getUser(username);
        if (!user || !(await bcrypt.compare(password, user.password))) {
            return res.status(401).json({ error: '사용자명 또는 비밀번호가 올바르지 않습니다.' });
        }
        
        // 세션에 사용자 정보 저장
        req.session.userId = user.id;
        req.session.username = user.username;
        
        // 세션을 명시적으로 저장하고 응답
        req.session.save((err) => {
            if (err) {
                console.error('세션 저장 오류:', err);
                return res.status(500).json({ error: '로그인 처리 중 오류가 발생했습니다.' });
            }
            res.json({ success: true, username: user.username });
        });
    } catch (error) {
        console.error('로그인 오류:', error);
        res.status(500).json({ error: '서버 오류가 발생했습니다.' });
    }
});

app.post('/logout', (req, res) => {
    req.session.destroy(err => {
        if (err) {
            console.error('로그아웃 오류:', err);
            return res.status(500).json({ error: '로그아웃에 실패했습니다.' });
        }
        res.clearCookie('connect.sid');
        res.json({ success: true });
    });
});

// 관리자 라우트
const adminRouter = express.Router();
adminRouter.use((req, res, next) => {
    console.log('관리자 API 접근 시 세션:', req.session);
    if (req.session.isAdmin) return next();
    res.status(403).json({ error: '관리자 권한이 필요합니다.' });
});
adminRouter.get('/users', async (req, res) => {
    try {
        const users = await db.getAllUsers();
        res.json({ users });
    } catch (error) {
        console.error('사용자 목록 조회 오류:', error);
        res.status(500).json({ error: '사용자 목록을 가져오는데 실패했습니다.' });
    }
});
adminRouter.post('/change-access-code', async (req, res) => {
    const { newAccessCode } = req.body;
    if (!newAccessCode) return res.status(400).json({ error: '새 암구호를 입력해주세요.' });
    try {
        await db.setAccessCode(newAccessCode);
        res.json({ success: true });
    } catch (error) {
        console.error('암구호 변경 오류:', error);
        res.status(500).json({ error: '암구호 변경에 실패했습니다.' });
    }
});
app.use('/api/admin', adminRouter);

app.post('/admin/login', (req, res) => {
    const { password } = req.body;
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
});

app.post('/admin/logout', (req, res) => {
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
});

// --- 소켓 핸들러 등록 ---
registerSocketHandlers(io);

// --- 서버 시작 ---
async function startServer() {
    try {
        await db.initializeDatabase();
        server.listen(PORT, () => {
            console.log(`서버가 포트 ${PORT}에서 실행 중입니다.`);
            console.log(`환경: ${process.env.NODE_ENV || 'development'}`);
        });
    } catch (error) {
        console.error('서버 시작 실패:', error);
        process.exit(1);
    }
}

startServer(); 