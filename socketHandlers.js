const crypto = require('crypto');
const db = require('./database');

const onlineUsers = new Map();
const rooms = new Map();

module.exports = function registerSocketHandlers(io) {
    io.on('connection', (socket) => {

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
                gameState: 'waiting',
            };
            rooms.set(roomId, room);
            socket.join(roomId);

            socket.emit('roomJoined', room);
            io.emit('updateRooms', Array.from(rooms.values()));
        });

        socket.on('joinRoom', ({ roomId }) => {
            const room = rooms.get(roomId);
            if (room && room.players.length < 9) {
                const user = { username: socket.username, id: socket.id, score: 0, ready: false };
                room.players.push(user);
                socket.join(roomId);

                socket.emit('roomJoined', room);
                io.to(roomId).emit('updateRoomState', room);
                io.emit('updateRooms', Array.from(rooms.values()));
            } else {
                socket.emit('lobbyError', { message: '방에 참가할 수 없습니다.' });
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
                    await db.updateUserScore(player.username, player.score);
                    room.gameState = 'waiting';
                    room.players.forEach(p => { p.ready = false; });
                    io.to(roomId).emit('correctGuess', { room, winner: player.username });
                }
            } else {
                io.to(roomId).emit('wrongGuess', { username: socket.username, guess });
            }
        });

        socket.on('disconnect', () => {
            if (socket.username) {
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
}; 