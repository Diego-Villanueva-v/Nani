document.addEventListener('userReady', () => {
    const socket = io('https://tu-proyecto-railway.up.railway.app'); // RECUERDA PONER TU URL AQUÍ

    const chatMessages = document.getElementById('chatMessages');
    const roomSelect = document.getElementById('roomSelect');
    const roomTitle = document.getElementById('roomTitle');
    const messageInput = document.getElementById('messageInput');
    const roomUsers = document.getElementById('roomUsers');
    const globalUsers = document.getElementById('globalUsers');
    
    let currentRoom = 'General';
    
    // --- PERFIL Y FONDOS ---
    let userColor = localStorage.getItem('chatUserColor') || '#0084ff';
    let userAvatar = localStorage.getItem('chatUserAvatar') || 'https://cdn-icons-png.flaticon.com/512/149/149071.png';
    let chatBg = localStorage.getItem('chatBgLocal') || '';
    
    if (chatBg) chatMessages.style.backgroundImage = `url(${chatBg})`;
    document.getElementById('avatarPreview').src = userAvatar;

    // Compresor de imágenes genérico
    const compressImage = (file, maxWidth, quality, callback) => {
        const reader = new FileReader();
        reader.readAsDataURL(file);
        reader.onload = (e) => {
            const img = new Image();
            img.src = e.target.result;
            img.onload = () => {
                const canvas = document.createElement('canvas');
                const scale = Math.min(maxWidth / img.width, 1);
                canvas.width = img.width * scale;
                canvas.height = img.height * scale;
                const ctx = canvas.getContext('2d');
                ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
                callback(canvas.toDataURL('image/jpeg', quality));
            };
        };
    };

    // Modal de configuración
    document.getElementById('configBtn').addEventListener('click', () => {
        document.getElementById('colorPicker').value = userColor;
        document.getElementById('configModal').style.display = 'flex';
    });

    document.getElementById('closeConfigBtn').addEventListener('click', () => {
        document.getElementById('configModal').style.display = 'none';
    });

    // Vista previa de Avatar
    document.getElementById('avatarInput').addEventListener('change', (e) => {
        if(e.target.files[0]) compressImage(e.target.files[0], 150, 0.7, (b64) => {
            document.getElementById('avatarPreview').src = b64;
            userAvatar = b64;
        });
    });

    // Vista previa de Fondo
    document.getElementById('bgLocalInput').addEventListener('change', (e) => {
        if(e.target.files[0]) compressImage(e.target.files[0], 800, 0.5, (b64) => {
            chatBg = b64;
        });
    });

    document.getElementById('saveConfigBtn').addEventListener('click', () => {
        userColor = document.getElementById('colorPicker').value;
        localStorage.setItem('chatUserColor', userColor);
        localStorage.setItem('chatUserAvatar', userAvatar);
        localStorage.setItem('chatBgLocal', chatBg);
        
        chatMessages.style.backgroundImage = chatBg ? `url(${chatBg})` : 'none';
        chatMessages.style.backgroundSize = 'cover';
        chatMessages.style.backgroundPosition = 'center';
        
        socket.emit('joinRoom', { username: window.currentUsername, room: currentRoom, color: userColor, avatar: userAvatar });
        document.getElementById('configModal').style.display = 'none';
    });

    // --- CONEXIÓN ---
    socket.emit('joinRoom', { username: window.currentUsername, room: currentRoom, color: userColor, avatar: userAvatar });

    // --- CHAT PRIVADO (DMs) ---
    window.openDM = (targetUser) => {
        if (targetUser === window.currentUsername) return; // No hablar contigo mismo
        // Crear un nombre de sala único basado en orden alfabético para que ambos entren a la misma
        const dmRoom = [window.currentUsername, targetUser].sort().join('_');
        currentRoom = dmRoom;
        roomTitle.innerHTML = `<i class="fas fa-lock"></i> Chat Privado: ${targetUser}`;
        chatMessages.innerHTML = ''; 
        socket.emit('joinRoom', { username: window.currentUsername, room: currentRoom, color: userColor, avatar: userAvatar });
    };

    // --- SALAS PÚBLICAS ---
    socket.on('updateRooms', (rooms) => {
        roomSelect.innerHTML = '';
        rooms.forEach(room => {
            if(!room.includes('_')) { // Filtrar salas privadas
                const option = document.createElement('option');
                option.value = room;
                option.textContent = room;
                if(room === currentRoom) option.selected = true;
                roomSelect.appendChild(option);
            }
        });
    });

    document.getElementById('joinRoomBtn').addEventListener('click', () => {
        currentRoom = roomSelect.value;
        roomTitle.textContent = `Sala: ${currentRoom}`;
        chatMessages.innerHTML = ''; 
        socket.emit('joinRoom', { username: window.currentUsername, room: currentRoom, color: userColor, avatar: userAvatar });
    });

    // --- LISTA DE USUARIOS ---
    socket.on('updateUserList', (users) => {
        roomUsers.innerHTML = users.map(u => `
            <li style="display:flex; align-items:center; margin-bottom:8px;">
                <img src="${u.avatar}" style="width:25px; height:25px; border-radius:50%; margin-right:8px; object-fit:cover;">
                <span style="color:${u.color}; font-weight:bold;">${u.username}</span>
            </li>`).join('');
    });

    socket.on('updateGlobalUsers', (users) => {
        globalUsers.innerHTML = users.map(u => `
            <li onclick="openDM('${u.username}')" style="cursor:pointer; display:flex; align-items:center; margin-bottom:8px; padding:5px; border-radius:5px; transition:0.2s;" onmouseover="this.style.background='#e4e6eb'" onmouseout="this.style.background='transparent'" title="Enviar mensaje privado">
                <img src="${u.avatar}" style="width:30px; height:30px; border-radius:50%; margin-right:8px; border:2px solid #28a745; object-fit:cover;">
                <span><b>${u.username}</b> <br><small style="color:#888;">${u.room.includes('_') ? 'En Privado' : u.room}</small></span>
            </li>`).join('');
    });

    // --- ENVÍO DE MENSAJES (Texto e Imágenes) ---
    document.getElementById('chatForm').addEventListener('submit', (e) => {
        e.preventDefault();
        const msg = document.getElementById('messageInput').value.trim();
        if (!msg) return;

        socket.emit('chatMessage', {
            username: window.currentUsername, text: msg, room: currentRoom, color: userColor, avatar: userAvatar, time: new Date().toLocaleTimeString()
        });

        document.getElementById('messageInput').value = '';
    });

    document.getElementById('fileInput').addEventListener('change', (e) => {
        if(e.target.files[0]) compressImage(e.target.files[0], 500, 0.6, (b64) => {
            socket.emit('chatMessage', { username: window.currentUsername, text: b64, room: currentRoom, color: userColor, avatar: userAvatar, type: 'image', time: new Date().toLocaleTimeString() });
        });
    });

    // --- RECIBIR MENSAJES ---
    socket.on('message', (message) => {
        const div = document.createElement('div');
        const isMe = message.username === window.currentUsername;
        div.className = `message ${isMe ? 'my-message' : ''}`;
        
        const nameColor = isMe ? '#bfe0ff' : (message.color || '#8d949e');

        let content = message.type === 'image' 
            ? `<img src="${message.text}" style="max-width: 100%; border-radius: 8px; margin-top: 5px;">` 
            : `<p class="text">${message.text}</p>`;

        div.innerHTML = `
            <div style="display:flex; align-items:center; gap:8px; margin-bottom:5px;">
                <img src="${message.avatar}" style="width:20px; height:20px; border-radius:50%; object-fit:cover;">
                <p class="meta" style="color: ${nameColor}; font-weight: bold; margin:0;">
                    ${message.username} <span style="font-size: 0.8em; font-weight: normal; color: #aaa;">${message.time}</span>
                </p>
            </div>
            ${content}
        `;
        chatMessages.appendChild(div);
        chatMessages.scrollTop = chatMessages.scrollHeight;
    });
});