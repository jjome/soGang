const db = require('./database');
const { v4: uuidv4 } = require('uuid');

// 서버 전체에서 사용자 및 방 정보를 관리
const onlineUsers = new Map(); // username -> Set(socket.id)
const gameRooms = new Map(); // roomId -> { id, name, players, maxPlayers, host, state }

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
        const username = socket.data.username;
        if (username && onlineUsers.has(username)) {
            onlineUsers.get(username).delete(socket.id);
            if (onlineUsers.get(username).size === 0) {
                onlineUsers.delete(username);
            }
            emitOnlineUsers();
        }
        console.log(`[Socket Disconnect] User disconnected: ${username} (${socket.id})`);
        
        // 모든 게임방을 순회하며 해당 유저를 제거
        gameRooms.forEach((room, roomId) => {
            if (room.players.has(socket.id)) {
                room.players.delete(socket.id);
                // 방에 아무도 없으면 방 삭제
                if (room.players.size === 0) {
                    gameRooms.delete(roomId);
                    console.log(`[Room Deleted] Room ${roomId} is empty and has been deleted.`);
                } else {
                    // 방에 남은 사람들에게 상태 업데이트 전송
                    io.to(roomId).emit('roomStateUpdate', getRoomState(room));
                }
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
        
        io.to(roomId).emit('gameStart', getRoomState(room));
        io.emit('roomListUpdate', getRoomList());
    }

    io.on('connection', (socket) => {
        console.log(`[Socket Connect] New connection: ${socket.id}`);

        let registered = false;
        const timeout = setTimeout(() => {
            if (!registered) socket.disconnect(true);
        }, 5000);

        socket.on('registerUser', (username) => {
            console.log(`[서버] registerUser 이벤트: username=${username}, socket.id=${socket.id}`);
            registered = true;
            clearTimeout(timeout);
            socket.data.username = username;
            if (!onlineUsers.has(username)) {
                onlineUsers.set(username, new Set());
            }
            onlineUsers.get(username).add(socket.id);
            emitOnlineUsers();
            socket.emit('roomListUpdate', getRoomList());
            socket.emit('registerUserSuccess');
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
                maxPlayers: 2,
                host: username,
                state: 'waiting' // 'waiting' 또는 'playing'
            };
            gameRooms.set(roomId, newRoom);

            console.log(`[Room Created] User ${username} created room: ${roomName} (${roomId})`);
            
            socket.join(roomId);
            socket.data.roomId = roomId;

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

        socket.on('leaveRoom', () => {
             const roomId = socket.data.roomId;
             const room = gameRooms.get(roomId);
             if (room && room.players.has(socket.id)) {
                 socket.leave(roomId);
                 room.players.delete(socket.id);
                 delete socket.data.roomId;
                 
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
            const allReady = Array.from(room.players.values()).every(p => p.ready);
            if (room.state === 'waiting' && allReady) {
                startRoomGame(roomId);
            }
        });

        socket.on('disconnect', () => {
            handleDisconnect(socket);
        });
    });
}; 