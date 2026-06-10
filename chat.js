document.addEventListener('userReady', () => {
    // URL servidor Railway
    const socket = io('https://chat-project-production-b900.up.railway.app'); 

    const chatMessages = document.getElementById('chatMessages');
    const messageInput = document.getElementById('messageInput');
    const roomTitle = document.getElementById('roomTitle');
    const roomSelect = document.getElementById('roomSelect');
    
    let currentRoom = 'General';
    let replyingTo = null; 
    let isRecording = false;
    let mediaRecorder;
    let audioChunks = [];

    // --- CARGAR PERFIL ---
    let userColor = localStorage.getItem('chatUserColor') || '#2f81f7';
    let userAvatar = localStorage.getItem('chatUserAvatar') || 'https://cdn-icons-png.flaticon.com/512/149/149071.png';
    let chatBg = localStorage.getItem('chatBgLocal') || '';
    
    document.getElementById('myMiniAvatar').src = userAvatar;
    document.getElementById('avatarPreview').src = userAvatar;
    if (chatBg) chatMessages.style.backgroundImage = `url(${chatBg})`;

    // Compresor de Imágenes Universal
    const compressImage = (file, maxWidth, callback) => {
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
                callback(canvas.toDataURL('image/jpeg', 0.8));
            };
        };
    };

    // --- MODAL Y CONFIGURACIÓN ---
    document.getElementById('configBtn').addEventListener('click', () => {
        document.getElementById('colorPicker').value = userColor;
        document.getElementById('configModal').classList.add('active');
    });

    document.getElementById('closeConfigBtn').addEventListener('click', () => {
        document.getElementById('configModal').classList.remove('active');
    });

    document.getElementById('avatarInput').addEventListener('change', (e) => {
        if(e.target.files[0]) compressImage(e.target.files[0], 250, (b64) => {
            document.getElementById('avatarPreview').src = b64;
            userAvatar = b64;
        });
    });

    document.getElementById('bgLocalInput').addEventListener('change', (e) => {
        if(e.target.files[0]) compressImage(e.target.files[0], 1200, (b64) => chatBg = b64);
    });

    document.getElementById('saveConfigBtn').addEventListener('click', () => {
        userColor = document.getElementById('colorPicker').value;
        localStorage.setItem('chatUserColor', userColor);
        localStorage.setItem('chatUserAvatar', userAvatar);
        localStorage.setItem('chatBgLocal', chatBg);
        
        document.getElementById('myMiniAvatar').src = userAvatar;
        chatMessages.style.backgroundImage = chatBg ? `url(${chatBg})` : 'none';
        
        socket.emit('joinRoom', { username: window.currentUsername, room: currentRoom, color: userColor, avatar: userAvatar });
        document.getElementById('configModal').classList.remove('active');
    });

    // --- PORTAPAPELES (CTRL+V) ---
    document.addEventListener('paste', (e) => {
        const items = e.clipboardData.items;
        for (let i = 0; i < items.length; i++) {
            if (items[i].type.indexOf('image') !== -1) {
                const blob = items[i].getAsFile();
                compressImage(blob, 800, (b64) => {
                    enviarMensaje(b64, 'image');
                });
            }
        }
    });

    // --- MENSAJES GUARDADOS ---
    document.getElementById('savedMessagesBtn').addEventListener('click', () => {
        currentRoom = `${window.currentUsername}_saved`;
        roomTitle.innerHTML = `<i class="fas fa-bookmark" style="color:var(--accent);"></i> Mis Mensajes Guardados`;
        chatMessages.innerHTML = '';
        socket.emit('joinRoom', { username: window.currentUsername, room: currentRoom, color: userColor, avatar: userAvatar });
    });

    // --- RESPONDER MENSAJES ---
    window.setReply = (username, text) => {
        replyingTo = { username, text };
        document.getElementById('replyName').textContent = username;
        document.getElementById('replyText').textContent = text.startsWith('data:image') || text.startsWith('http') ? '📷 Imagen / GIF' : text;
        document.getElementById('replyPreview').classList.add('active');
        messageInput.focus();
    };

    document.getElementById('cancelReplyBtn').addEventListener('click', () => {
        replyingTo = null;
        document.getElementById('replyPreview').classList.remove('active');
    });

    // --- BUSCADOR DE GIFS ---
    document.getElementById('gifBtn').addEventListener('click', () => {
        document.getElementById('gifPicker').classList.toggle('active');
        document.getElementById('emojiPicker').classList.remove('active');
    });

    document.getElementById('gifSearch').addEventListener('keypress', async (e) => {
        if(e.key === 'Enter') {
            e.preventDefault();
            const term = e.target.value;
            // API Demo de Giphy
            const res = await fetch(`https://api.giphy.com/v1/gifs/search?api_key=dc6zaTOxFJmzC&q=${term}&limit=8`);
            const data = await res.json();
            const results = document.getElementById('gifResults');
            results.innerHTML = '';
            data.data.forEach(gif => {
                const img = document.createElement('img');
                img.src = gif.images.fixed_height_small.url;
                img.onclick = () => {
                    enviarMensaje(gif.images.fixed_height.url, 'image');
                    document.getElementById('gifPicker').classList.remove('active');
                };
                results.appendChild(img);
            });
        }
    });

    // --- CONEXIÓN Y SALAS ---
    socket.emit('joinRoom', { username: window.currentUsername, room: currentRoom, color: userColor, avatar: userAvatar });

    window.openDM = (targetUser) => {
        if (targetUser === window.currentUsername) return;
        currentRoom = [window.currentUsername, targetUser].sort().join('_');
        roomTitle.innerHTML = `<i class="fas fa-lock" style="color:var(--accent);"></i> Chat Privado: ${targetUser}`;
        chatMessages.innerHTML = ''; 
        socket.emit('joinRoom', { username: window.currentUsername, room: currentRoom, color: userColor, avatar: userAvatar });
    };

    socket.on('updateRooms', (rooms) => {
        roomSelect.innerHTML = '';
        rooms.forEach(room => {
            if(!room.includes('_')) { 
                const option = document.createElement('option');
                option.value = room; option.textContent = room;
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

    document.getElementById('createRoomBtn').addEventListener('click', () => {
        const newRoom = document.getElementById('newRoomInput').value.trim();
        if(newRoom) {
            socket.emit('createRoom', newRoom);
            document.getElementById('newRoomInput').value = '';
            setTimeout(() => { roomSelect.value = newRoom; document.getElementById('joinRoomBtn').click(); }, 300);
        }
    });

    // --- LISTAS DE USUARIOS ---
    socket.on('updateUserList', (users) => {
        document.getElementById('roomUsers').innerHTML = users.map(u => `
            <li><img src="${u.avatar}"> <span style="color:${u.color}; font-weight:600;">${u.username}</span></li>
        `).join('');
    });

    socket.on('updateGlobalUsers', (users) => {
        document.getElementById('globalUsers').innerHTML = users.map(u => `
            <li onclick="openDM('${u.username}')" class="global-user">
                <div class="status-dot"></div>
                <img src="${u.avatar}">
                <div>
                    <b style="color: #fff;">${u.username}</b> <br>
                    <small style="color: var(--text-muted);">${u.room.includes('_') ? 'En Privado' : u.room}</small>
                </div>
            </li>
        `).join('');
    });

    // --- ENVIAR MENSAJES ---
    const enviarMensaje = (texto, tipo = 'text') => {
        if (!texto) return;
        socket.emit('chatMessage', {
            username: window.currentUsername,
            text: texto,
            type: tipo,
            room: currentRoom,
            color: userColor,
            avatar: userAvatar,
            reply: replyingTo,
            time: new Date().toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})
        });
        document.getElementById('cancelReplyBtn').click(); 
    };

    document.getElementById('chatForm').addEventListener('submit', (e) => {
        e.preventDefault();
        enviarMensaje(messageInput.value.trim(), 'text');
        messageInput.value = '';
    });

    document.getElementById('fileInput').addEventListener('change', (e) => {
        if(e.target.files[0]) compressImage(e.target.files[0], 800, (b64) => enviarMensaje(b64, 'image'));
    });

    // --- GRABADORA DE AUDIO ---
    const voiceBtn = document.getElementById('voiceBtn');
    voiceBtn.addEventListener('click', async () => {
        if (!isRecording) {
            try {
                const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
                mediaRecorder = new MediaRecorder(stream);
                audioChunks = [];
                mediaRecorder.ondataavailable = e => audioChunks.push(e.data);
                mediaRecorder.onstop = () => {
                    const audioBlob = new Blob(audioChunks, { type: 'audio/webm' });
                    const reader = new FileReader();
                    reader.readAsDataURL(audioBlob);
                    reader.onloadend = () => enviarMensaje(reader.result, 'audio');
                };
                mediaRecorder.start();
                isRecording = true;
                voiceBtn.classList.add('recording');
            } catch (err) { alert("Permite el micrófono para enviar audios."); }
        } else {
            mediaRecorder.stop();
            isRecording = false;
            voiceBtn.classList.remove('recording');
        }
    });

    // --- RENDERIZAR MENSAJES ---
    socket.on('message', (message) => {
        const div = document.createElement('div');
        const isMe = message.username === window.currentUsername;
        div.className = `message ${isMe ? 'my-message' : ''}`;
        
        let replyHTML = '';
        if (message.reply) {
            replyHTML = `
                <div class="quoted-message">
                    <strong>${message.reply.username}</strong>
                    <p>${message.reply.text.startsWith('data:image') || message.reply.text.startsWith('http') ? '📷 Imagen' : message.reply.text}</p>
                </div>
            `;
        }

        let content = '';
        if (message.type === 'image') content = `<img src="${message.text}" class="msg-image">`;
        else if (message.type === 'audio') content = `<audio controls src="${message.text}" class="msg-audio"></audio>`;
        else content = `<p class="text">${message.text}</p>`;

        div.innerHTML = `
            <div class="msg-header">
                <img src="${message.avatar}" class="msg-avatar">
                <span style="color: ${isMe ? '#fff' : message.color}; font-weight: bold;">${message.username}</span>
            </div>
            ${replyHTML}
            ${content}
            <div class="msg-footer">
                <span class="time">${message.time}</span>
                <button class="reply-btn" onclick="setReply('${message.username}', '${message.type === 'text' ? message.text.replace(/'/g, "\\'") : message.type}')"><i class="fas fa-reply"></i></button>
            </div>
        `;
        
        div.addEventListener('dblclick', () => setReply(message.username, message.type === 'text' ? message.text : message.type));

        chatMessages.appendChild(div);
        chatMessages.scrollTop = chatMessages.scrollHeight;
        if(!isMe) document.getElementById('notificationSound').play().catch(()=>{});
    });

    // --- BUSCADOR EN CHAT ---
    document.getElementById('searchInput').addEventListener('input', (e) => {
        const term = e.target.value.toLowerCase();
        document.querySelectorAll('.message').forEach(msg => {
            const text = msg.querySelector('.text')?.innerText.toLowerCase() || '';
            msg.style.display = text.includes(term) ? 'block' : 'none';
        });
    });

    // Emojis básicos
    const emojis = ['😀','😂','🥺','😎','😍','👍','❤️','🔥','🎉','✨','😭','🙏','😅','🤔','🥰'];
    document.getElementById('emojiPicker').innerHTML = emojis.map(e => `<span onclick="document.getElementById('messageInput').value += '${e}'">${e}</span>`).join('');
    document.getElementById('emojiBtn').addEventListener('click', () => {
        document.getElementById('emojiPicker').classList.toggle('active');
        document.getElementById('gifPicker').classList.remove('active');
    });
});