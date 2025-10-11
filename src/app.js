const path = require('path');
const express = require('express');
const http = require('http');
const socketIo = require('socket.io');
const db = require('../database');
const socketHandlersModule = require('../socketHandlers');
const { config, sessionConfig } = require('./config/app');
const authRoutes = require('./routes/auth');
const adminRoutes = require('./routes/admin');
const gameRoutes = require('./routes/games');
const userRoutes = require('./routes/users');
const { requireAuth } = require('./middleware/auth');

// Express 앱 생성
const app = express();

// HTTP 서버 생성
const server = http.createServer(app);

// Socket.io 설정
const io = socketIo(server, {
    cors: {
        origin: config.ALLOWED_ORIGINS,
        methods: ["GET", "POST"],
        credentials: true
    }
});

// Socket.io 핸들러 등록
const socketHandlers = socketHandlersModule(io);

// socketHandlers를 앱에 저장 (adminController에서 사용)
app.set('socketHandlers', socketHandlers);

// 미들웨어 설정
app.use(express.static(path.join(__dirname, '../public')));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// 세션 설정
app.use(require('express-session')(sessionConfig));

// 라우트 설정
app.use('/api', authRoutes);
app.use('/api/admin', adminRoutes);
app.use('/api/games', gameRoutes);
app.use('/api/users', userRoutes);

// 기본 페이지 라우트
app.get('/', (req, res) => {
    if (!req.session.userId) {
        return res.redirect('/login.html');
    }
    res.sendFile(path.join(__dirname, '../public', 'game.html'));
});

app.get('/admin', (req, res) => {
    res.sendFile(path.join(__dirname, '../public', 'admin.html'));
});

app.get('/game', (req, res) => {
    console.log('게임 페이지 접근 - 세션:', req.session);
    if (!req.session.userId && !req.session.isAdmin) {
        console.log('인증되지 않은 사용자, 로그인 페이지로 리다이렉트');
        return res.redirect('/login.html');
    }
    console.log('게임 페이지 접근 허용');
    res.sendFile(path.join(__dirname, '../public', 'game.html'));
});



// SPA 라우팅: 주요 경로에서 모두 index.html 반환
const spaRoutes = ['/lobby', '/wait'];
spaRoutes.forEach(route => {
    app.get(route, (req, res) => {
        res.sendFile(path.join(__dirname, '../public', 'index.html'));
    });
});

module.exports = { app, server }; 