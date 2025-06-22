let socket;
let currentUsername = '';
let currentRoomId = null;

// --- DOM Elements ---
const lobbyContainer = document.getElementById('lobbyContainer');
const roomContainer = document.getElementById('roomContainer');
const onlineUsersList = document.getElementById('onlineUsersList');
const roomList = document.getElementById('roomList');
const roomTitle = document.getElementById('roomTitle');
const playersList = document.getElementById('playersList');
const readyBtn = document.getElementById('readyBtn');
const gameInfo = document.getElementById('gameInfo');
const gameMessages = document.getElementById('gameMessages');
const roomNameInput = document.getElementById('roomNameInput');
const currentUsernameSpan = document.getElementById('currentUsername');

// --- Initialization ---
window.addEventListener('load', async () => {
    try {
        const response = await fetch('/api/user');
        if (!response.ok) throw new Error('로그인이 필요합니다.');
        const data = await response.json();
        currentUsername = data.username;
        currentUsernameSpan.textContent = `👋 ${currentUsername}`;
        
        socket = io();
        setupSocketListeners();
        socket.emit('userLoggedIn', currentUsername);
    } catch (error) {
        window.location.href = '/';
    }
});

// --- UI Control ---
const showView = (view) => {
    lobbyContainer.classList.toggle('hidden', view !== 'lobby');
    roomContainer.classList.toggle('hidden', view !== 'room');
};

// --- Socket Listeners ---
function setupSocketListeners() {
    socket.on('updateOnlineUsers', renderOnlineUsers);
    socket.on('updateRooms', renderRooms);
    socket.on('roomJoined', handleRoomJoined);
    socket.on('updateRoomState', renderRoom);
    socket.on('gameStart', handleGameStart);
    socket.on('correctGuess', handleCorrectGuess);
    socket.on('wrongGuess', ({ username, guess }) => addMessage(`${username}님의 추측: ${guess}`, 'warning'));
    socket.on('lobbyError', ({ message }) => alert(message));
}

// --- Rendering Functions ---
function renderOnlineUsers(users) {
    onlineUsersList.innerHTML = users.map(user => `<li>${user}</li>`).join('');
}

function renderRooms(rooms) {
    if (rooms.length === 0) {
        roomList.innerHTML = '<p>현재 참가 가능한 방이 없습니다.</p>';
        return;
    }
    roomList.innerHTML = rooms.map(room => {
        const playerNames = room.players.map(p => p.username).join(', ');
        return `
            <div class="room-card">
                <h3>${room.name}</h3>
                <p>참가자: ${room.players.length} / 9</p>
                <p style="font-size: 0.9rem; color: #666; margin-bottom: 1rem;">
                    ${playerNames || '참가자 없음'}
                </p>
                <button class="btn btn-join" onclick="joinRoom('${room.id}')">참가</button>
            </div>
        `;
    }).join('');
}

function renderRoom(room) {
    roomTitle.textContent = room.name;
    playersList.innerHTML = room.players.map(p => `
        <div class="player-card ${p.ready ? 'ready' : ''}">
            <span>${p.username} (점수: ${p.score})</span>
            <span>${p.ready ? '✅' : '⏳'}</span>
        </div>
    `).join('');

    const me = room.players.find(p => p.username === currentUsername);
    if (me) {
        readyBtn.textContent = me.ready ? '준비 취소' : '준비';
        readyBtn.style.backgroundColor = me.ready ? '#ffc107' : '#28a745';
        readyBtn.style.color = me.ready ? '#333' : 'white';
    }

    if (room.gameState === 'waiting') {
        gameInfo.innerHTML = `<p>모든 플레이어가 준비하면 게임이 시작됩니다.</p>`;
    }
}

function addMessage(text, type = 'info') {
    const typeClass = { info: '', success: 'bg-green-100', warning: 'bg-yellow-100'}[type];
    gameMessages.innerHTML += `<div class="message ${typeClass}">${text}</div>`;
    gameMessages.scrollTop = gameMessages.scrollHeight;
}

// --- Socket Event Handlers ---
function handleRoomJoined(room) {
    currentRoomId = room.id;
    renderRoom(room);
    showView('room');
}

function handleGameStart(room) {
    renderRoom(room);
    addMessage('게임 시작! 1-100 사이의 숫자를 맞추세요.', 'success');
    gameInfo.innerHTML = `
        <p>1-100 사이의 숫자를 추측하세요.</p>
        <input type="number" id="guessInput" style="padding: 0.5rem; width: 100px; margin-right: 0.5rem;">
        <button class="btn" onclick="makeGuess()">추측</button>
    `;
}

function handleCorrectGuess({ room, winner }) {
    addMessage(`${winner}님이 정답을 맞췄습니다!`, 'success');
    renderRoom(room);
}

// --- User Actions ---
window.createRoom = () => {
    let name = roomNameInput.value.trim();
    if (!name) {
        // 기본 방 이름: '방-랜덤숫자'
        name = `방-${Math.floor(1000 + Math.random() * 9000)}`;
    }
    socket.emit('createRoom', { roomName: name });
    roomNameInput.value = '';
};

window.joinRoom = (roomId) => socket.emit('joinRoom', { roomId });

window.leaveRoom = () => {
    if (!currentRoomId) return;
    socket.emit('leaveRoom', { roomId: currentRoomId });
    currentRoomId = null;
    gameMessages.innerHTML = '';
    showView('lobby');
};

window.makeGuess = () => {
    const guessInput = document.getElementById('guessInput');
    const guess = parseInt(guessInput.value);
    if (!isNaN(guess)) socket.emit('makeGuess', { roomId: currentRoomId, guess });
    guessInput.value = '';
};

readyBtn.addEventListener('click', () => {
    if (currentRoomId) socket.emit('ready', { roomId: currentRoomId });
});

window.logout = async () => {
    await fetch('/logout', { method: 'POST' });
    window.location.href = '/';
}; 