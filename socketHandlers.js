const db = require('./database');
const { v4: uuidv4 } = require('uuid');

// 서버 전체에서 사용자 및 방 정보를 관리
const onlineUsers = new Map(); // username -> Set(socket.id)
const gameRooms = new Map(); // roomId -> { id, name, players, maxPlayers, host, state }
const userStatus = new Map(); // socket.id -> { username, status, location, connectTime }

// 실시간 데이터 저장을 위한 게임 상태 매핑
const gameStateMapping = new Map(); // roomId -> { gameId, currentRound, phase }

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

// 실시간 데이터 저장 함수들
async function saveGameState(roomId, gameData) {
    try {
        const room = gameRooms.get(roomId);
        if (!room || !gameData.gameId) return;

        // 게임 상태 업데이트
        await db.updateGameStatus(gameData.gameId, gameData.status, gameData.startedAt, gameData.endedAt);
        
        // 게임 상태 매핑 업데이트
        gameStateMapping.set(roomId, {
            gameId: gameData.gameId,
            currentRound: gameData.currentRound || 1,
            phase: gameData.phase || 'waiting'
        });

        console.log(`[Data Save] 게임 상태 저장 완료: ${roomId} -> ${gameData.gameId}`);
    } catch (error) {
        console.error(`[Data Save] 게임 상태 저장 실패: ${roomId}`, error);
    }
}

async function savePlayerAction(roomId, username, actionType, amount = 0, position = null) {
    try {
        const gameState = gameStateMapping.get(roomId);
        if (!gameState || !gameState.gameId) return;

        // 플레이어 액션 기록
        await db.recordPlayerAction(
            gameState.gameId,
            gameState.currentRound,
            username,
            actionType,
            amount,
            position
        );

        console.log(`[Data Save] 플레이어 액션 저장: ${username} - ${actionType} (${amount})`);
    } catch (error) {
        console.error(`[Data Save] 플레이어 액션 저장 실패: ${username}`, error);
    }
}

async function saveRoundState(roomId, roundData) {
    try {
        const gameState = gameStateMapping.get(roomId);
        if (!gameState || !gameState.gameId) return;

        // 라운드 상태 저장/업데이트
        if (roundData.isNewRound) {
            await db.createGameRound(
                gameState.gameId,
                roundData.roundNumber,
                roundData.phase,
                roundData.communityCards
            );
        } else {
            await db.updateRoundPot(gameState.gameId, roundData.roundNumber, roundData.potAmount);
        }

        // 게임 상태 매핑 업데이트
        gameStateMapping.set(roomId, {
            ...gameState,
            currentRound: roundData.roundNumber,
            phase: roundData.phase
        });

        console.log(`[Data Save] 라운드 상태 저장: ${roomId} - 라운드 ${roundData.roundNumber}`);
    } catch (error) {
        console.error(`[Data Save] 라운드 상태 저장 실패: ${roomId}`, error);
    }
}

async function saveGameResult(roomId, gameResult) {
    try {
        const gameState = gameStateMapping.get(roomId);
        if (!gameState || !gameState.gameId) return;

        // 게임 결과 저장
        await db.saveGameResult(
            gameState.gameId,
            gameResult.winner,
            gameResult.finalPot,
            gameResult.gameDuration
        );

        console.log(`[Data Save] 게임 결과 저장: ${roomId} - 승자: ${gameResult.winner}`);
    } catch (error) {
        console.error(`[Data Save] 게임 결과 저장 실패: ${roomId}`, error);
    }
}

// 게임 데이터베이스 초기화 함수
async function initializeGameDatabase(roomId, room) {
    try {
        const gameId = await db.createGame(roomId, room.name);
        if (gameId) {
            console.log(`[Database] 게임 초기화 완료: ${roomId} -> ${gameId}`);
            return gameId;
        }
    } catch (error) {
        console.error(`[Database] 게임 초기화 실패: ${roomId}`, error);
    }
    return null;
}

module.exports = function(io) {
    // 연결된 소켓을 추적하기 위한 Set
    const connectedSockets = new Set();
    
    // 사용자 등록 상태를 추적하기 위한 Map
    const registeredUsers = new Map(); // socket.id -> username

    function handleDisconnect(socket) {
        const username = socket.data?.username;
        console.log(`[Socket Disconnect] User disconnected: ${username || 'unknown'} (${socket.id})`);
        
        if (username && onlineUsers.has(username)) {
            onlineUsers.get(username).delete(socket.id);
            if (onlineUsers.get(username).size === 0) {
                onlineUsers.delete(username);
            }
            io.emit('onlineUsers', Array.from(onlineUsers.keys()));
        }
        
        // 유저 상태 정리
        userStatus.delete(socket.id);
        
        // 모든 게임방을 순회하며 해당 유저를 제거
        gameRooms.forEach((room, roomId) => {
            if (room.players.has(socket.id)) {
                room.players.delete(socket.id);
                console.log(`[Socket Disconnect] User ${username || 'unknown'} removed from room ${roomId}`);
                
                // 방에 아무도 없으면 방 삭제 (게임 중인 방은 30초, 일반 방은 10초 대기)
                const isGameRoom = roomId.startsWith('game_') || roomId.startsWith('admin_');
                const deleteDelay = isGameRoom ? 30000 : 10000; // 게임 방은 30초, 일반 방은 10초
                
                console.log(`[Room Cleanup] ${roomId} 방 삭제 예약 (${deleteDelay/1000}초 후)`);
                
                setTimeout(() => {
                    const targetRoom = gameRooms.get(roomId);
                    if (targetRoom && targetRoom.players.size === 0) {
                        gameRooms.delete(roomId);
                        // 게임 상태 매핑도 정리
                        gameStateMapping.delete(roomId);
                        console.log(`[Room Deleted] Room ${roomId} is empty and has been deleted (after ${deleteDelay/1000}s delay).`);
                        io.emit('roomListUpdate', Array.from(gameRooms.values()).map(room => ({
                            id: room.id,
                            name: room.name,
                            playerCount: room.players.size,
                            maxPlayers: room.maxPlayers,
                            state: room.state
                        })));
                    } else if (targetRoom) {
                        console.log(`[Room Kept] Room ${roomId} has ${targetRoom.players.size} players, keeping alive.`);
                    }
                }, deleteDelay);
            }
        });
        io.emit('roomListUpdate', Array.from(gameRooms.values()).map(room => ({
            id: room.id,
            name: room.name,
            playerCount: room.players.size,
            maxPlayers: room.maxPlayers,
            state: room.state
        })));
    }

    function getRoomState(room) {
        return {
            id: room.id,
            name: room.name,
            players: Array.from(room.players.values()).map(player => ({
                ...player,
                ready: player.ready === true, // 명시적으로 boolean 값으로 변환
                isHost: player.username === room.host // isHost 상태도 명시적으로 설정
            })),
            host: room.host,
            state: room.state,
            maxPlayers: room.maxPlayers || 4,
            gameMode: room.gameMode || 'beginner',
            communityCards: room.communityCards || [],
            phase: room.phase || 'waiting',
            currentRound: room.currentRound || 1,
            maxRounds: room.maxRounds || 5,
            pot: room.pot || 0
        };
    }
    
    async function startRoomGame(roomId) {
        console.log(`[startRoomGame] 함수 호출됨 - roomId: ${roomId}`);
        const room = gameRooms.get(roomId);
        if (!room || room.state !== 'waiting') {
            console.log(`[startRoomGame] 방을 찾을 수 없거나 대기 상태가 아님 - room:`, room);
            return;
        }

        console.log(`[startRoomGame] 방 정보 확인 - playerCount: ${room.players.size}, state: ${room.state}`);
        
        // 최소 2명의 플레이어가 필요
        if (room.players.size < 2) {
            console.error(`[Game Start] 최소 2명의 플레이어가 필요합니다. 현재: ${room.players.size}명`);
            return;
        }

        try {
            console.log(`[startRoomGame] 게임 데이터베이스 초기화 시작`);
            // 게임 데이터베이스 초기화
            const gameId = await initializeGameDatabase(roomId, room);
            if (!gameId) {
                console.error(`[Game Start] 게임 데이터베이스 초기화 실패: ${roomId}`);
                return;
            }

            console.log(`[startRoomGame] 게임 데이터베이스 초기화 성공 - gameId: ${gameId}`);
            room.state = 'playing';
            console.log(`[Game Start] Game starting in room ${roomId} with game ID: ${gameId}`);
            
            // 게임 시작 시에는 카드를 분배하지 않고, 카드 받기 버튼을 통해 분배하도록 함
            room.players.forEach((player, socketId) => {
                player.cards = []; // 빈 카드 배열로 초기화
                player.cardsRevealed = false;
                player.chips = 1000; // 기본 칩 설정
                player.initialChips = 1000; // 초기 칩 수 저장
            });

            // 게임 상태 저장
            await saveGameState(roomId, {
                gameId: gameId,
                status: 'playing',
                startedAt: new Date(),
                currentRound: 1,
                phase: 'waiting'
            });

            // 모든 플레이어에게 게임 시작 알림
            io.to(roomId).emit('gameStarted', {
                gameId: gameId,
                players: Array.from(room.players.values()).map(player => ({
                    username: player.username,
                    chips: player.chips
                }))
            });

            // 방 상태 업데이트를 모든 플레이어에게 전송
            const roomState = getRoomState(room);
            io.to(roomId).emit('roomStateUpdate', roomState);

        } catch (error) {
            console.error(`[Game Start] 게임 시작 실패: ${roomId}`, error);
            room.state = 'waiting';
        }
    }

    // Socket.io 연결 처리
    io.on('connection', (socket) => {
        console.log(`[Socket Connect] 새로운 소켓 연결: ${socket.id}`);
        connectedSockets.add(socket.id);
        
        let registered = false;

        // 사용자 등록 (registerUser 이벤트로 변경)
        socket.on('registerUser', (username) => {
            try {
                if (!username || username.trim() === '') {
                    socket.emit('error', { message: '사용자명이 올바르지 않습니다.' });
                    return;
                }

                registered = true;
                
                // 소켓에 사용자 정보 저장
                socket.data = { ...socket.data, username, isAdmin: false };
                
                // 온라인 사용자 목록에 추가
                if (!onlineUsers.has(username)) {
                    onlineUsers.set(username, new Set());
                }
                onlineUsers.get(username).add(socket.id);
                
                // 사용자 상태 저장
                userStatus.set(socket.id, {
                    username: username,
                    status: 'online',
                    location: 'lobby',
                    connectTime: new Date()
                });

                // 등록된 사용자 목록에 추가
                registeredUsers.set(socket.id, username);

                console.log(`[Register] 사용자 등록 완료: ${username} (${socket.id})`);
                
                // 클라이언트에 등록 성공 응답
                socket.emit('registerUserSuccess', { 
                    username: username,
                    message: '사용자 등록이 완료되었습니다.'
                });

                // 모든 클라이언트에 온라인 사용자 목록 업데이트
                io.emit('onlineUsers', Array.from(onlineUsers.keys()));

                // 방 목록 전송
                socket.emit('roomListUpdate', Array.from(gameRooms.values()).map(room => ({
                    id: room.id,
                    name: room.name,
                    playerCount: room.players.size,
                    maxPlayers: room.maxPlayers,
                    state: room.state
                })));

            } catch (error) {
                console.error('[Register] 사용자 등록 실패:', error);
                socket.emit('error', { message: '사용자 등록에 실패했습니다.' });
            }
        });

        // 방 생성
        socket.on('createRoom', (data) => {
            try {
                const username = socket.data?.username;
                if (!registered || !username) {
                    socket.emit('error', { message: '먼저 사용자 등록을 해주세요.' });
                    return;
                }

                const { roomName, maxPlayers = 4, gameMode = 'beginner' } = data;
                
                if (!roomName || roomName.trim() === '') {
                    socket.emit('error', { message: '방 이름을 입력해주세요.' });
                    return;
                }

                // 방 ID 생성
                const roomId = `room_${uuidv4()}`;
                
                // 새 방 생성
                const newRoom = {
                    id: roomId,
                    name: roomName,
                    players: new Map(),
                    maxPlayers: maxPlayers,
                    host: username,
                    state: 'waiting',
                    gameMode: gameMode, // 클라이언트에서 받은 게임 모드
                    createdAt: new Date()
                };

                // 방에 호스트 추가 (방장도 기본적으로 미준비 상태)
                newRoom.players.set(socket.id, {
                    username: username,
                    isHost: true,
                    ready: false, // 방장도 기본적으로 미준비 상태
                    joinTime: new Date()
                });

                // 방 목록에 추가
                gameRooms.set(roomId, newRoom);

                // 방 생성자에게 방 생성 성공 응답
                socket.emit('roomCreated', {
                    roomId: roomId,
                    room: getRoomState(newRoom)
                });

                // 방 생성자를 새로 생성된 방에 입장시킴
                socket.join(roomId);

                // 방 생성자에게 방 상태 업데이트 전송
                const roomState = getRoomState(newRoom);
                socket.emit('roomStateUpdate', roomState);

                // 모든 클라이언트에 방 목록 업데이트
                io.emit('roomListUpdate', Array.from(gameRooms.values()).map(room => ({
                    id: room.id,
                    name: room.name,
                    playerCount: room.players.size,
                    maxPlayers: room.maxPlayers,
                    state: room.state
                })));

                console.log(`[Create Room] 방 생성 완료: ${roomName} (${roomId}) by ${username}`);

            } catch (error) {
                console.error('[Create Room] 방 생성 실패:', error);
                socket.emit('error', { message: '방 생성에 실패했습니다.' });
            }
        });

        // 방 입장
        socket.on('joinRoom', (data) => {
            try {
                const username = socket.data?.username;
                if (!registered || !username) {
                    socket.emit('error', { message: '먼저 사용자 등록을 해주세요.' });
                    return;
                }

                const { roomId } = data;
                const room = gameRooms.get(roomId);
                
                if (!room) {
                    socket.emit('error', { message: '존재하지 않는 방입니다.' });
                    return;
                }

                if (room.state !== 'waiting') {
                    socket.emit('error', { message: '게임이 이미 진행 중인 방입니다.' });
                    return;
                }

                if (room.players.size >= room.maxPlayers) {
                    socket.emit('error', { message: '방이 가득 찼습니다.' });
                    return;
                }

                // 이미 방에 있는지 확인
                if (room.players.has(socket.id)) {
                    socket.emit('error', { message: '이미 방에 입장해 있습니다.' });
                    return;
                }

                // 방에 입장 (새로 입장하는 플레이어는 기본적으로 미준비 상태)
                room.players.set(socket.id, {
                    username: username,
                    isHost: false,
                    ready: false, // 새로 입장하는 플레이어는 미준비 상태
                    joinTime: new Date()
                });
                
                // 새 사용자 입장 시 모든 유저의 준비 상태 해제
                room.players.forEach(player => {
                    player.ready = false;
                });

                // 소켓을 방에 참여시킴
                socket.join(roomId);

                // 방 입장 성공 응답 (클라이언트가 기대하는 이벤트명으로 변경)
                socket.emit('joinRoomSuccess', getRoomState(room));

                // 방의 다른 플레이어들에게 새 플레이어 입장 알림
                socket.to(roomId).emit('playerJoined', {
                    username: username,
                    playerCount: room.players.size
                });

                // 방의 모든 플레이어에게 방 상태 업데이트 전송
                const roomState = getRoomState(room);
                io.to(roomId).emit('roomStateUpdate', roomState);

                // 모든 클라이언트에 방 목록 업데이트
                io.emit('roomListUpdate', Array.from(gameRooms.values()).map(room => ({
                    id: room.id,
                    name: room.name,
                    playerCount: room.players.size,
                    maxPlayers: room.maxPlayers,
                    state: room.state
                })));

                console.log(`[Join Room] ${username}이(가) 방 ${roomId}에 입장했습니다.`);

            } catch (error) {
                console.error('[Join Room] 방 입장 실패:', error);
                socket.emit('error', { message: '방 입장에 실패했습니다.' });
            }
        });

        // 방 나가기
        socket.on('leaveRoom', (data) => {
            try {
                const username = socket.data?.username;
                if (!registered || !username) {
                    socket.emit('error', { message: '먼저 사용자 등록을 해주세요.' });
                    return;
                }

                // 사용자가 속한 방 찾기
                let room = null;
                let roomId = null;
                for (const [id, r] of gameRooms) {
                    if (r.players.has(socket.id)) {
                        room = r;
                        roomId = id;
                        break;
                    }
                }
                
                if (!room) {
                    socket.emit('error', { message: '방에 입장하지 않았습니다.' });
                    return;
                }

                // 방에서 나가기
                room.players.delete(socket.id);
                socket.leave(roomId);

                // 방 나가기 성공 응답
                socket.emit('leftRoomSuccess');

                // 방의 다른 플레이어들에게 플레이어 퇴장 알림
                socket.to(roomId).emit('playerLeft', {
                    username: username,
                    playerCount: room.players.size
                });

                // 방에 아무도 없으면 방 삭제
                if (room.players.size === 0) {
                    gameRooms.delete(roomId);
                    console.log(`[Leave Room] 방 ${roomId}가 비어서 삭제되었습니다.`);
                } else {
                    // 호스트가 나간 경우 새로운 호스트 지정
                    if (room.host === username) {
                        const newHost = room.players.values().next().value;
                        room.host = newHost.username;
                        newHost.isHost = true;
                        console.log(`[Leave Room] 새로운 호스트: ${newHost.username}`);
                    }
                }

                // 모든 클라이언트에 방 목록 업데이트
                io.emit('roomListUpdate', Array.from(gameRooms.values()).map(room => ({
                    id: room.id,
                    name: room.name,
                    playerCount: room.players.size,
                    maxPlayers: room.maxPlayers,
                    state: room.state
                })));

                console.log(`[Leave Room] ${username}이(가) 방 ${roomId}에서 나갔습니다.`);

            } catch (error) {
                console.error('[Leave Room] 방 나가기 실패:', error);
                socket.emit('error', { message: '방 나가기에 실패했습니다.' });
            }
        });

        // 준비 상태 토글
        socket.on('toggleReady', () => {
            try {
                const username = socket.data?.username;
                if (!registered || !username) {
                    socket.emit('error', { message: '먼저 사용자 등록을 해주세요.' });
                    return;
                }

                // 사용자가 속한 방 찾기
                let userRoom = null;
                for (const [roomId, room] of gameRooms) {
                    if (room.players.has(socket.id)) {
                        userRoom = room;
                        break;
                    }
                }

                if (!userRoom) {
                    socket.emit('error', { message: '방에 입장하지 않았습니다.' });
                    return;
                }

                // 플레이어의 준비 상태 토글
                const player = userRoom.players.get(socket.id);
                if (player) {
                    player.ready = !player.ready;
                    console.log(`[Toggle Ready] ${username} 준비 상태: ${player.ready ? '준비' : '미준비'}`);

                    // 방의 모든 플레이어에게 상태 업데이트 전송
                    const roomState = getRoomState(userRoom);
                    io.to(userRoom.id).emit('roomStateUpdate', roomState);
                }

            } catch (error) {
                console.error('[Toggle Ready] 준비 상태 토글 실패:', error);
                socket.emit('error', { message: '준비 상태 변경에 실패했습니다.' });
            }
        });

        // 게임 시작
        socket.on('startGame', async (data) => {
            try {
                const username = socket.data?.username;
                if (!registered || !username) {
                    socket.emit('error', { message: '먼저 사용자 등록을 해주세요.' });
                    return;
                }

                const { roomId } = data;
                const room = gameRooms.get(roomId);
                
                if (!room) {
                    socket.emit('error', { message: '존재하지 않는 방입니다.' });
                    return;
                }

                if (room.host !== username) {
                    socket.emit('error', { message: '호스트만 게임을 시작할 수 있습니다.' });
                    return;
                }

                if (room.players.size < 2) {
                    socket.emit('error', { message: '게임을 시작하려면 최소 2명의 플레이어가 필요합니다.' });
                    return;
                }

                // 게임 시작
                await startRoomGame(roomId);

            } catch (error) {
                console.error('[Start Game] 게임 시작 실패:', error);
                socket.emit('error', { message: '게임 시작에 실패했습니다.' });
            }
        });

        // 방 게임 시작 (startRoomGame 이벤트)
        socket.on('startRoomGame', async (data) => {
            try {
                console.log('[Start Room Game] 이벤트 수신:', data);
                const username = socket.data?.username;
                if (!registered || !username) {
                    console.log('[Start Room Game] 사용자 등록 안됨');
                    socket.emit('error', { message: '먼저 사용자 등록을 해주세요.' });
                    return;
                }

                const { roomId } = data;
                console.log('[Start Room Game] roomId:', roomId);
                const room = gameRooms.get(roomId);
                
                if (!room) {
                    console.log('[Start Room Game] 방을 찾을 수 없음');
                    socket.emit('error', { message: '존재하지 않는 방입니다.' });
                    return;
                }

                console.log('[Start Room Game] 방 정보:', {
                    host: room.host,
                    username: username,
                    playerCount: room.players.size,
                    state: room.state
                });

                if (room.host !== username) {
                    console.log('[Start Room Game] 호스트가 아님');
                    socket.emit('error', { message: '호스트만 게임을 시작할 수 있습니다.' });
                    return;
                }

                if (room.players.size < 2) {
                    console.log('[Start Room Game] 플레이어 수 부족');
                    socket.emit('error', { message: '게임을 시작하려면 최소 2명의 플레이어가 필요합니다.' });
                    return;
                }

                // 모든 플레이어가 준비되었는지 확인
                const allReady = Array.from(room.players.values()).every(player => player.ready);
                console.log('[Start Room Game] 모든 플레이어 준비 상태:', allReady);
                console.log('[Start Room Game] 플레이어 준비 상태:', Array.from(room.players.values()).map(p => ({ username: p.username, ready: p.ready })));
                
                if (!allReady) {
                    console.log('[Start Room Game] 모든 플레이어가 준비되지 않음');
                    socket.emit('error', { message: '모든 플레이어가 준비되어야 합니다.' });
                    return;
                }

                console.log('[Start Room Game] 게임 시작 조건 만족, startRoomGame 함수 호출');
                // 게임 시작
                await startRoomGame(roomId);

            } catch (error) {
                console.error('[Start Room Game] 게임 시작 실패:', error);
                socket.emit('error', { message: '게임 시작에 실패했습니다.' });
            }
        });

        // 카드 받기
        socket.on('getCards', (data) => {
            try {
                const username = socket.data?.username;
                if (!registered || !username) {
                    socket.emit('error', { message: '먼저 사용자 등록을 해주세요.' });
                    return;
                }

                const { roomId } = data;
                const room = gameRooms.get(roomId);
                
                if (!room) {
                    socket.emit('error', { message: '존재하지 않는 방입니다.' });
                    return;
                }

                if (!room.players.has(socket.id)) {
                    socket.emit('error', { message: '방에 입장하지 않았습니다.' });
                    return;
                }

                if (room.state !== 'playing') {
                    socket.emit('error', { message: '게임이 진행 중이 아닙니다.' });
                    return;
                }

                const player = room.players.get(socket.id);
                
                // 이미 카드를 받았는지 확인
                if (player.cards && player.cards.length > 0) {
                    socket.emit('error', { message: '이미 카드를 받았습니다.' });
                    return;
                }

                // 카드 분배 (간단한 랜덤 카드)
                const suits = ['♠', '♥', '♦', '♣'];
                const values = ['A', '2', '3', '4', '5', '6', '7', '8', '9', '10', 'J', 'Q', 'K'];
                
                const card1 = {
                    suit: suits[Math.floor(Math.random() * suits.length)],
                    value: values[Math.floor(Math.random() * values.length)]
                };
                
                const card2 = {
                    suit: suits[Math.floor(Math.random() * suits.length)],
                    value: values[Math.floor(Math.random() * values.length)]
                };

                player.cards = [card1, card2];
                player.cardsRevealed = false;

                // 플레이어에게 카드 전송
                socket.emit('cardsReceived', {
                    cards: player.cards,
                    message: '카드를 받았습니다.'
                });

                // 다른 플레이어들에게 카드 받기 완료 알림
                socket.to(roomId).emit('playerGotCards', {
                    username: username,
                    message: `${username}이(가) 카드를 받았습니다.`
                });

                console.log(`[Get Cards] ${username}이(가) 카드를 받았습니다.`);

            } catch (error) {
                console.error('[Get Cards] 카드 받기 실패:', error);
                socket.emit('error', { message: '카드 받기에 실패했습니다.' });
            }
        });

        // 카드 공개
        socket.on('revealCards', (data) => {
            try {
                const username = socket.data?.username;
                if (!registered || !username) {
                    socket.emit('error', { message: '먼저 사용자 등록을 해주세요.' });
                    return;
                }

                const { roomId } = data;
                const room = gameRooms.get(roomId);
                
                if (!room) {
                    socket.emit('error', { message: '존재하지 않는 방입니다.' });
                    return;
                }

                if (!room.players.has(socket.id)) {
                    socket.emit('error', { message: '방에 입장하지 않았습니다.' });
                    return;
                }

                if (room.state !== 'playing') {
                    socket.emit('error', { message: '게임이 진행 중이 아닙니다.' });
                    return;
                }

                const player = room.players.get(socket.id);
                
                if (!player.cards || player.cards.length === 0) {
                    socket.emit('error', { message: '먼저 카드를 받아주세요.' });
                    return;
                }

                if (player.cardsRevealed) {
                    socket.emit('error', { message: '이미 카드를 공개했습니다.' });
                    return;
                }

                // 카드 공개
                player.cardsRevealed = true;

                // 모든 플레이어에게 카드 공개 알림
                io.to(roomId).emit('cardsRevealed', {
                    username: username,
                    cards: player.cards,
                    message: `${username}의 카드가 공개되었습니다.`
                });

                console.log(`[Reveal Cards] ${username}의 카드가 공개되었습니다.`);

            } catch (error) {
                console.error('[Reveal Cards] 카드 공개 실패:', error);
                socket.emit('error', { message: '카드 공개에 실패했습니다.' });
            }
        });

        // 다음 라운드
        socket.on('nextRound', async (data) => {
            try {
                const username = socket.data?.username;
                if (!registered || !username) {
                    socket.emit('error', { message: '먼저 사용자 등록을 해주세요.' });
                    return;
                }

                const { roomId } = data;
                const room = gameRooms.get(roomId);
                
                if (!room) {
                    socket.emit('error', { message: '존재하지 않는 방입니다.' });
                    return;
                }

                if (!room.players.has(socket.id)) {
                    socket.emit('error', { message: '방에 입장하지 않았습니다.' });
                    return;
                }

                if (room.state !== 'playing') {
                    socket.emit('error', { message: '게임이 진행 중이 아닙니다.' });
                    return;
                }

                if (room.host !== username) {
                    socket.emit('error', { message: '호스트만 다음 라운드로 진행할 수 있습니다.' });
                    return;
                }

                // 현재 라운드 증가
                room.currentRound = (room.currentRound || 1) + 1;
                
                // 최대 라운드에 도달했는지 확인
                if (room.currentRound > (room.maxRounds || 5)) {
                    // 게임 종료
                    room.state = 'finished';
                    
                    // 게임 결과 계산 (간단한 예시)
                    const players = Array.from(room.players.values());
                    const winner = players[Math.floor(Math.random() * players.length)];
                    
                    // 게임 결과 저장
                    await saveGameResult(roomId, {
                        winner: winner.username,
                        finalPot: room.pot || 0,
                        gameDuration: Date.now() - room.createdAt
                    });

                    // 모든 플레이어에게 게임 종료 알림
                    io.to(roomId).emit('gameEnded', {
                        winner: winner.username,
                        finalPot: room.pot || 0,
                        message: '게임이 종료되었습니다.'
                    });

                    console.log(`[Next Round] 게임 종료 - 승자: ${winner.username}`);
                } else {
                    // 다음 라운드 시작
                    room.phase = 'waiting';
                    
                    // 모든 플레이어의 카드 초기화
                    room.players.forEach((player, socketId) => {
                        player.cards = [];
                        player.cardsRevealed = false;
                    });

                    // 모든 플레이어에게 다음 라운드 알림
                    io.to(roomId).emit('nextRoundStarted', {
                        round: room.currentRound,
                        message: `${room.currentRound}라운드가 시작되었습니다.`
                    });

                    console.log(`[Next Round] ${room.currentRound}라운드 시작`);
                }

                // 라운드 상태 저장
                await saveRoundState(roomId, {
                    isNewRound: true,
                    roundNumber: room.currentRound,
                    phase: room.phase,
                    communityCards: room.communityCards || []
                });

            } catch (error) {
                console.error('[Next Round] 라운드 진행 실패:', error);
                socket.emit('error', { message: '라운드 진행에 실패했습니다.' });
            }
        });

        // 게임 포기
        socket.on('giveUpGame', (data) => {
            try {
                const username = socket.data?.username;
                if (!registered || !username) {
                    socket.emit('error', { message: '먼저 사용자 등록을 해주세요.' });
                    return;
                }

                const { roomId } = data;
                const room = gameRooms.get(roomId);
                
                if (!room) {
                    socket.emit('error', { message: '존재하지 않는 방입니다.' });
                    return;
                }

                if (!room.players.has(socket.id)) {
                    socket.emit('error', { message: '방에 입장하지 않았습니다.' });
                    return;
                }

                // 게임 포기 처리
                console.log(`[Give Up Game] ${username}이(가) 게임을 포기했습니다.`);
                
                // 모든 플레이어에게 게임 포기 알림
                io.to(roomId).emit('gameEndedByGiveUp', {
                    reason: `${username}이(가) 게임을 포기했습니다.`,
                    roomId: roomId
                });

                // 방 상태를 대기 중으로 변경
                room.state = 'waiting';
                
                // 모든 플레이어의 준비 상태 초기화
                room.players.forEach(player => {
                    player.ready = false;
                });

                // 방 상태 업데이트 전송
                const roomState = getRoomState(room);
                io.to(roomId).emit('roomStateUpdate', roomState);

            } catch (error) {
                console.error('[Give Up Game] 게임 포기 처리 실패:', error);
                socket.emit('error', { message: '게임 포기 처리에 실패했습니다.' });
            }
        });

        // 게임 설정 업데이트
        socket.on('updateGameSettings', (data) => {
            try {
                const username = socket.data?.username;
                if (!registered || !username) {
                    socket.emit('error', { message: '먼저 사용자 등록을 해주세요.' });
                    return;
                }

                const { roomId, gameMode, maxPlayers } = data;
                const room = gameRooms.get(roomId);
                
                if (!room) {
                    socket.emit('error', { message: '존재하지 않는 방입니다.' });
                    return;
                }

                if (room.host !== username) {
                    socket.emit('error', { message: '방장만 게임 설정을 변경할 수 있습니다.' });
                    return;
                }

                if (room.state !== 'waiting') {
                    socket.emit('error', { message: '게임이 진행 중일 때는 설정을 변경할 수 없습니다.' });
                    return;
                }

                // 설정 업데이트
                if (gameMode) {
                    room.gameMode = gameMode;
                }
                
                if (maxPlayers) {
                    // 현재 인원보다 적게 설정하려는 경우 방지
                    if (maxPlayers < room.players.size) {
                        socket.emit('error', { message: `현재 플레이어 수(${room.players.size}명)보다 적게 설정할 수 없습니다.` });
                        return;
                    }
                    room.maxPlayers = maxPlayers;
                }

                // 설정 변경 시 모든 플레이어 준비 상태 해지
                room.players.forEach(player => {
                    player.ready = false;
                });

                // 방의 모든 플레이어에게 설정 변경 및 상태 업데이트 전송
                const roomState = getRoomState(room);
                io.to(roomId).emit('roomStateUpdate', roomState);
                io.to(roomId).emit('gameSettingsUpdated', {
                    gameMode: room.gameMode,
                    maxPlayers: room.maxPlayers
                });

                // 모든 클라이언트에 방 목록 업데이트
                io.emit('roomListUpdate', Array.from(gameRooms.values()).map(room => ({
                    id: room.id,
                    name: room.name,
                    playerCount: room.players.size,
                    maxPlayers: room.maxPlayers,
                    state: room.state
                })));

                console.log(`[Update Game Settings] ${username}이(가) 방 ${roomId}의 설정을 변경했습니다. gameMode: ${gameMode}, maxPlayers: ${maxPlayers}`);

            } catch (error) {
                console.error('[Update Game Settings] 게임 설정 업데이트 실패:', error);
                socket.emit('error', { message: '게임 설정 업데이트에 실패했습니다.' });
            }
        });

        // 게임 종료
        socket.on('endGame', async (data) => {
            try {
                const username = socket.data?.username;
                const { roomId, gameResult } = data;
                const room = gameRooms.get(roomId);
                
                if (!room || room.state !== 'playing') {
                    socket.emit('error', { message: '게임이 진행 중이 아닙니다.' });
                    return;
                }
                
                // 게임 결과를 데이터베이스에 저장
                await saveGameResult(roomId, gameResult);
                
                // 게임 상태를 종료로 변경
                room.state = 'finished';
                
                // 모든 플레이어에게 게임 종료 알림
                io.to(roomId).emit('gameEnded', {
                    gameResult: gameResult,
                    finalStats: {
                        totalPot: room.pot,
                        players: Array.from(room.players.values()).map(player => ({
                            username: player.username,
                            finalChips: player.chips,
                            chipsChange: player.chips - (player.initialChips || 1000)
                        }))
                    }
                });
                
                console.log(`[End Game] 게임 종료 - 방 ID: ${roomId}`);
                
            } catch (error) {
                console.error('[End Game] 게임 종료 처리 실패:', error);
                socket.emit('error', { message: '게임 종료 처리에 실패했습니다.' });
            }
        });

        socket.on('disconnect', (reason) => {
            console.log(`[Socket Disconnect Event] 소켓 연결 해제 - socketId: ${socket.id}, 이유: ${reason}`);
            console.log(`[Socket Disconnect Event] registered 상태: ${registered}`);
            console.log(`[Socket Disconnect Event] socket.data:`, socket.data);
            handleDisconnect(socket);
        });
    }); // io.on('connection') 블록 끝

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
        getOnlineUsersStatus
    };
};