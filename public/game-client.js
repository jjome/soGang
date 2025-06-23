document.addEventListener('DOMContentLoaded', () => {
    const socket = io();

    // --- DOM Elements ---
    const currentUsernameSpan = document.getElementById('currentUsername');
    const onlineUsersList = document.getElementById('online-users');
    const logoutBtn = document.getElementById('logout-btn');
    
    // Views
    const lobbyView = document.getElementById('lobby-view');
    const roomView = document.getElementById('room-view');
    const waitingRoomView = document.getElementById('waiting-room-view');
    const gameInProgressView = document.getElementById('game-in-progress-view');

    // Lobby Elements
    const roomListDiv = document.getElementById('room-list');
    const createRoomBtn = document.getElementById('create-room-btn');
    const roomNameInput = document.getElementById('roomNameInput');
    
    // Room Elements
    const roomTitle = document.getElementById('room-title');
    const playerList = document.getElementById('player-list');
    const leaveRoomBtn = document.getElementById('leave-room-btn');
    const readyBtn = document.getElementById('ready-btn');
    const giveUpBtn = document.getElementById('give-up-btn');
    const gameInfoDiv = document.getElementById('game-info');
    const startGameBtn = document.getElementById('start-game-btn');

    let currentRoomState = null;
    let myUsername = null;

    // --- SPA 뷰 전환 함수 ---
    function showLobby() {
        lobbyView.classList.remove('d-none');
        roomView.classList.add('d-none');
        waitingRoomView.classList.remove('d-none');
        gameInProgressView.classList.add('d-none');
        currentRoomState = null;
    }
    function showRoom(roomState) {
        lobbyView.classList.add('d-none');
        roomView.classList.remove('d-none');
        waitingRoomView.classList.remove('d-none');
        gameInProgressView.classList.add('d-none');
        updateRoomView(roomState);
    }
    function showGame(roomState) {
        lobbyView.classList.add('d-none');
        roomView.classList.remove('d-none');
        waitingRoomView.classList.add('d-none');
        gameInProgressView.classList.remove('d-none');
        updateRoomView(roomState);
    }

    const updateRoomView = (roomState) => {
        currentRoomState = roomState;
        if (!currentRoomState) return;
        roomTitle.textContent = roomState.name;
        playerList.innerHTML = '';
        roomState.players.forEach(player => {
            const playerEl = document.createElement('li');
            playerEl.className = 'list-group-item d-flex justify-content-between align-items-center';
            playerEl.textContent = `${player.username} ${player.username === roomState.host ? '👑' : ''}`;
            const readyBadge = document.createElement('span');
            readyBadge.className = `badge ${player.ready ? 'bg-success' : 'bg-secondary'}`;
            readyBadge.textContent = player.ready ? 'Ready' : 'Not Ready';
            playerEl.appendChild(readyBadge);
            playerList.appendChild(playerEl);
        });
        // 준비 버튼 텍스트
        const myPlayer = roomState.players.find(p => p.username === myUsername);
        if (myPlayer) {
            readyBtn.textContent = myPlayer.ready ? '준비 취소' : '준비';
            readyBtn.classList.toggle('btn-warning', myPlayer.ready);
            readyBtn.classList.toggle('btn-success', !myPlayer.ready);
        }
        // 게임 시작 버튼 노출 및 활성화 조건 (디버깅용 로그 추가)
        console.log('myUsername:', myUsername, 'roomState.host:', roomState.host, 'isHost:', isHost(), 'allReady:', allReady(), 'state:', roomState.state);
        if (isHost() && roomState.state === 'waiting') {
            startGameBtn.classList.remove('d-none');
            startGameBtn.disabled = !allReady();
        } else {
            startGameBtn.classList.add('d-none');
            startGameBtn.disabled = true;
        }
        // 게임 상태에 따라 뷰 전환
        if (roomState.state === 'playing') {
            waitingRoomView.classList.add('d-none');
            gameInProgressView.classList.remove('d-none');
            gameInfoDiv.textContent = `참가자: ${roomState.players.map(p=>p.username).join(', ')}`;
        } else {
            waitingRoomView.classList.remove('d-none');
            gameInProgressView.classList.add('d-none');
        }
    };

    // --- Event Listeners ---
    logoutBtn.addEventListener('click', () => {
        fetch('/logout', { method: 'POST' })
            .then(res => res.json())
            .then(data => { if (data.success) window.location.href = '/login.html'; });
    });

    // 방 만들기 버튼을 처음엔 비활성화
    createRoomBtn.disabled = true;
    let canCreateRoom = false;

    createRoomBtn.addEventListener('click', () => {
        if (!canCreateRoom) return;
        let roomName = roomNameInput.value.trim();
        if (!roomName) {
            roomName = '방' + Math.floor(1000 + Math.random() * 9000);
        }
        socket.emit('createRoom', { roomName });
        roomNameInput.value = '';
    });

    leaveRoomBtn.addEventListener('click', () => {
        socket.emit('leaveRoom');
    });

    readyBtn.addEventListener('click', () => {
        socket.emit('toggleReady');
    });

    giveUpBtn.addEventListener('click', () => {
        if (currentRoomState && confirm('정말로 게임을 포기하시겠습니까?')) {
            socket.emit('giveUpGame', { roomId: currentRoomState.id });
        }
    });

    startGameBtn.addEventListener('click', () => {
        if (currentRoomState && isHost() && allReady()) {
            socket.emit('startRoomGame', { roomId: currentRoomState.id });
        }
    });

    // --- Socket Event Handlers ---
    socket.on('connect', () => {
        console.log('서버에 연결되었습니다.');
        fetch('/api/user').then(res => res.json()).then(data => {
            if (data.username) {
                myUsername = data.username;
                currentUsernameSpan.textContent = data.username;
                socket.emit('registerUser', data.username);
            } else {
                window.location.href = '/login.html';
            }
        });
    });

    socket.on('onlineUsers', (users) => {
        onlineUsersList.innerHTML = '';
        users.forEach(user => {
            const li = document.createElement('li');
            li.className = 'list-group-item';
            li.textContent = user;
            onlineUsersList.appendChild(li);
        });
    });

    socket.on('roomListUpdate', (rooms) => {
        roomListDiv.innerHTML = '';
        if (rooms.length === 0) {
            roomListDiv.textContent = '현재 생성된 방이 없습니다.';
            return;
        }
        rooms.forEach(room => {
            const roomEl = document.createElement('div');
            roomEl.className = 'room-item list-group-item d-flex justify-content-between align-items-center';
            roomEl.innerHTML = `
                <span>${room.name} (${room.playerCount}/${room.maxPlayers})</span>
                <span class="badge ${room.state === 'playing' ? 'bg-danger' : 'bg-success'}">${room.state}</span>
            `;
            if (room.state === 'waiting') {
                const joinBtn = document.createElement('button');
                joinBtn.textContent = '참가';
                joinBtn.className = 'btn btn-sm btn-primary';
                joinBtn.onclick = () => socket.emit('joinRoom', room.id);
                roomEl.appendChild(joinBtn);
            }
            roomListDiv.appendChild(roomEl);
        });
    });

    socket.on('joinRoomSuccess', (roomState) => {
        showRoom(roomState);
    });

    socket.on('roomStateUpdate', (roomState) => {
        if (!myUsername) {
            fetch('/api/user').then(res => res.json()).then(data => {
                if (data.username) {
                    myUsername = data.username;
                    updateRoomView(roomState);
                }
            });
        } else {
            updateRoomView(roomState);
        }
        console.log('roomState:', roomState, 'myUsername:', myUsername);
    });

    socket.on('gameStart', (roomState) => {
        alert('모든 플레이어가 준비를 마쳤습니다. 게임을 시작합니다!');
        showGame(roomState);
    });

    socket.on('leftRoomSuccess', () => {
        showLobby();
    });

    socket.on('gameEndedByGiveUp', ({ reason }) => {
        alert(reason);
        showLobby();
    });

    socket.on('lobbyError', ({ message }) => {
        alert(`오류: ${message}`);
    });

    // 서버에서 registerUser 처리 후 신호를 받으면 방 만들기 버튼 활성화
    socket.on('registerUserSuccess', () => {
        canCreateRoom = true;
        createRoomBtn.disabled = false;
    });

    // --- Init ---
    showLobby();

    function isHost() {
        return currentRoomState && myUsername && currentRoomState.host === myUsername;
    }
    function allReady() {
        return currentRoomState && currentRoomState.players.length > 0 && currentRoomState.players.every(p => p.ready);
    }
}); 