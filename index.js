const express = require('express');
const session = require('express-session');
const bodyParser = require('body-parser');
const path = require('path');
const bcrypt = require('bcryptjs');
const http = require('http');
const socketIo = require('socket.io');

const app = express();
const server = http.createServer(app);
const io = socketIo(server);

const PORT = process.env.PORT || 3000;

// 미들웨어 설정
app.use(bodyParser.urlencoded({ extended: true }));
app.use(bodyParser.json());
app.use(express.static(path.join(__dirname, 'public')));
app.use(session({
  secret: 'soGang-secret-key',
  resave: false,
  saveUninitialized: false,
  cookie: { secure: false }
}));

// 간단한 사용자 저장소 (실제로는 데이터베이스를 사용해야 함)
const users = new Map();
const games = new Map();

// 기본 라우트
app.get('/', (req, res) => {
  if (req.session.userId) {
    res.sendFile(path.join(__dirname, 'public', 'game.html'));
  } else {
    res.sendFile(path.join(__dirname, 'public', 'login.html'));
  }
});

// 로그인 API
app.post('/login', (req, res) => {
  const { username, password } = req.body;
  
  if (!username || !password) {
    return res.status(400).json({ error: '사용자명과 비밀번호를 입력해주세요.' });
  }

  const user = users.get(username);
  if (!user) {
    return res.status(401).json({ error: '사용자를 찾을 수 없습니다.' });
  }

  bcrypt.compare(password, user.password, (err, isMatch) => {
    if (err || !isMatch) {
      return res.status(401).json({ error: '비밀번호가 올바르지 않습니다.' });
    }

    req.session.userId = username;
    res.json({ success: true, username });
  });
});

// 회원가입 API
app.post('/register', (req, res) => {
  const { username, password } = req.body;
  
  if (!username || !password) {
    return res.status(400).json({ error: '사용자명과 비밀번호를 입력해주세요.' });
  }

  if (users.has(username)) {
    return res.status(400).json({ error: '이미 존재하는 사용자명입니다.' });
  }

  bcrypt.hash(password, 10, (err, hash) => {
    if (err) {
      return res.status(500).json({ error: '서버 오류가 발생했습니다.' });
    }

    users.set(username, { password: hash, score: 0 });
    res.json({ success: true });
  });
});

// 로그아웃 API
app.post('/logout', (req, res) => {
  req.session.destroy();
  res.json({ success: true });
});

// 사용자 정보 API
app.get('/api/user', (req, res) => {
  if (req.session.userId) {
    res.json({ username: req.session.userId });
  } else {
    res.status(401).json({ error: '로그인이 필요합니다.' });
  }
});

// Socket.IO 연결 처리
io.on('connection', (socket) => {
  console.log('사용자가 연결되었습니다:', socket.id);

  // 게임 참가
  socket.on('joinGame', (username) => {
    socket.username = username;
    socket.join('gameRoom');
    
    // 게임 상태 업데이트
    const gameState = games.get('gameRoom') || { players: [], currentTurn: 0 };
    if (!gameState.players.find(p => p.username === username)) {
      gameState.players.push({ username, score: 0, ready: false });
    }
    games.set('gameRoom', gameState);
    
    // 다른 플레이어들에게 새 플레이어 참가 알림
    socket.to('gameRoom').emit('playerJoined', username);
    io.to('gameRoom').emit('gameState', gameState);
  });

  // 게임 준비
  socket.on('ready', () => {
    const gameState = games.get('gameRoom');
    if (gameState) {
      const player = gameState.players.find(p => p.username === socket.username);
      if (player) {
        player.ready = true;
        io.to('gameRoom').emit('gameState', gameState);
        
        // 모든 플레이어가 준비되었는지 확인
        if (gameState.players.length >= 2 && gameState.players.every(p => p.ready)) {
          io.to('gameRoom').emit('gameStart');
        }
      }
    }
  });

  // 게임 액션 (간단한 숫자 맞추기 게임)
  socket.on('makeGuess', (guess) => {
    const gameState = games.get('gameRoom');
    if (gameState && gameState.targetNumber) {
      if (guess === gameState.targetNumber) {
        const player = gameState.players.find(p => p.username === socket.username);
        if (player) {
          player.score += 10;
          io.to('gameRoom').emit('correctGuess', { username: socket.username, score: player.score });
        }
      } else {
        io.to('gameRoom').emit('wrongGuess', { username: socket.username, guess });
      }
    }
  });

  // 연결 해제
  socket.on('disconnect', () => {
    console.log('사용자가 연결을 해제했습니다:', socket.id);
    
    if (socket.username) {
      const gameState = games.get('gameRoom');
      if (gameState) {
        // 플레이어 제거
        gameState.players = gameState.players.filter(p => p.username !== socket.username);
        
        // 다른 플레이어들에게 플레이어 퇴장 알림
        socket.to('gameRoom').emit('playerLeft', socket.username);
        io.to('gameRoom').emit('gameState', gameState);
      }
    }
  });
});

// 게임 시작 시 타겟 숫자 생성
io.on('connection', (socket) => {
  socket.on('startNewRound', () => {
    const gameState = games.get('gameRoom');
    if (gameState) {
      gameState.targetNumber = Math.floor(Math.random() * 100) + 1;
      gameState.players.forEach(p => p.ready = false);
      io.to('gameRoom').emit('newRound', { targetNumber: gameState.targetNumber });
    }
  });
});

server.listen(PORT, () => {
  console.log(`서버가 포트 ${PORT}에서 실행 중입니다.`);
});