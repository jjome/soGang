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

socket.on('roomJoined', (room) => {
    if (window.handleRoomJoined) {
        window.handleRoomJoined(room);
    } else {
        handleRoomJoined(room);
    }
}); 