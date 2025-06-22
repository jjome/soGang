const crypto = require('crypto');
const db = require('./database');

const onlineUsers = new Map();
const rooms = new Map();

// 텍사스 홀덤 게임 관련 변수들
const gameRooms = new Map(); // 방별 게임 상태 저장

class TexasHoldemGame {
    constructor(roomId, players) {
        this.roomId = roomId;
        this.players = players.map(player => ({
            ...player,
            cards: [],
            chips: 1000, // 초기 칩
            currentBet: 0,
            folded: false,
            isCurrent: false
        }));
        this.deck = [];
        this.communityCards = [];
        this.pot = 0;
        this.currentPlayerIndex = 0;
        this.currentPlayerId = null; // 현재 플레이어 ID 추적
        this.phase = 'waiting'; // waiting, preflop, flop, turn, river, showdown
        this.smallBlind = 10;
        this.bigBlind = 20;
        this.currentBet = 0;
        this.dealerIndex = 0;
        
        this.initializeDeck();
    }

    initializeDeck() {
        const suits = ['♠', '♥', '♦', '♣'];
        const ranks = ['2', '3', '4', '5', '6', '7', '8', '9', '10', 'J', 'Q', 'K', 'A'];
        
        this.deck = [];
        for (let suit of suits) {
            for (let rank of ranks) {
                this.deck.push({ suit, rank });
            }
        }
    }

    shuffleDeck() {
        for (let i = this.deck.length - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1));
            [this.deck[i], this.deck[j]] = [this.deck[j], this.deck[i]];
        }
    }

    dealCards() {
        this.shuffleDeck();
        
        // 각 플레이어에게 2장씩 카드 분배
        this.players.forEach(player => {
            player.cards = [this.deck.pop(), this.deck.pop()];
        });
    }

    dealCommunityCards(count) {
        for (let i = 0; i < count; i++) {
            this.communityCards.push(this.deck.pop());
        }
    }

    startGame() {
        this.phase = 'preflop';
        this.dealCards();
        this.postBlinds();
        this.updateCurrentPlayer();
        this.broadcastGameState();
    }

    postBlinds() {
        // 스몰 블라인드
        const smallBlindIndex = (this.dealerIndex + 1) % this.players.length;
        this.players[smallBlindIndex].chips -= this.smallBlind;
        this.players[smallBlindIndex].currentBet = this.smallBlind;
        this.pot += this.smallBlind;

        // 빅 블라인드
        const bigBlindIndex = (this.dealerIndex + 2) % this.players.length;
        this.players[bigBlindIndex].chips -= this.bigBlind;
        this.players[bigBlindIndex].currentBet = this.bigBlind;
        this.pot += this.bigBlind;
        
        this.currentBet = this.bigBlind;
        this.currentPlayerIndex = (bigBlindIndex + 1) % this.players.length;
    }

    updateCurrentPlayer() {
        this.players.forEach((player, index) => {
            player.isCurrent = index === this.currentPlayerIndex;
        });
        this.currentPlayerId = this.players[this.currentPlayerIndex]?.id || null;
    }

    nextPhase() {
        switch (this.phase) {
            case 'preflop':
                this.phase = 'flop';
                this.dealCommunityCards(3);
                break;
            case 'flop':
                this.phase = 'turn';
                this.dealCommunityCards(1);
                break;
            case 'turn':
                this.phase = 'river';
                this.dealCommunityCards(1);
                break;
            case 'river':
                this.phase = 'showdown';
                this.showdown();
                return;
        }
        
        this.resetBets();
        this.currentPlayerIndex = (this.dealerIndex + 1) % this.players.length;
        this.updateCurrentPlayer();
    }

    resetBets() {
        this.players.forEach(player => {
            player.currentBet = 0;
        });
        this.currentBet = 0;
    }

    handleAction(playerId, action, amount = 0) {
        const player = this.players.find(p => p.id === playerId);
        if (!player || !player.isCurrent || player.folded) {
            return false;
        }

        switch (action) {
            case 'fold':
                player.folded = true;
                break;
            case 'check':
                if (player.currentBet < this.currentBet) {
                    return false; // 체크할 수 없음
                }
                break;
            case 'call':
                const callAmount = this.currentBet - player.currentBet;
                if (callAmount > player.chips) {
                    return false; // 칩이 부족함
                }
                player.chips -= callAmount;
                player.currentBet = this.currentBet;
                this.pot += callAmount;
                break;
            case 'raise':
                if (amount <= this.currentBet || amount > player.chips) {
                    return false; // 잘못된 베팅 금액
                }
                const raiseAmount = amount - player.currentBet;
                player.chips -= raiseAmount;
                player.currentBet = amount;
                this.pot += raiseAmount;
                this.currentBet = amount;
                break;
        }

        this.nextPlayer();
        return true;
    }

    nextPlayer() {
        do {
            this.currentPlayerIndex = (this.currentPlayerIndex + 1) % this.players.length;
        } while (this.players[this.currentPlayerIndex].folded);

        // 모든 플레이어가 같은 베팅을 했는지 확인
        const activePlayers = this.players.filter(p => !p.folded);
        const allBetsEqual = activePlayers.every(p => p.currentBet === this.currentBet);
        
        if (allBetsEqual) {
            this.nextPhase();
        } else {
            this.updateCurrentPlayer();
        }
        
        this.broadcastGameState();
    }

    showdown() {
        // 간단한 승리 조건: 폴드하지 않은 플레이어 중 첫 번째 플레이어가 승리
        const activePlayers = this.players.filter(p => !p.folded);
        if (activePlayers.length === 1) {
            activePlayers[0].chips += this.pot;
            this.broadcastGameOver(activePlayers[0]);
        } else {
            // 실제로는 핸드 평가 로직이 필요하지만, 여기서는 첫 번째 플레이어가 승리
            activePlayers[0].chips += this.pot;
            this.broadcastGameOver(activePlayers[0]);
        }
    }

    broadcastGameState() {
        const gameState = {
            players: this.players.map(player => ({
                ...player,
                cards: player.cards.map(card => ({ 
                    ...card, 
                    hidden: player.id !== this.currentPlayerId // 현재 플레이어의 카드만 보임
                }))
            })),
            communityCards: this.communityCards,
            pot: this.pot,
            phase: this.phase,
            currentPlayer: this.players[this.currentPlayerIndex]?.username || '-',
            isMyTurn: this.players[this.currentPlayerIndex]?.id === this.currentPlayerId
        };

        io.to(this.roomId).emit('gameState', gameState);
    }

    broadcastGameOver(winner) {
        io.to(this.roomId).emit('gameOver', {
            winner: winner.username,
            pot: this.pot
        });
    }
}

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

        socket.on('leaveRoom', () => {
            handleLeaveRoom(socket);
        });

        socket.on('toggleReady', () => {
            handleToggleReady(socket);
        });

        socket.on('startGame', () => {
            handleGameStart(socket, socket.roomId);
        });

        socket.on('gameAction', (data) => {
            handleGameAction(socket, data);
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
            handleDisconnect(socket);
        });
    });

    // 게임 시작 핸들러
    function handleGameStart(socket, roomId) {
        const room = rooms.get(roomId);
        if (!room) return;

        const readyPlayers = room.players.filter(p => p.ready);
        if (readyPlayers.length < 2) {
            socket.emit('gameMessage', '게임을 시작하려면 최소 2명의 플레이어가 필요합니다.');
            return;
        }

        // 텍사스 홀덤 게임 인스턴스 생성
        const game = new TexasHoldemGame(roomId, readyPlayers);
        gameRooms.set(roomId, game);
        
        // 게임 시작
        game.startGame();
        
        io.to(roomId).emit('gameMessage', '텍사스 홀덤 게임이 시작되었습니다!');
    }

    // 게임 액션 핸들러
    function handleGameAction(socket, data) {
        const { action, amount } = data;
        const roomId = socket.roomId;
        
        if (!roomId) return;
        
        const game = gameRooms.get(roomId);
        if (!game) return;
        
        const playerId = socket.id;
        const success = game.handleAction(playerId, action, amount);
        
        if (!success) {
            socket.emit('gameMessage', '잘못된 액션입니다.');
        }
    }

    // 방 나가기
    function handleLeaveRoom(socket) {
        const roomId = socket.roomId;
        if (!roomId) return;
        
        const room = rooms.get(roomId);
        if (room) {
            socket.leave(roomId);
            room.players = room.players.filter(p => p.id !== socket.id);
            socket.roomId = null;
            
            if (room.players.length === 0) {
                rooms.delete(roomId);
                gameRooms.delete(roomId); // 게임도 종료
            } else {
                io.to(roomId).emit('updateRoomState', room);
            }
            io.emit('updateRooms', Array.from(rooms.values()));
        }
    }

    // 준비 상태 토글
    function handleToggleReady(socket) {
        const roomId = socket.roomId;
        if (!roomId) return;
        
        const room = rooms.get(roomId);
        if (!room) return;
        
        const player = room.players.find(p => p.id === socket.id);
        if (player) {
            player.ready = !player.ready;
            io.to(roomId).emit('updateRoomState', room);
            
            // 모든 플레이어가 준비되었는지 확인
            const allReady = room.players.length >= 2 && room.players.every(p => p.ready);
            if (allReady) {
                io.to(roomId).emit('allPlayersReady');
            }
        }
    }

    // 연결 해제
    function handleDisconnect(socket) {
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
    }
}; 