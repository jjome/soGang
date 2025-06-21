const express = require('express');
const session = require('express-session');
const bodyParser = require('body-parser');
const path = require('path');
const fs = require('fs');
const bcrypt = require('bcryptjs');
const http = require('http');
const socketIo = require('socket.io');
const FileStore = require('session-file-store')(session);
const { 
    initializeDatabase,
    getUser,
    getAllUsers,
    createUser,
    updateUserScore,
    getAccessCode,
    setAccessCode 
} = require('./database');
const crypto = require('crypto');

// --- 데이터 디렉토리 최우선 생성 ---
const dataDir = path.join(__dirname, 'data');
const sessionsDir = path.join(dataDir, 'sessions');
if (!fs.existsSync(sessionsDir)) {
    fs.mkdirSync(sessionsDir, { recursive: true });
    console.log(`Sessions directory ensured at: ${sessionsDir}`);
}
// ---

const app = express();
const server = http.createServer(app);
const io = socketIo(server);

const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || 'admin';
const PORT = process.env.PORT || 3000;

// 미들웨어 설정
app.use(bodyParser.urlencoded({ extended: true }));
app.use(bodyParser.json());
app.use(express.static(path.join(__dirname, 'public')));
app.use(session({
    store: new FileStore({
        path: sessionsDir,
        logFn: function() {} // 로그 비활성화
    }),
    secret: 'soGang-secret-key',
    resave: false,
    saveUninitialized: false,
    cookie: { 
        secure: process.env.NODE_ENV === 'production', // 프로덕션에서는 true
        maxAge: 1000 * 60 * 60 * 24 // 1일
    }
}));

// --- 실시간 로직 상태 관리 ---
const onlineUsers = new Map(); // key: socket.id, value: username
const rooms = new Map();       // key: roomId, value: room object

// 기본 라우트
app.get('/', (req, res) => {
    if (req.session.userId) {
        res.sendFile(path.join(__dirname, 'public', 'game.html'));
    } else {
        res.sendFile(path.join(__dirname, 'public', 'login.html'));
    }
});

// 로그인 API
app.post('/login', async (req, res) => {
    const { username, password, accessCode } = req.body;

    if (!username || !password || !accessCode) {
        return res.status(400).json({ error: '사용자명, 비밀번호, 암구호를 모두 입력해주세요.' });
    }

    const currentAccessCode = await getAccessCode();
    if (accessCode !== currentAccessCode) {
        return res.status(401).json({ error: '암구호가 올바르지 않습니다.' });
    }

    const user = await getUser(username);
    if (!user) {
        return res.status(401).json({ error: '사용자를 찾을 수 없습니다.' });
    }

    bcrypt.compare(password, user.password, (err, isMatch) => {
        if (err || !isMatch) {
            return res.status(401).json({ error: '비밀번호가 올바르지 않습니다.' });
        }
        req.session.userId = user.id;
        req.session.username = user.username;
        
        req.session.save((err) => {
            if (err) {
                console.error('세션 저장 오류:', err);
                return res.status(500).json({ error: '세션을 저장하는 중 오류가 발생했습니다.' });
            }
            res.json({ success: true, username: user.username });
        });
    });
});

// 회원가입 API
app.post('/register', async (req, res) => {
    const { username, password } = req.body;

    if (!username || !password) {
        return res.status(400).json({ error: '사용자명과 비밀번호를 입력해주세요.' });
    }
    
    const existingUser = await getUser(username);
    if (existingUser) {
        return res.status(400).json({ error: '이미 존재하는 사용자명입니다.' });
    }

    bcrypt.hash(password, 10, async (err, hash) => {
        if (err) {
            return res.status(500).json({ error: '서버 오류가 발생했습니다.' });
        }
        await createUser(username, hash);
        res.json({ success: true });
    });
});

// 로그아웃 API
app.post('/logout', (req, res) => {
    req.session.destroy();
    res.json({ success: true });
});

// 관리자 페이지 라우트
app.get('/admin', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'admin.html'));
});

// 관리자 로그인 API
app.post('/admin/login', (req, res) => {
    const { password } = req.body;
    if (password === ADMIN_PASSWORD) {
        req.session.isAdmin = true;
        req.session.save((err) => {
            if (err) {
                console.error('세션 저장 오류:', err);
                return res.status(500).json({ error: '세션을 저장하는 중 오류가 발생했습니다.' });
            }
            res.json({ success: true });
        });
    } else {
        res.status(401).json({ error: '관리자 비밀번호가 올바르지 않습니다.' });
    }
});

// 관리자 권한 확인 미들웨어
function ensureAdmin(req, res, next) {
    if (req.session.isAdmin) {
        return next();
    }
    res.status(403).json({ error: '관리자 권한이 필요합니다.' });
}

// 암구호 변경 API
app.post('/admin/change-access-code', ensureAdmin, async (req, res) => {
    const { newAccessCode } = req.body;
    if (newAccessCode && newAccessCode.length > 0) {
        await setAccessCode(newAccessCode);
        console.log(`암구호가 다음으로 변경되었습니다: ${newAccessCode}`);
        res.json({ success: true, message: '암구호가 성공적으로 변경되었습니다.' });
    } else {
        res.status(400).json({ error: '새 암구호를 입력해주세요.' });
    }
});

// 사용자 목록 조회 API
app.get('/api/admin/users', ensureAdmin, async (req, res) => {
    const userList = await getAllUsers();
    res.json({ success: true, users: userList });
});

// 관리자 로그인 상태 확인 API
app.get('/api/admin/status', (req, res) => {
    res.json({ isAdmin: !!req.session.isAdmin });
});

// 사용자 정보 API
app.get('/api/user', (req, res) => {
    if (req.session.username) {
        res.json({ username: req.session.username });
    } else {
        res.status(401).json({ error: '로그인이 필요합니다.' });
    }
});

// Socket.IO 연결 처리
io.on('connection', (socket) => {
    console.log('사용자가 연결되었습니다:', socket.id);

    // --- 로비 및 사용자 관리 ---
    socket.on('userLoggedIn', (username) => {
        socket.username = username;
        onlineUsers.set(socket.id, username);
        io.emit('updateOnlineUsers', Array.from(onlineUsers.values()));
        socket.emit('updateRooms', Array.from(rooms.values()));
    });

    socket.on('createRoom', ({ roomName }) => {
        const roomId = crypto.randomUUID();
        const user = { username: socket.username, id: socket.id, score: 0, ready: false };
        
        const room = {
            id: roomId,
            name: roomName,
            players: [user],
            gameState: 'waiting', // waiting, playing
        };
        rooms.set(roomId, room);
        socket.join(roomId);

        socket.emit('roomJoined', room);
        io.emit('updateRooms', Array.from(rooms.values()));
    });

    socket.on('joinRoom', ({ roomId }) => {
        const room = rooms.get(roomId);
        if (room && room.players.length < 8) { // 8명 제한
            const user = { username: socket.username, id: socket.id, score: 0, ready: false };
            room.players.push(user);
            socket.join(roomId);

            socket.emit('roomJoined', room);
            io.to(roomId).emit('updateRoomState', room);
            io.emit('updateRooms', Array.from(rooms.values()));
        } else {
            socket.emit('lobbyError', { message: '방에 참가할 수 없습니다 (가득 찼거나 존재하지 않음).' });
        }
    });

    socket.on('leaveRoom', ({ roomId }) => {
        const room = rooms.get(roomId);
        if (room) {
            socket.leave(roomId);
            room.players = room.players.filter(p => p.id !== socket.id);

            if (room.players.length === 0) {
                rooms.delete(roomId);
            } else {
                io.to(roomId).emit('updateRoomState', room);
            }
            io.emit('updateRooms', Array.from(rooms.values()));
        }
    });

    // --- 게임 로직 (방 기반) ---
    socket.on('ready', ({ roomId }) => {
        const room = rooms.get(roomId);
        if (!room) return;

        const player = room.players.find(p => p.id === socket.id);
        if (player) {
            player.ready = !player.ready;
            io.to(roomId).emit('updateRoomState', room);

            const allReady = room.players.length >= 2 && room.players.every(p => p.ready);
            if (allReady) {
                room.gameState = 'playing';
                room.targetNumber = Math.floor(Math.random() * 100) + 1;
                io.to(roomId).emit('gameStart', room);
            }
        }
    });

    socket.on('makeGuess', async ({ roomId, guess }) => {
        const room = rooms.get(roomId);
        if (!room || room.gameState !== 'playing') return;

        if (guess === room.targetNumber) {
            const player = room.players.find(p => p.id === socket.id);
            if (player) {
                player.score += 10;
                await updateUserScore(player.username, player.score);
                
                room.gameState = 'waiting';
                room.players.forEach(p => p.ready = false);
                io.to(roomId).emit('correctGuess', { room, winner: player.username });
            }
        } else {
            io.to(roomId).emit('wrongGuess', { username: socket.username, guess });
        }
    });

    // --- 연결 해제 처리 ---
    socket.on('disconnect', () => {
        console.log('사용자가 연결을 해제했습니다:', socket.id);
        if (socket.username) {
            // 모든 방에서 사용자 제거
            for (const [roomId, room] of rooms.entries()) {
                const playerIndex = room.players.findIndex(p => p.id === socket.id);
                if (playerIndex !== -1) {
                    room.players.splice(playerIndex, 1);
                    if (room.players.length === 0) {
                        rooms.delete(roomId);
                    } else {
                        io.to(roomId).emit('updateRoomState', room);
                    }
                    break;
                }
            }
            onlineUsers.delete(socket.id);
            io.emit('updateOnlineUsers', Array.from(onlineUsers.values()));
            io.emit('updateRooms', Array.from(rooms.values()));
        }
    });
});

async function startServer() {
    await initializeDatabase();
    server.listen(PORT, () => {
        console.log(`서버가 포트 ${PORT}에서 실행 중입니다.`);
    });
}

startServer();

