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

    // Lobby Elements
    const roomListDiv = document.getElementById('room-list');
    const createRoomBtn = document.getElementById('create-room-btn');
    const roomNameInput = document.getElementById('roomNameInput');
    
    // Room Elements
    const roomTitle = document.getElementById('room-title');
    const playerList = document.getElementById('player-list');
    const leaveRoomBtn = document.getElementById('leave-room-btn');
    const readyBtn = document.getElementById('ready-btn');
    const startGameBtn = document.getElementById('start-game-btn');
    
    // Game Settings Elements
    const gameSettings = document.getElementById('game-settings');
    const gameModeRadios = document.querySelectorAll('input[name="gameMode"]');
    const maxPlayersSelect = document.getElementById('max-players');
    const gameModeDisplay = document.getElementById('game-mode');

    let currentRoomState = null;
    let myUsername = null;

    // --- SPA 뷰 전환 함수 ---
    function showLobby() {
        lobbyView.classList.remove('d-none');
        roomView.classList.add('d-none');
        waitingRoomView.classList.remove('d-none');
        currentRoomState = null;
    }
    function showRoom(roomState) {
        console.log('showRoom 호출됨:', roomState);
        console.log('현재 뷰 상태 - lobbyView:', lobbyView.classList.contains('d-none'), 'roomView:', roomView.classList.contains('d-none'));
        
        lobbyView.classList.add('d-none');
        roomView.classList.remove('d-none');
        waitingRoomView.classList.remove('d-none');
        
        console.log('뷰 전환 후 - lobbyView:', lobbyView.classList.contains('d-none'), 'roomView:', roomView.classList.contains('d-none'));
        
        updateRoomView(roomState);
    }
    // showGame 함수 제거 - 게임 시작 시 game.html 페이지로 이동

    const updateRoomView = (roomState) => {
        console.log('updateRoomView 호출됨:', roomState);
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
            const maxPlayers = roomState.maxPlayers || 4;
            playerCount.textContent = `${roomState.players.length}/${maxPlayers}`;
        }
        
        // 게임 모드 표시 업데이트
        if (gameModeDisplay && roomState.gameMode) {
            const modeNames = {
                'beginner': '초급',
                'intermediate': '중급', 
                'advanced': '고급',
                'master': '마스터'
            };
            gameModeDisplay.textContent = modeNames[roomState.gameMode] || '초급';
        }
        
        // 방장인지 확인하여 게임 설정 표시/숨김
        if (isHost()) {
            gameSettings.classList.remove('d-none');
            
            // 현재 설정값 반영
            if (roomState.gameMode) {
                const modeRadio = document.querySelector(`input[name="gameMode"][value="${roomState.gameMode}"]`);
                if (modeRadio) modeRadio.checked = true;
            }
            if (roomState.maxPlayers) {
                maxPlayersSelect.value = roomState.maxPlayers;
            }
        } else {
            gameSettings.classList.add('d-none');
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
        console.log('게임 상태에 따른 뷰 전환 - roomState.state:', roomState.state);
        if (roomState.state === 'playing') {
            // 게임이 시작되면 game.html 페이지로 이동
            console.log('게임 진행 중 - game.html 페이지로 이동');
            if (roomState.id) {
                window.location.href = `/game.html?roomId=${roomState.id}`;
            }
        } else {
            waitingRoomView.classList.remove('d-none');
            console.log('대기방 뷰로 전환');
        }
    };

    // --- Event Listeners ---
    logoutBtn.addEventListener('click', () => {
        fetch('/api/logout', { method: 'POST' })
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
        socket.emit('createRoom', { 
            roomName, 
            maxPlayers: 4,  // 기본 최대 인원
            gameMode: 'beginner'  // 기본 게임 모드
        });
        roomNameInput.value = '';
    });

    leaveRoomBtn.addEventListener('click', () => {
        socket.emit('leaveRoom');
    });

    readyBtn.addEventListener('click', () => {
        socket.emit('toggleReady');
    });



    startGameBtn.addEventListener('click', () => {
        if (currentRoomState && isHost() && allReady()) {
            socket.emit('startRoomGame', { roomId: currentRoomState.id });
        }
    });
    
    // 게임 설정 이벤트 리스너들
    gameModeRadios.forEach(radio => {
        radio.addEventListener('change', (e) => {
            if (currentRoomState && isHost()) {
                socket.emit('updateGameSettings', {
                    roomId: currentRoomState.id,
                    gameMode: e.target.value
                });
            }
        });
    });
    
    maxPlayersSelect.addEventListener('change', (e) => {
        if (currentRoomState && isHost()) {
            socket.emit('updateGameSettings', {
                roomId: currentRoomState.id,
                maxPlayers: parseInt(e.target.value)
            });
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
                joinBtn.onclick = () => socket.emit('joinRoom', { roomId: room.id });
                roomEl.appendChild(joinBtn);
            }
            roomListDiv.appendChild(roomEl);
        });
    });

    socket.on('joinRoomSuccess', (roomState) => {
        showRoom(roomState);
    });

    socket.on('roomCreated', (data) => {
        console.log('방이 생성되었습니다:', data);
        console.log('data.room:', data.room);
        // 방장이 방을 만들면 자동으로 대기방으로 이동
        if (data.room) {
            console.log('showRoom 호출 전');
            showRoom(data.room);
            console.log('showRoom 호출 후');
        } else {
            console.error('data.room이 없습니다:', data);
        }
    });

    socket.on('roomStateUpdate', (roomState) => {
        console.log('roomStateUpdate 이벤트 수신:', roomState);
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
        
        // 게임 상태가 playing이면 game.html 페이지로 이동
        if (roomState.state === 'playing') {
            console.log('게임 상태가 playing으로 변경됨, game.html 페이지로 이동');
            if (roomState.id) {
                window.location.href = `/game.html?roomId=${roomState.id}`;
            }
        }
    });

    socket.on('gameStart', (roomState) => {
        console.log('게임 시작:', roomState);
        // 게임 페이지로 이동
        window.location.href = `/game.html?roomId=${roomState.id}`;
    });

    socket.on('gameStarted', (data) => {
        console.log('게임이 시작되었습니다:', data);
        
        // 게임이 시작되면 game.html 페이지로 이동
        if (currentRoomState && currentRoomState.id) {
            console.log('게임 시작됨 - game.html 페이지로 이동');
            window.location.href = `/game.html?roomId=${currentRoomState.id}`;
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

    socket.on('gameSettingsUpdated', (data) => {
        console.log('게임 설정이 업데이트됨:', data);
        // 알람창 제거 - 설정 변경은 roomStateUpdate 이벤트로 자동 반영됨
    });

    socket.on('lobbyError', (data) => {
        const errorMessage = data.userMessage || data.message || '알 수 없는 오류가 발생했습니다.';
        const errorType = data.type || 'UNKNOWN';

        // 에러 타입별 아이콘 추가
        let icon = '⚠️';
        if (errorType === 'VALIDATION') icon = '⚠️';
        else if (errorType === 'PERMISSION') icon = '🚫';
        else if (errorType === 'STATE') icon = '❌';
        else if (errorType === 'NETWORK') icon = '🔄';

        alert(`${icon} ${errorMessage}`);
        console.error(`[Lobby Error - ${errorType}]`, data);
    });

    // 세션 대체 이벤트 (다른 브라우저/탭에서 접속 시)
    socket.on('sessionReplaced', (data) => {
        console.warn('[Session Replaced]', data);
        alert('다른 기기에서 로그인이 감지되었습니다.');
        // 로그인 페이지로 리다이렉트
        window.location.href = '/login.html';
    });

    // 방 폭파 알림
    socket.on('roomDestroyed', (data) => {
        console.log('[Room Destroyed]', data);
        alert(`💥 ${data.message}`);
    });

    // 서버에서 registerUser 처리 후 신호를 받으면 방 만들기 버튼 활성화
    socket.on('registerUserSuccess', (data) => {
        console.log('[Register Success]', data);
        canCreateRoom = true;
        createRoomBtn.disabled = false;
        
        // 기존 게임 방이 있는 경우 게임 페이지로 리다이렉트
        if (data.redirectToGame && data.roomId) {
            console.log(`[Auto Redirect] 기존 게임 방으로 이동: ${data.roomId}`);
            alert(`진행 중인 게임이 있어 게임으로 돌아갑니다.`);
            
            // 게임 페이지로 이동
            window.location.href = `/game.html?roomId=${data.roomId}`;
        }
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