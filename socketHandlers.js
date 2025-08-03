const db = require('./database');
const { v4: uuidv4 } = require('uuid');

// 서버 전체에서 사용자 및 방 정보를 관리
const onlineUsers = new Map(); // username -> Set(socket.id)
const gameRooms = new Map(); // roomId -> { id, name, players, maxPlayers, host, state }
const userStatus = new Map(); // socket.id -> { username, status, location, connectTime }

// 관리자 권한 확인 함수
async function checkAdminStatus(socket) {
    return new Promise((resolve) => {
        try {
            // 세션에서 관리자 권한 확인
            const session = socket.request?.session;
            console.log('[checkAdminStatus] 세션 정보:', session);
            
            if (session && session.isAdmin) {
                console.log('[checkAdminStatus] 관리자 권한 확인됨');
                resolve(true);
            } else {
                console.log('[checkAdminStatus] 관리자 권한 없음 - session:', session);
                resolve(false);
            }
        } catch (error) {
            console.error('[checkAdminStatus] 오류 발생:', error);
            resolve(false);
        }
    });
}

module.exports = function(io) {
    
    function emitOnlineUsers() {
        io.emit('onlineUsers', Array.from(onlineUsers.keys()));
    }

    function getRoomList() {
        return Array.from(gameRooms.values()).map(room => ({
            id: room.id,
            name: room.name,
            playerCount: room.players.size,
            maxPlayers: room.maxPlayers,
            state: room.state
        }));
    }

    function handleDisconnect(socket) {
        const username = socket.data?.username;
        console.log(`[Socket Disconnect] User disconnected: ${username || 'unknown'} (${socket.id})`);
        
        if (username && onlineUsers.has(username)) {
            onlineUsers.get(username).delete(socket.id);
            if (onlineUsers.get(username).size === 0) {
                onlineUsers.delete(username);
            }
            emitOnlineUsers();
        }
        
        // 유저 상태 정리
        userStatus.delete(socket.id);
        
        // 모든 게임방을 순회하며 해당 유저를 제거
        gameRooms.forEach((room, roomId) => {
            if (room.players.has(socket.id)) {
                room.players.delete(socket.id);
                console.log(`[Socket Disconnect] User ${username || 'unknown'} removed from room ${roomId}`);
                
                // 방에 아무도 없으면 방 삭제 (10초 대기 후 삭제)
                setTimeout(() => {
                    const targetRoom = gameRooms.get(roomId);
                    if (targetRoom && targetRoom.players.size === 0) {
                        gameRooms.delete(roomId);
                        console.log(`[Room Deleted] Room ${roomId} is empty and has been deleted (after delay).`);
                    }
                }, 10000); // 10초 대기
            }
        });
        io.emit('roomListUpdate', getRoomList());
    }

    function getRoomState(room) {
        return {
            id: room.id,
            name: room.name,
            players: Array.from(room.players.values()),
            host: room.host,
            state: room.state
        };
    }
    
    function startRoomGame(roomId) {
        const room = gameRooms.get(roomId);
        if (!room || room.state !== 'waiting') return;

        room.state = 'playing';
        console.log(`[Game Start] Game starting in room ${roomId}`);
        
        // 게임 시작 시에는 카드를 분배하지 않고, 카드 받기 버튼을 통해 분배하도록 함
        room.players.forEach((player, socketId) => {
            player.cards = []; // 빈 카드 배열로 초기화
            player.cardsRevealed = false;
            player.chips = 1000; // 기본 칩 설정
            
            // 유저 상태를 게임 중으로 업데이트
            updateUserStatus(socketId, 'gaming', {
                type: 'room',
                roomId: roomId,
                roomName: room.name
            });
        });
        
        console.log(`[Game Start] 게임 시작 - 방 ID: ${roomId}`);
        console.log(`[Game Start] 방의 플레이어들:`, Array.from(room.players.values()));
        
        // 방에 있는 모든 플레이어에게 게임 시작 알림
        const gameState = {
            roomId: roomId,
            players: Array.from(room.players.values()).map(player => ({
                username: player.username,
                ready: player.ready,
                cards: player.cards || [],
                cardsRevealed: player.cardsRevealed || false,
                chips: player.chips || 1000
            })),
            currentPlayer: room.host,
            phase: 'waiting_for_cards', // 카드 받기 대기 상태
            communityCards: [],
            pot: 0
        };
        
        // 게임 시작 알림 전송
        io.to(roomId).emit('gameStart', getRoomState(room));
        io.to(roomId).emit('gameStarted', {
            room: getRoomState(room),
            gameState: gameState
        });
        io.emit('roomListUpdate', getRoomList());
        
        console.log(`[Game Start] 게임 시작 알림 전송 완료 - 방 ID: ${roomId}`);
        
        // 모든 플레이어에게 게임 페이지로 이동하도록 알림
        io.to(roomId).emit('redirectToGame', { 
            roomId: roomId,
            message: '게임이 시작되었습니다! 카드 받기 버튼을 눌러 카드를 받으세요.'
        });
    }

    // 카드 덱 생성 함수
    function createDeck() {
        const suits = ['♠', '♥', '♦', '♣'];
        const ranks = ['A', '2', '3', '4', '5', '6', '7', '8', '9', '10', 'J', 'Q', 'K'];
        const deck = [];
        
        for (let suit of suits) {
            for (let rank of ranks) {
                deck.push({ suit, rank });
            }
        }
        
        // 덱 셔플
        for (let i = deck.length - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1));
            [deck[i], deck[j]] = [deck[j], deck[i]];
        }
        
        return deck;
    }

    io.on('connection', (socket) => {
        console.log(`[Socket Connect] New connection: ${socket.id}`);
        console.log(`[Socket Connect] 소켓 연결 상태: ${socket.connected}`);
        console.log(`[Socket Connect] 소켓 데이터 초기값:`, socket.data);
        console.log(`[Socket Connect] 연결 시간: ${new Date().toISOString()}`);

        let registered = false;
        // 타임아웃 제거 - 즉시 사용자 등록 시도
        console.log(`[Socket Connect] 타임아웃 제거됨 - socketId: ${socket.id}`);

        socket.on('testEvent', (data) => {
            console.log(`[서버] testEvent 이벤트: data=${data}, socket.id=${socket.id}`);
            console.log(`[서버] 소켓 연결 상태: ${socket.connected}`);
            console.log(`[서버] 이벤트 수신 시간: ${new Date().toISOString()}`);
        });

        socket.on('createAdminRoom', (data) => {
            console.log(`[서버] createAdminRoom 이벤트: socket.id=${socket.id}`);
            console.log(`[서버] socket.data:`, socket.data);
            
            // 사용자명이 없으면 기본값 사용하고 socket.data에 설정
            const username = socket.data?.username || 'admin_user';
            socket.data.username = username; // socket.data에 사용자명 설정
            console.log(`[서버] 사용자명 설정: ${username}`);
            
            // 관리자 전용 방 생성
            const adminRoomId = `admin_${uuidv4()}`;
            const adminRoom = {
                id: adminRoomId,
                name: `관리자 게임 (${username})`,
                players: new Map(),
                maxPlayers: 8,
                host: username,
                state: 'playing', // 바로 게임 상태로 시작
                pot: 0,
                phase: 'playing',
                communityCards: [],
                currentPlayer: username,
                deck: createDeck(),
                chips: new Set() // 칩 상태 초기화
            };
            
            // 관리자를 플레이어로 추가
            const adminPlayer = {
                username: username,
                ready: true,
                cards: [],
                cardsRevealed: false,
                chips: 1000,
                currentBet: 0,
                folded: false,
                allIn: false
            };
            
            adminRoom.players.set(socket.id, adminPlayer);
            gameRooms.set(adminRoomId, adminRoom);
            console.log(`[서버] 관리자 방 생성 완료: ${adminRoomId}`);
            
            // 관리자를 방에 입장시킴
            socket.join(adminRoomId);
            socket.data.roomId = adminRoomId;
            
            // 유저 상태를 게임 중으로 업데이트
            updateUserStatus(socket.id, 'gaming', {
                type: 'room',
                roomId: adminRoomId,
                roomName: adminRoom.name
            });
            
            // 방 정보 전송
            socket.emit('adminRoomCreated', { roomId: adminRoomId });
            console.log(`[서버] adminRoomCreated 이벤트 전송: ${adminRoomId}`);
        });

        socket.on('registerUser', (username) => {
            console.log(`[서버] registerUser 이벤트: username=${username}, socket.id=${socket.id}`);
            console.log(`[서버] 소켓 연결 상태: ${socket.connected}`);
            console.log(`[서버] 현재 registered 상태: ${registered}`);
            console.log(`[서버] 이벤트 수신 시간: ${new Date().toISOString()}`);
            
            if (!username) {
                console.error('[서버] registerUser: username이 없음');
                // username이 없어도 registered를 true로 설정
                registered = true;
                socket.data.username = 'unknown_user';
                console.log('[서버] username이 없어도 registered를 true로 설정');
                socket.emit('registerUserSuccess');
                return;
            }
            
            registered = true;
            socket.data.username = username;
            
            if (!onlineUsers.has(username)) {
                onlineUsers.set(username, new Set());
            }
            onlineUsers.get(username).add(socket.id);
            
            // 유저 상태 초기화
            userStatus.set(socket.id, {
                username: username,
                status: 'lobby',
                location: null,
                connectTime: new Date().toISOString()
            });
            
            console.log(`[registerUser] 유저 상태 설정 완료:`, userStatus.get(socket.id));
            console.log(`[registerUser] 현재 onlineUsers 크기:`, onlineUsers.size);
            console.log(`[registerUser] 현재 userStatus 크기:`, userStatus.size);
            console.log(`[registerUser] socket.data.username 설정됨:`, socket.data.username);
            
            emitOnlineUsers();
            socket.emit('roomListUpdate', getRoomList());
            socket.emit('registerUserSuccess');
            
            console.log(`[registerUser] registerUserSuccess 이벤트 전송 완료`);
        });

        socket.on('createRoom', ({ roomName }) => {
            const username = socket.data.username;
            console.log(`[서버] '${username}'로부터 createRoom 요청 받음. 방 이름: ${roomName}`);

            if (!username) {
                console.error('[서버] 오류: 사용자 이름이 없어 방을 만들 수 없습니다.');
                return;
            }

            // 이미 다른 방에 참가 중인지 확인
            for (let room of gameRooms.values()) {
                if (room.players.has(socket.id)) {
                    socket.emit('lobbyError', { message: '이미 다른 방에 참가 중입니다.' });
                    return;
                }
            }
            
            const roomId = uuidv4();
            const newRoom = {
                id: roomId,
                name: roomName,
                players: new Map([[socket.id, { id: socket.id, username, ready: false }]]),
                maxPlayers: 8,
                host: username,
                state: 'waiting' // 'waiting' 또는 'playing'
            };
            gameRooms.set(roomId, newRoom);

            console.log(`[Room Created] User ${username} created room: ${roomName} (${roomId})`);
            
            socket.join(roomId);
            socket.data.roomId = roomId;

            // 유저 상태 업데이트 - 대기방
            updateUserStatus(socket.id, 'waiting', {
                type: 'room',
                roomId: roomId,
                roomName: roomName
            });

            io.emit('roomListUpdate', getRoomList());
            
            const roomState = getRoomState(newRoom);
            console.log(`[서버] '${username}'에게 joinRoomSuccess 이벤트 전송. Room state:`, roomState);
            socket.emit('joinRoomSuccess', roomState);
        });

        socket.on('joinRoom', (roomId) => {
            const room = gameRooms.get(roomId);
            const username = socket.data.username;

            if (room && room.players.size < room.maxPlayers && room.state === 'waiting' && username) {
                room.players.set(socket.id, { id: socket.id, username, ready: false });
                socket.join(roomId);
                socket.data.roomId = roomId;
                
                // 유저 상태 업데이트 - 대기방
                updateUserStatus(socket.id, 'waiting', {
                    type: 'room',
                    roomId: roomId,
                    roomName: room.name
                });
                
                console.log(`[Room Join] User ${username} joined room: ${room.name} (${roomId})`);

                io.emit('roomListUpdate', getRoomList());
                io.to(roomId).emit('roomStateUpdate', getRoomState(room));

                // 참가자에게도 joinRoomSuccess를 emit
                socket.emit('joinRoomSuccess', getRoomState(room));

                // 호스트 위임: 방장이 나가면 남은 사람 중 첫 번째의 username으로 host 변경
                if (room.host === socket.data.username) {
                    const nextPlayer = room.players.values().next().value;
                    room.host = nextPlayer ? nextPlayer.username : null;
                }
            } else if (room && room.state === 'playing' && username) {
                // 게임 중인 방에 참가하는 경우
                // 기존 플레이어 정보가 있는지 확인
                let existingPlayer = null;
                for (let [playerId, player] of room.players.entries()) {
                    if (player.username === username) {
                        existingPlayer = player;
                        // 기존 소켓 ID를 새로운 소켓 ID로 업데이트
                        room.players.delete(playerId);
                        break;
                    }
                }
                
                // 새로운 플레이어 정보 설정
                const playerInfo = existingPlayer || { id: socket.id, username, ready: true };
                playerInfo.id = socket.id; // 소켓 ID 업데이트
                room.players.set(socket.id, playerInfo);
                
                socket.join(roomId);
                socket.data.roomId = roomId;
                
                // 유저 상태 업데이트 - 게임 중
                updateUserStatus(socket.id, 'gaming', {
                    type: 'room',
                    roomId: roomId,
                    roomName: room.name
                });
                
                console.log(`[Game Join] User ${username} joined game in room: ${room.name} (${roomId})`);

                // 게임 상태 전송
                const gameState = {
                    roomId: roomId,
                    players: Array.from(room.players.values()).map(player => ({
                        username: player.username,
                        ready: player.ready,
                        cards: player.cards || null,
                        cardsRevealed: player.cardsRevealed || false
                    })),
                    currentPlayer: room.host,
                    phase: 'preflip',
                    communityCards: []
                };
                
                socket.emit('joinRoomSuccess', getRoomState(room));
                socket.emit('gameStarted', {
                    room: getRoomState(room),
                    gameState: gameState
                });
                
                console.log(`[Game Join] 게임 상태 전송 완료 - 플레이어 수: ${room.players.size}`);
            } else {
                socket.emit('lobbyError', { message: '방에 참가할 수 없거나, 게임이 이미 시작되었습니다.' });
            }
        });
        
        socket.on('toggleReady', () => {
            const roomId = socket.data.roomId;
            const room = gameRooms.get(roomId);

            if (room && room.players.has(socket.id)) {
                const player = room.players.get(socket.id);
                player.ready = !player.ready;

                console.log(`[Player Ready] ${player.username} in room ${roomId} is now ${player.ready ? 'ready' : 'not ready'}`);

                io.to(roomId).emit('roomStateUpdate', getRoomState(room));
            }
        });

        socket.on('playerReady', ({ roomId }) => {
            const room = gameRooms.get(roomId);
            if (!room || !room.players.has(socket.id)) {
                socket.emit('error', { message: '방을 찾을 수 없거나 플레이어가 아닙니다.' });
                return;
            }

            const player = room.players.get(socket.id);
            player.ready = !player.ready;

            console.log(`[Player Ready] ${player.username} in room ${roomId} is now ${player.ready ? 'ready' : 'not ready'}`);

            // 방 상태 업데이트 전송
            io.to(roomId).emit('roomStateUpdate', getRoomState(room));
            
            // 게임이 대기 상태이고 모든 플레이어가 준비되었으면 게임 시작
            if (room.state === 'waiting' && Array.from(room.players.values()).every(p => p.ready)) {
                startRoomGame(roomId);
            }
        });

        socket.on('leaveRoom', () => {
             const roomId = socket.data.roomId;
             const room = gameRooms.get(roomId);
             if (room && room.players.has(socket.id)) {
                 socket.leave(roomId);
                 room.players.delete(socket.id);
                 delete socket.data.roomId;
                 
                 // 유저 상태 업데이트 - 로비
                 updateUserStatus(socket.id, 'lobby', null);
                 
                 console.log(`[Player Leave] ${socket.data.username} left room ${roomId}`);

                 if (room.players.size === 0) {
                     gameRooms.delete(roomId);
                 } else {
                    // 호스트가 나가면 다음 사람에게 호스트 위임 (옵션)
                    if (room.host === socket.data.username) {
                        const nextPlayer = room.players.values().next().value;
                        room.host = nextPlayer ? nextPlayer.username : null;
                    }
                     io.to(roomId).emit('roomStateUpdate', getRoomState(room));
                 }
                 io.emit('roomListUpdate', getRoomList());
                 socket.emit('leftRoomSuccess');
             }
        });

        socket.on('giveUpGame', ({ roomId }) => {
            const room = gameRooms.get(roomId);
            if (room && room.players.has(socket.id)) {
                console.log(`[Game Give Up] User ${socket.data.username} in room ${roomId} gave up.`);

                const reason = `플레이어 '${socket.data.username}'님이 게임을 포기하여 로비로 돌아갑니다.`;
                
                // 방에 있는 모든 플레이어의 클라이언트에서 로비로 이동하도록 알림
                room.players.forEach(player => {
                    const playerSocket = io.sockets.sockets.get(player.id);
                    if(playerSocket) {
                        playerSocket.leave(roomId);
                        delete playerSocket.data.roomId;
                        playerSocket.emit('gameEndedByGiveUp', { reason });
                    }
                });

                gameRooms.delete(roomId);
                io.emit('roomListUpdate', getRoomList());
            }
        });

        socket.on('resetRooms', () => {
            // 관리자만 가능하게
            if (socket.request && socket.request.session && socket.request.session.isAdmin) {
                gameRooms.clear();
                io.emit('updateRooms', Array.from(gameRooms.values()));
            } else {
                socket.emit('lobbyError', { message: '관리자만 방 목록을 초기화할 수 있습니다.' });
            }
        });

        // 클라이언트가 getRoomList를 요청하면 해당 소켓에만 최신 방 목록을 전송
        socket.on('getRoomList', () => {
            socket.emit('roomListUpdate', getRoomList());
        });

        // --- 게임 시작: 방장이 수동으로 시작 ---
        socket.on('startRoomGame', ({ roomId }) => {
            const room = gameRooms.get(roomId);
            if (!room) return;
            if (room.host !== socket.data.username) return; // host를 username으로 비교
            
            // 최소 2명의 플레이어가 있어야 함 (개발용)
            if (room.players.size < 2) {
                socket.emit('lobbyError', { message: '게임을 시작하려면 최소 2명의 플레이어가 필요합니다.' });
                return;
            }
            
            const allReady = Array.from(room.players.values()).every(p => p.ready);
            if (room.state === 'waiting' && allReady) {
                startRoomGame(roomId);
            } else if (!allReady) {
                socket.emit('lobbyError', { message: '모든 플레이어가 준비되어야 게임을 시작할 수 있습니다.' });
            }
        });

        // 게임 관련 이벤트 핸들러
        socket.on('joinGame', ({ roomId }) => {
            const room = gameRooms.get(roomId);
            if (!room || room.state !== 'playing') {
                socket.emit('error', { message: '게임을 찾을 수 없거나 게임이 시작되지 않았습니다.' });
                return;
            }
            
            console.log(`[JoinGame] ${socket.data.username}이 게임에 참가: ${roomId}`);
            
            // 기존 플레이어 정보가 있는지 확인
            let existingPlayer = null;
            for (let [playerId, player] of room.players.entries()) {
                if (player.username === socket.data.username) {
                    existingPlayer = player;
                    // 기존 소켓 ID를 새로운 소켓 ID로 업데이트
                    room.players.delete(playerId);
                    break;
                }
            }
            
            // 새로운 플레이어 정보 설정
            const playerInfo = existingPlayer || { id: socket.id, username: socket.data.username, ready: true };
            playerInfo.id = socket.id; // 소켓 ID 업데이트
            room.players.set(socket.id, playerInfo);
            
            socket.join(roomId);
            socket.data.roomId = roomId;
            
            // 유저 상태 업데이트 - 게임 중
            updateUserStatus(socket.id, 'gaming', {
                type: 'room',
                roomId: roomId,
                roomName: room.name
            });
            
            // 게임 상태 전송 (기존 카드 정보 포함)
            const gameState = {
                roomId: roomId,
                players: Array.from(room.players.values()).map(player => ({
                    username: player.username,
                    ready: player.ready,
                    cards: player.cards || null,
                    cardsRevealed: player.cardsRevealed || false
                })),
                currentPlayer: room.host,
                phase: 'preflip',
                communityCards: []
            };
            
            // 게임 시작 이벤트 전송
            socket.emit('gameStarted', {
                room: getRoomState(room),
                gameState: gameState
            });
            
            console.log(`[JoinGame] gameStarted 이벤트 전송 완료 - 플레이어 수: ${room.players.size}`);
        });

        socket.on('gameAction', ({ action, amount, roomId }) => {
            const room = gameRooms.get(roomId);
            if (!room || room.state !== 'playing') {
                socket.emit('error', { message: '게임을 찾을 수 없습니다.' });
                return;
            }
            
            const player = room.players.get(socket.id);
            if (!player) {
                socket.emit('error', { message: '플레이어를 찾을 수 없습니다.' });
                return;
            }
            
            // 게임 액션 처리 (간단한 예시)
            let message = '';
            switch (action) {
                case 'call':
                    message = `${player.username}님이 콜했습니다.`;
                    break;
                case 'raise':
                    message = `${player.username}님이 ${amount}원을 레이즈했습니다.`;
                    break;
                case 'fold':
                    message = `${player.username}님이 폴드했습니다.`;
                    break;
                case 'check':
                    message = `${player.username}님이 체크했습니다.`;
                    break;
                case 'bet':
                    message = `${player.username}님이 ${amount}원을 베팅했습니다.`;
                    break;
            }
            
            // 모든 플레이어에게 게임 메시지 전송
            io.to(roomId).emit('gameMessage', { message: message, type: 'action' });
            
            // 다음 플레이어로 턴 변경 (간단한 예시)
            const players = Array.from(room.players.values());
            const currentIndex = players.findIndex(p => p.username === room.currentPlayer);
            const nextIndex = (currentIndex + 1) % players.length;
            const nextPlayer = players[nextIndex];
            
            room.currentPlayer = nextPlayer.username;
            
            // 업데이트된 게임 상태 전송
            const updatedGameState = {
                currentPlayer: room.currentPlayer,
                pot: room.pot || 0,
                phase: room.phase || 'preflop'
            };
            
            io.to(roomId).emit('gameStateUpdate', updatedGameState);
        });

        // 카드 뒤집기 이벤트
        socket.on('cardRevealed', ({ roomId, username }) => {
            const room = gameRooms.get(roomId);
            if (!room || room.state !== 'playing') {
                socket.emit('error', { message: '게임을 찾을 수 없습니다.' });
                return;
            }
            
            // 해당 플레이어의 카드를 공개 상태로 변경
            room.players.forEach((player, socketId) => {
                if (player.username === username) {
                    player.cardsRevealed = true;
                }
            });
            
            // 모든 플레이어에게 카드 뒤집기 알림
            io.to(roomId).emit('playerCardRevealed', {
                room: getRoomState(room),
                username: username,
                message: `${username}님이 카드를 뒤집었습니다!`
            });
            
            console.log(`[Card Revealed] ${username}의 카드가 공개되었습니다.`);
        });

        // 모든 카드 뒤집기 이벤트
        socket.on('flipAllCards', ({ roomId }) => {
            const room = gameRooms.get(roomId);
            if (!room || room.state !== 'playing') {
                socket.emit('error', { message: '게임을 찾을 수 없습니다.' });
                return;
            }
            
            // 모든 플레이어의 카드를 공개 상태로 변경
            room.players.forEach((player, socketId) => {
                player.cardsRevealed = true;
            });
            
            // 게임 단계를 카드 뒤집기로 변경
            room.phase = 'flipping';
            
            // 모든 플레이어에게 카드 뒤집기 완료 알림
            io.to(roomId).emit('allCardsRevealed', {
                room: getRoomState(room),
                message: '모든 카드가 공개되었습니다!'
            });
            
            console.log(`[All Cards Revealed] 모든 카드가 공개되었습니다.`);
        });

        // 카드 받기 요청 이벤트
        socket.on('requestDealCards', ({ roomId }) => {
            let username = socket.data?.username;
            console.log(`[Request Deal Cards] 카드 받기 요청 받음 - roomId: ${roomId}, socketId: ${socket.id}, username: ${username}`);
            console.log(`[Request Deal Cards] 받은 roomId:`, roomId);
            console.log(`[Request Deal Cards] 현재 방 목록:`, Array.from(gameRooms.keys()));
            
            if (!username) {
                console.log(`[Request Deal Cards] 사용자 이름이 없음 - 기본값 사용`);
                username = 'admin_user';
                socket.data.username = username;
            }
            
            const room = gameRooms.get(roomId);
            console.log(`[Request Deal Cards] 찾은 방:`, room);
            
            if (!room) {
                console.error(`[Request Deal Cards] 방을 찾을 수 없음 - roomId: ${roomId}`);
                socket.emit('error', { message: '게임을 찾을 수 없습니다.' });
                return;
            }
            
            if (room.state !== 'playing') {
                console.error(`[Request Deal Cards] 게임이 진행 중이 아님 - roomId: ${roomId}, state: ${room.state}`);
                socket.emit('error', { message: '게임이 진행 중이 아닙니다.' });
                return;
            }
            
            console.log(`[Request Deal Cards] 카드 받기 요청 - 방 ID: ${roomId}`);
            console.log(`[Request Deal Cards] 방 상태:`, room);
            console.log(`[Request Deal Cards] 방 state:`, room?.state);
            
            // 게임 라운드 초기화
            if (!room.currentRound) {
                room.currentRound = 1;
                room.maxRounds = 5;
                room.deck = createDeck();
                room.communityCards = [];
                room.pot = 0;
                room.currentPlayer = room.host;
                room.phase = 'preflop';
            }
            
            // 카드 덱 생성 및 분배
            const deck = room.deck || createDeck();
            const cardsPerPlayer = 2; // 각 플레이어에게 2장씩 분배
            
            room.players.forEach((player, socketId) => {
                const playerCards = [];
                for (let j = 0; j < cardsPerPlayer; j++) {
                    playerCards.push(deck.pop());
                }
                player.cards = playerCards;
                player.cardsRevealed = false; // 카드는 뒷면으로 받음
                player.chips = player.chips || 1000; // 기본 칩 설정
                player.currentBet = 0; // 베팅 금액 초기화
                
                console.log(`[Request Deal Cards] 플레이어 ${player.username}에게 카드 분배:`, playerCards);
            });
            
            // 덱 업데이트
            room.deck = deck;
            
            console.log(`[Deal Cards] 카드 분배 완료 - 방 ID: ${roomId}, 라운드: ${room.currentRound}`);
            console.log(`[Deal Cards] 방의 플레이어들:`, Array.from(room.players.values()));
            
            // 게임 상태 업데이트
            const gameState = {
                roomId: roomId,
                players: Array.from(room.players.values()).map(player => ({
                    username: player.username,
                    ready: player.ready,
                    cards: player.cards || [],
                    cardsRevealed: player.cardsRevealed || false,
                    chips: player.chips || 1000,
                    currentBet: player.currentBet || 0
                })),
                currentPlayer: room.host,
                phase: room.phase,
                communityCards: room.communityCards || [],
                pot: room.pot || 0,
                currentRound: room.currentRound,
                maxRounds: room.maxRounds
            };
            
            // 모든 플레이어에게 카드 분배 완료 알림
            io.to(roomId).emit('cardsDealt', {
                room: getRoomState(room),
                gameState: gameState,
                message: `라운드 ${room.currentRound}: 카드가 분배되었습니다! 각자 카드 두 장을 받았습니다.`
            });
            
            // 3초 후 자동으로 플랍 공개
            setTimeout(() => {
                console.log(`[Auto Flop] 3초 후 자동 플랍 공개 - 방 ID: ${roomId}`);
                
                // 플랍 카드 3장 분배
                const flopCards = [];
                for (let i = 0; i < 3; i++) {
                    flopCards.push(room.deck.pop());
                }
                
                room.communityCards = flopCards;
                room.phase = 'flop';
                
                console.log(`[Auto Flop] 플랍 카드 분배 완료:`, flopCards);
                
                // 업데이트된 게임 상태
                const updatedGameState = {
                    roomId: roomId,
                    players: Array.from(room.players.values()).map(player => ({
                        username: player.username,
                        ready: player.ready,
                        cards: player.cards || [],
                        cardsRevealed: player.cardsRevealed || false,
                        chips: player.chips || 1000,
                        currentBet: player.currentBet || 0
                    })),
                    currentPlayer: room.currentPlayer,
                    phase: room.phase,
                    communityCards: room.communityCards,
                    pot: room.pot || 0,
                    currentRound: room.currentRound,
                    maxRounds: room.maxRounds
                };
                
                // 모든 플레이어에게 플랍 알림
                io.to(roomId).emit('flopDealt', {
                    room: getRoomState(room),
                    gameState: updatedGameState,
                    message: `라운드 ${room.currentRound}: 플랍이 자동으로 공개되었습니다!`
                });
                
                console.log(`[Auto Flop] 플랍 알림 전송 완료 - 방 ID: ${roomId}`);
            }, 3000);
            
            console.log(`[Deal Cards] 카드 분배 알림 전송 완료 - 방 ID: ${roomId}`);
        });



        socket.on('requestNewGame', ({ roomId }) => {
            const room = gameRooms.get(roomId);
            if (!room) return;
            
            // 게임 상태를 대기 상태로 되돌리기
            room.state = 'waiting';
            room.currentPlayer = null;
            room.pot = 0;
            room.phase = 'waiting';
            room.communityCards = [];
            room.currentRound = null;
            room.maxRounds = null;
            room.deck = null;
            
            // 모든 플레이어의 준비 상태 초기화
            room.players.forEach(player => {
                player.ready = false;
                player.folded = false;
                player.allIn = false;
                player.currentBet = 0;
                player.cards = null;
            });
            
            // 방 상태 업데이트 전송
            io.to(roomId).emit('roomStateUpdate', getRoomState(room));
            io.emit('roomListUpdate', getRoomList());
            
            socket.emit('gameMessage', { message: '새 게임을 시작할 준비가 되었습니다.', type: 'info' });
        });

        socket.on('leaveGame', ({ roomId }) => {
            console.log(`[LeaveGame] 요청 받음 - roomId: ${roomId}, socketId: ${socket.id}`);
            
            const room = gameRooms.get(roomId);
            if (!room) {
                console.log(`[LeaveGame] 방을 찾을 수 없음: ${roomId}`);
                console.log(`[LeaveGame] 현재 방 목록:`, Array.from(gameRooms.keys()));
                return;
            }
            
            const player = room.players.get(socket.id);
            if (!player) {
                console.log(`[LeaveGame] 플레이어를 찾을 수 없음: ${socket.id}`);
                console.log(`[LeaveGame] 방의 플레이어들:`, Array.from(room.players.keys()));
                return;
            }
            
            console.log(`[Game Leave] ${player.username} left game in room ${roomId}`);
            
            // 게임 상태를 대기 상태로 되돌리기
            room.state = 'waiting';
            room.currentPlayer = null;
            room.pot = 0;
            room.phase = 'waiting';
            room.communityCards = [];
            
            // 모든 플레이어의 준비 상태 초기화
            room.players.forEach(p => {
                p.ready = false;
                p.folded = false;
                p.allIn = false;
                p.currentBet = 0;
                p.cards = null;
            });
            
            // 방에 남은 플레이어들에게 게임 종료 알림
            io.to(roomId).emit('playerLeft', { 
                player: player.username,
                message: `${player.username}님이 게임을 나갔습니다. 대기방으로 돌아갑니다.`
            });
            
            // 방 상태 업데이트 전송
            io.to(roomId).emit('roomStateUpdate', getRoomState(room));
            io.emit('roomListUpdate', getRoomList());
            
            // 게임을 나간 플레이어에게 대기방으로 이동하도록 알림
            console.log(`[LeaveGame] returnToLobby 이벤트 전송`);
            socket.emit('returnToLobby', { 
                message: '게임을 나가서 대기방으로 돌아갑니다.',
                roomState: getRoomState(room)
            });
        });

        // 관리자 1인 게임 시작
        socket.on('startAdminGame', async (data) => {
            console.log('[AdminGame] 관리자 1인 게임 시작 요청:', data);
            
            const username = socket.data?.username;
            if (!username) {
                console.log('[AdminGame] 사용자명이 없음');
                socket.emit('error', { message: '사용자명이 필요합니다. 먼저 registerUser를 호출해주세요.' });
                return;
            }
            
            console.log('[AdminGame] 사용자명 확인됨:', username);
            
            const isAdmin = await checkAdminStatus(socket);
            console.log('[AdminGame] 관리자 권한 확인 결과:', isAdmin);
            
            if (!isAdmin) {
                console.log('[AdminGame] 관리자 권한 없음 - 일반 게임으로 진행');
                // 관리자 권한이 없어도 일반 게임으로 진행할 수 있도록 수정
                // socket.emit('error', { message: '관리자 권한이 필요합니다.' });
                // return;
            }
            
            // 관리자 전용 방 생성
            const adminRoomId = `admin_${uuidv4()}`;
            const adminRoom = {
                id: adminRoomId,
                name: `관리자 게임 (${username})`,
                players: new Map(),
                maxPlayers: 8,
                host: username,
                state: 'playing', // 바로 게임 상태로 시작
                pot: 0,
                phase: 'playing',
                communityCards: [],
                currentPlayer: username,
                deck: createDeck()
            };
            
            // 관리자를 플레이어로 추가
            const adminPlayer = {
                username: username,
                ready: true,
                cards: [],
                cardsRevealed: false,
                chips: 1000,
                currentBet: 0,
                folded: false,
                allIn: false
            };
            
            adminRoom.players.set(socket.id, adminPlayer);
            gameRooms.set(adminRoomId, adminRoom);
            console.log('[AdminGame] 방이 gameRooms에 저장됨:', adminRoomId);
            console.log('[AdminGame] 현재 gameRooms 크기:', gameRooms.size);
            
            // 관리자를 방에 입장시킴
            socket.join(adminRoomId);
            
            // 유저 상태를 게임 중으로 업데이트
            updateUserStatus(socket.id, 'gaming', {
                type: 'room',
                roomId: adminRoomId,
                roomName: adminRoom.name
            });
            
            console.log('[AdminGame] 관리자 1인 게임 방 생성 완료:', adminRoomId);
            
            // 관리자에게 게임 시작 알림
            const gameState = {
                roomId: adminRoomId,
                players: [adminPlayer],
                currentPlayer: username,
                phase: 'playing',
                pot: 0,
                isMyTurn: true,
                canCheck: true,
                minBet: 0,
                maxBet: 1000,
                communityCards: []
            };
            
            console.log('[AdminGame] 전송할 gameState:', gameState);
            socket.emit('gameStarted', {
                room: getRoomState(adminRoom),
                gameState: gameState
            });
            
            socket.emit('gameMessage', {
                message: '관리자 1인 게임이 시작되었습니다. 카드 받기 버튼을 눌러 카드를 받으세요.',
                type: 'info'
            });
            
            // 방 목록 업데이트
            io.emit('roomListUpdate', getRoomList());
        });

        // 칩 수집 이벤트
        socket.on('collectChip', (data) => {
            console.log(`[Collect Chip] 칩 수집 요청 - socketId: ${socket.id}, roomId: ${data.roomId}, chipIndex: ${data.chipIndex}`);
            
            const room = gameRooms.get(data.roomId);
            if (!room) {
                console.log(`[Collect Chip] 방을 찾을 수 없음: ${data.roomId}`);
                socket.emit('error', { message: '방을 찾을 수 없습니다.' });
                return;
            }
            
            const player = room.players.get(socket.id);
            if (!player) {
                console.log(`[Collect Chip] 플레이어를 찾을 수 없음: ${socket.id}`);
                socket.emit('error', { message: '플레이어 정보를 찾을 수 없습니다.' });
                return;
            }
            
            // 방에 칩 상태가 없으면 초기화
            if (!room.chips) {
                room.chips = new Set(); // 수집된 칩 인덱스를 저장
            }
            
            // 이미 수집된 칩인지 확인
            if (room.chips.has(data.chipIndex)) {
                socket.emit('error', { message: '이미 수집된 칩입니다.' });
                return;
            }
            
            // 칩 수집 처리
            room.chips.add(data.chipIndex);
            console.log(`[Collect Chip] ${player.username}님이 칩 ${data.chipIndex + 1}을 수집했습니다.`);
            
            // 수집한 플레이어의 칩 수 증가
            player.chips = (player.chips || 0) + 100;
            
            // 모든 플레이어에게 칩 수집 알림
            room.players.forEach((p, socketId) => {
                io.to(socketId).emit('chipCollected', {
                    roomId: data.roomId,
                    chipIndex: data.chipIndex,
                    collectedBy: player.username,
                    remainingChips: Array.from(room.chips)
                });
            });
            
            // 게임 상태 업데이트
            const gameState = {
                roomId: data.roomId,
                players: Array.from(room.players.values()),
                currentPlayer: room.currentPlayer,
                phase: room.state,
                pot: room.pot || 0,
                isMyTurn: room.currentPlayer === player.username,
                canCheck: true,
                minBet: 0,
                maxBet: 1000,
                communityCards: room.communityCards || [],
                collectedChips: Array.from(room.chips)
            };
            
            // 모든 플레이어에게 업데이트된 게임 상태 전송
            room.players.forEach((p, socketId) => {
                io.to(socketId).emit('gameStateUpdate', gameState);
            });
        });

        socket.on('disconnect', (reason) => {
            console.log(`[Socket Disconnect Event] 소켓 연결 해제 - socketId: ${socket.id}, 이유: ${reason}`);
            console.log(`[Socket Disconnect Event] registered 상태: ${registered}`);
            console.log(`[Socket Disconnect Event] socket.data:`, socket.data);
            handleDisconnect(socket);
        });
    });

    // 온라인 유저 상태 조회 함수 (외부에서 접근 가능)
    function getOnlineUsersStatus() {
        console.log('[getOnlineUsersStatus] 호출됨');
        console.log('[getOnlineUsersStatus] onlineUsers 크기:', onlineUsers.size);
        console.log('[getOnlineUsersStatus] userStatus 크기:', userStatus.size);
        
        const statusList = [];
        
        onlineUsers.forEach((socketIds, username) => {
            console.log(`[getOnlineUsersStatus] 사용자 ${username}의 소켓들:`, Array.from(socketIds));
            
            // 각 사용자의 첫 번째 소켓 정보를 사용
            const firstSocketId = socketIds.values().next().value;
            console.log(`[getOnlineUsersStatus] 첫 번째 소켓 ID: ${firstSocketId}`);
            
            if (firstSocketId && userStatus.has(firstSocketId)) {
                const status = userStatus.get(firstSocketId);
                console.log(`[getOnlineUsersStatus] 상태 정보:`, status);
                statusList.push({
                    username: status.username,
                    status: status.status,
                    location: status.location,
                    connectTime: status.connectTime
                });
            } else {
                console.log(`[getOnlineUsersStatus] 소켓 ID ${firstSocketId}의 상태를 찾을 수 없음`);
            }
        });
        
        console.log('[getOnlineUsersStatus] 반환할 상태 목록:', statusList);
        return statusList;
    }
    
    // 유저 상태 업데이트 함수
    function updateUserStatus(socketId, status, location = null) {
        if (userStatus.has(socketId)) {
            const currentStatus = userStatus.get(socketId);
            currentStatus.status = status;
            currentStatus.location = location;
            userStatus.set(socketId, currentStatus);
        }
    }

    // 외부에서 접근 가능한 함수들
    return {
        getOnlineUsersStatus,
        getRoomList,
        emitOnlineUsers
    };
}; 