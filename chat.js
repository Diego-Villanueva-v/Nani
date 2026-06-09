document.addEventListener('userReady', () => {
    // IMPORTANTE: Asegúrate de que el puerto sea el que corre en tu terminal (8000)
    const socket = io('https://tu-url-de-railway-aqui.up.railway.app');
    
    const chatForm = document.getElementById('chatForm');
    const messageInput = document.getElementById('messageInput');
    const chatMessages = document.getElementById('chatMessages');
    const roomSelect = document.getElementById('roomSelect');
    const joinRoomBtn = document.getElementById('joinRoomBtn');
    const createRoomBtn = document.getElementById('createRoomBtn');
    const deleteRoomBtn = document.getElementById('deleteRoomBtn');
    const newRoomInput = document.getElementById('newRoomInput');
    const roomTitle = document.getElementById('roomTitle');
    const searchInput = document.getElementById('searchInput');
    const emojiBtn = document.getElementById('emojiBtn');
    const emojiPicker = document.getElementById('emojiPicker');
    const notificationSound = document.getElementById('notificationSound');
    const fileInput = document.getElementById('fileInput');

    // SOLUCIÓN: Forzar actualización del nombre de usuario en pantalla
    document.getElementById('currentUserDisplay').textContent = 'Usuario: ' + window.currentUsername;

    let currentRoom = 'General';
    let messageHistory = JSON.parse(localStorage.getItem('chatHistory')) || [];

    // SOLUCIÓN: Limpiar los mensajes duplicados del sistema del historial antiguo
    messageHistory = messageHistory.filter(m => m.username !== 'Sistema');
    localStorage.setItem('chatHistory', JSON.stringify(messageHistory));

    socket.emit('joinRoom', { username: window.currentUsername, room: currentRoom });
    loadHistory(currentRoom);

    socket.on('updateRooms', (rooms) => {
        roomSelect.innerHTML = ''; 
        rooms.forEach(room => {
            const option = document.createElement('option');
            option.value = room;
            option.textContent = room;
            if(room === currentRoom) option.selected = true;
            roomSelect.appendChild(option);
        });
    });

    joinRoomBtn.addEventListener('click', () => {
        currentRoom = roomSelect.value;
        roomTitle.textContent = `Sala: ${currentRoom}`;
        chatMessages.innerHTML = ''; 
        socket.emit('joinRoom', { username: window.currentUsername, room: currentRoom });
        loadHistory(currentRoom);
    });

    createRoomBtn.addEventListener('click', () => {
        const newRoom = newRoomInput.value.trim();
        if(newRoom) {
            socket.emit('createRoom', newRoom);
            newRoomInput.value = '';
            setTimeout(() => {
                roomSelect.value = newRoom;
                joinRoomBtn.click();
            }, 300);
        }
    });

    deleteRoomBtn.addEventListener('click', () => {
        const roomToDelete = roomSelect.value;
        if(roomToDelete === 'General') {
            alert('La sala General no puede ser eliminada.');
            return;
        }
        if(confirm(`¿Estás seguro de que quieres eliminar la sala "${roomToDelete}" para todos los usuarios?`)) {
            socket.emit('deleteRoom', roomToDelete);
            roomSelect.value = 'General';
            joinRoomBtn.click();
        }
    });

    chatForm.addEventListener('submit', (e) => {
        e.preventDefault();
        const msg = messageInput.value.trim();
        if (!msg) return;

        socket.emit('chatMessage', {
            username: window.currentUsername,
            text: msg,
            room: currentRoom
        });

        messageInput.value = '';
        messageInput.focus();
        emojiPicker.style.display = 'none'; // Ocultar emojis al enviar
    });

    // Lógica del menú de emojis
    emojiBtn.addEventListener('click', () => {
        emojiPicker.style.display = emojiPicker.style.display === 'none' ? 'grid' : 'none';
    });

    document.querySelectorAll('.emoji-item').forEach(item => {
        item.addEventListener('click', (e) => {
            messageInput.value += e.target.textContent;
            messageInput.focus();
        });
    });

    fileInput.addEventListener('change', (e) => {
        const file = e.target.files[0];
        if(file) {
            const reader = new FileReader();
            reader.onload = function(evt) {
                socket.emit('chatMessage', {
                    username: window.currentUsername,
                    text: evt.target.result,
                    room: currentRoom,
                    type: 'image'
                });
            };
            reader.readAsDataURL(file);
        }
    });

    socket.on('message', (message) => {
        outputMessage(message);
        saveToHistory(message, currentRoom);
        chatMessages.scrollTop = chatMessages.scrollHeight;

        if(message.username !== window.currentUsername && message.username !== 'Sistema') {
            notificationSound.play().catch(e => console.log('Sonido bloqueado'));
        }
    });

    function outputMessage(message) {
        const div = document.createElement('div');
        div.classList.add('message');
        if (message.username === window.currentUsername) {
            div.classList.add('my-message');
        }

        let content = '';
        if (message.type === 'image') {
            content = `<img src="${message.text}" style="max-width: 200px; border-radius: 8px;">`;
        } else {
            content = `<p class="text">${message.text}</p>`;
        }

        div.innerHTML = `
            <p class="meta">${message.username} <span>${message.time}</span></p>
            ${content}
        `;
        chatMessages.appendChild(div);
    }

    function saveToHistory(message, room) {
        // SOLUCIÓN: Evitar guardar mensajes del sistema
        if (message.username === 'Sistema') return;
        
        message.room = room;
        messageHistory.push(message);
        localStorage.setItem('chatHistory', JSON.stringify(messageHistory));
    }

    function loadHistory(room) {
        chatMessages.innerHTML = '';
        const roomHistory = messageHistory.filter(m => m.room === room);
        roomHistory.forEach(msg => outputMessage(msg));
        chatMessages.scrollTop = chatMessages.scrollHeight;
    }

    searchInput.addEventListener('input', (e) => {
        const term = e.target.value.toLowerCase();
        const messages = chatMessages.querySelectorAll('.message');
        
        messages.forEach(msg => {
            const text = msg.querySelector('.text')?.innerText.toLowerCase() || '';
            if (text.includes(term)) {
                msg.style.display = 'block';
            } else {
                msg.style.display = 'none';
            }
        });
    });
});