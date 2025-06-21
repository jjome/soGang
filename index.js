const path = require('path');
const fs = require('fs');
const express = require('express');
const http = require('http');
const bcrypt = require('bcryptjs');
const session = require('express-session');
const socketIo = require('socket.io');
const SQLiteStore = require('connect-sqlite3')(session);
const db = require('./database');
const registerSocketHandlers = require('./socketHandlers');

// --- 초기 설정 ---
const app = express();
const server = http.createServer(app);
const io = socketIo(server);
const PORT = process.env.PORT || 3000;
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || 'admin';

// --- 디렉토리 보장 ---
const dataDir = path.join(__dirname, 'data');
if (!fs.existsSync(dataDir)) {
    fs.mkdirSync(dataDir, { recursive: true });
}

// --- 미들웨어 설정 ---
app.use(express.static(path.join(__dirname, 'public')));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(session({
    store: new SQLiteStore({
        db: 'sessions.db',
        dir: dataDir,
        table: 'sessions'
    }),
    secret: 'a-truly-secret-key-for-sogang-reborn',
    resave: false,
    saveUninitialized: false,
    cookie: {
        secure: process.env.NODE_ENV === 'production',
        maxAge: 1000 * 60 * 60 * 24 // 1일
    }
}));

// --- 라우트 ---
// 기본 페이지 라우트
app.get('/', (req, res) => {
    if (req.session.userId) {
        res.sendFile(path.join(__dirname, 'public', 'game.html'));
    } else {
        res.sendFile(path.join(__dirname, 'public', 'login.html'));
    }
});
app.get('/admin', (req, res) => res.sendFile(path.join(__dirname, 'public', 'admin.html')));

// 사용자 정보 API
app.get('/api/user', (req, res) => {
    if (req.session.username) {
        res.json({ username: req.session.username });
    } else {
        res.status(401).json({ error: '로그인이 필요합니다.' });
    }
});

// 관리자 상태 API
app.get('/api/admin/status', (req, res) => {
    res.json({ isAdmin: !!req.session.isAdmin });
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
        req.session.userId = user.id;
        req.session.username = user.username;
        res.json({ success: true, username: user.username });
    } catch (error) {
        res.status(500).json({ error: '서버 오류가 발생했습니다.' });
    }
});

app.post('/logout', (req, res) => {
    req.session.destroy(err => {
        if (err) {
            return res.status(500).json({ error: '로그아웃에 실패했습니다.' });
        }
        res.clearCookie('connect.sid');
        res.json({ success: true });
    });
});

// 관리자 라우트
const adminRouter = express.Router();
adminRouter.use((req, res, next) => {
    if (req.session.isAdmin) return next();
    res.status(403).json({ error: '관리자 권한이 필요합니다.' });
});
adminRouter.get('/users', async (req, res) => {
    res.json({ users: await db.getAllUsers() });
});
adminRouter.post('/change-access-code', async (req, res) => {
    const { newAccessCode } = req.body;
    if (!newAccessCode) return res.status(400).json({ error: '새 암구호를 입력해주세요.' });
    await db.setAccessCode(newAccessCode);
    res.json({ success: true });
});
app.use('/api/admin', adminRouter);

app.post('/admin/login', (req, res) => {
    const { password } = req.body;
    if (password === ADMIN_PASSWORD) {
        req.session.isAdmin = true;
        res.json({ success: true });
    } else {
        res.status(401).json({ error: '관리자 비밀번호가 올바르지 않습니다.' });
    }
});

// --- 소켓 핸들러 등록 ---
registerSocketHandlers(io);

// --- 서버 시작 ---
async function startServer() {
    try {
        await db.initializeDatabase();
        server.listen(PORT, () => console.log(`서버가 포트 ${PORT}에서 실행 중입니다.`));
    } catch (error) {
        console.error('서버 시작 실패:', error);
        process.exit(1);
    }
}

startServer(); 