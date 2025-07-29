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
        
        // 게임 진행 중 뷰에 게임 컨트롤 추가
        gameInProgressView.innerHTML = `
            <div class="game-container">
                <div class="game-header">
                    <h1 class="game-title">소 갱</h1>
                    <div class="game-phase" id="game-phase">PRE FLIP</div>
                    <button id="exit-game-btn-header" class="exit-game-btn">게임 나가기</button>
                </div>
                
                <div class="game-info">
                    <div class="room-info">
                        <div>방: <span id="roomName">${roomState.name}</span></div>
                        <div>방장: <span id="roomHost">${roomState.host}</span></div>
                        <div>플레이어 수: <span id="playerCount">${roomState.players.length}</span></div>
                    </div>
                    <div class="game-message" id="game-message">소 갱 게임이 시작되었습니다!</div>
                </div>
                
                <div class="players-container" id="players-container">
                    <!-- 플레이어들이 여기에 표시됩니다 -->
                </div>
                
                <div class="game-controls">
                    <button id="flip-cards-btn" class="btn btn-warning btn-lg">카드 뒤집기</button>
                    <button id="next-round-btn" class="btn btn-success btn-lg" style="display: none;">다음 라운드</button>
                </div>
            </div>
        `;
        
        // 게임 컨트롤 이벤트 리스너 추가
        const exitGameBtn = document.getElementById('exit-game-btn-header');
        if (exitGameBtn) {
            exitGameBtn.addEventListener('click', () => {
                if (confirm('정말로 게임을 나가시겠습니까?')) {
                    socket.emit('leaveRoom');
                }
            });
        }
        
        updateRoomView(roomState);
    }

    const updateRoomView = (roomState) => {
        currentRoomState = roomState;
        if (!currentRoomState) return;
        
        roomTitle.textContent = roomState.name;
        
        // 방 상태 정보 업데이트
        const roomStatus = document.getElementById('room-status');
        const playerCount = document.getElementById('player-count');
        
        if (roomStatus) {
            roomStatus.textContent = roomState.state === 'waiting' ? '대기 중' : '게임 중';
        }
        
        if (playerCount) {
            playerCount.textContent = `${roomState.players.length}/2`;
        }
        
        // 플레이어 목록 업데이트
        playerList.innerHTML = '';
        roomState.players.forEach(player => {
            const playerCard = document.createElement('div');
            playerCard.className = 'player-card';
            
            // 플레이어 상태에 따른 클래스 추가
            if (player.ready) {
                playerCard.classList.add('ready');
            }
            if (player.username === roomState.host) {
                playerCard.classList.add('host');
            }
            
            playerCard.innerHTML = `
                <div class="player-header">
                    <div class="player-name">
                        ${player.username}
                        ${player.username === roomState.host ? '<span class="host-badge">방장</span>' : ''}
                    </div>
                    <span class="${player.ready ? 'ready-badge' : 'not-ready-badge'}">
                        ${player.ready ? '준비 완료' : '준비 안됨'}
                    </span>
                </div>
                <div class="player-status">
                    <div class="status-icon ${player.ready ? 'ready' : 'not-ready'}"></div>
                    <span>${player.ready ? '게임 준비 완료' : '게임 준비 중'}</span>
                </div>
            `;
            
            playerList.appendChild(playerCard);
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
            const canStart = allReady();
            startGameBtn.disabled = !canStart;
            
            // 버튼 텍스트 업데이트
            if (roomState.players.length < 2) {
                startGameBtn.textContent = `최소 2명 필요 (현재 ${roomState.players.length}명)`;
            } else if (!canStart) {
                startGameBtn.textContent = '모든 플레이어가 준비되어야 합니다';
            } else {
                startGameBtn.textContent = '게임 시작';
            }
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
        console.log('게임 시작:', roomState);
        // 게임 페이지로 이동
        window.location.href = `/game.html?roomId=${roomState.id}`;
    });

    socket.on('gameStarted', (data) => {
        console.log('게임이 시작되었습니다:', data);
        
        // 게임 페이지로 이동
        if (data.room && data.room.id) {
            window.location.href = `/game.html?roomId=${data.room.id}`;
        }
    });

    socket.on('redirectToGame', (data) => {
        console.log('게임 페이지로 이동:', data);
        
        // 게임 페이지로 이동
        if (data.roomId) {
            window.location.href = `/game.html?roomId=${data.roomId}`;
        }
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
        return currentRoomState && 
               currentRoomState.players.length >= 2 && 
               currentRoomState.players.every(p => p.ready);
    }
}); 