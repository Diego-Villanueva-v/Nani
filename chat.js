document.addEventListener('userReady', () => {
    // IMPORTANTE: URL de tu servidor Railway
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
    let viewingProfile = null;

    // --- CARGAR PERFIL DEL NAVEGADOR ---
    let userColor = localStorage.getItem('chatUserColor') || '#2f81f7';
    let userBubbleColor = localStorage.getItem('chatUserBubble') || '#2f81f7';
    let userBubbleOpacity = localStorage.getItem('chatUserOpacity') || '1';
    let userStatus = localStorage.getItem('chatUserStatus') || 'Disponible';
    let userAvatar = localStorage.getItem('chatUserAvatar') || 'https://cdn-icons-png.flaticon.com/512/149/149071.png';
    let chatBg = localStorage.getItem('chatBgLocal') || '';
    
    // Inicializar UI
    document.getElementById('myMiniAvatar').src = userAvatar;
    document.getElementById('avatarPreview').src = userAvatar;
    document.getElementById('statusInput').value = userStatus;
    document.getElementById('colorPicker').value = userColor;
    document.getElementById('bubbleColorPicker').value = userBubbleColor;
    document.getElementById('bubbleOpacity').value = userBubbleOpacity;
    document.getElementById('opacityVal').textContent = `${Math.round(userBubbleOpacity * 100)}%`;
    if (chatBg) chatMessages.style.backgroundImage = `url(${chatBg})`;

    // Utilidad: Hex a RGBA para las burbujas
    const hexToRgba = (hex, opacity) => {
        let r = parseInt(hex.slice(1, 3), 16), g = parseInt(hex.slice(3, 5), 16), b = parseInt(hex.slice(5, 7), 16);
        return `rgba(${r}, ${g}, ${b}, ${opacity})`;
    };

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

    // --- EMITIR DATOS AL SERVIDOR ---
    const sendUserData = (room = currentRoom) => {
        socket.emit('joinRoom', { 
            username: window.currentUsername, room, color: userColor, 
            avatar: userAvatar, status: userStatus, 
            bubbleBg: userBubbleColor, bubbleOpacity: userBubbleOpacity 
        });
    };

    // --- CONFIGURACIÓN ESTÉTICA ---
    document.getElementById('bubbleOpacity').addEventListener('input', (e) => {
        document.getElementById('opacityVal').textContent = `${Math.round(e.target.value * 100)}%`;
    });

    document.getElementById('configBtn').addEventListener('click', () => document.getElementById('configModal').classList.add('active'));
    document.getElementById('closeConfigBtn').addEventListener('click', () => document.getElementById('configModal').classList.remove('active'));

    document.getElementById('avatarInput').addEventListener('change', (e) => {
        if(e.target.files[0]) compressImage(e.target.files[0], 250, (b64) => { document.getElementById('avatarPreview').src = b64; userAvatar = b64; });
    });

    document.getElementById('bgLocalInput').addEventListener('change', (e) => {
        if(e.target.files[0]) compressImage(e.target.files[0], 1200, (b64) => chatBg = b64);
    });

    document.getElementById('saveConfigBtn').addEventListener('click', () => {
        userColor = document.getElementById('colorPicker').value;
        userBubbleColor = document.getElementById('bubbleColorPicker').value;
        userBubbleOpacity = document.getElementById('bubbleOpacity').value;
        userStatus = document.getElementById('statusInput').value || 'Disponible';

        localStorage.setItem('chatUserColor', userColor);
        localStorage.setItem('chatUserBubble', userBubbleColor);
        localStorage.setItem('chatUserOpacity', userBubbleOpacity);
        localStorage.setItem('chatUserStatus', userStatus);
        localStorage.setItem('chatUserAvatar', userAvatar);
        localStorage.setItem('chatBgLocal', chatBg);
        
        document.getElementById('myMiniAvatar').src = userAvatar;
        chatMessages.style.backgroundImage = chatBg ? `url(${chatBg})` : 'none';
        
        sendUserData();
        document.getElementById('configModal').classList.remove('active');
    });

    // --- ANIMACIÓN DE TRANSICIÓN DE SALAS ---
    const switchRoom = (newRoom, titleText) => {
        document.getElementById('chatMainPanel').classList.add('room-transition');
        setTimeout(() => {
            currentRoom = newRoom;
            roomTitle.innerHTML = titleText;
            chatMessages.innerHTML = '';
            sendUserData();
            document.getElementById('chatMainPanel').classList.remove('room-transition');
        }, 300);
    };

    document.getElementById('joinRoomBtn').addEventListener('click', () => switchRoom(roomSelect.value, `Sala: ${roomSelect.value}`));
    
    document.getElementById('savedMessagesBtn').addEventListener('click', () => {
        switchRoom(`${window.currentUsername}_saved`, `<i class="fas fa-bookmark" style="color:${userColor};"></i> Mis Guardados`);
    });

    // --- PORTAPAPELES Y ARCHIVOS (RESPETA LOS GIFS) ---
    document.addEventListener('paste', (e) => {
        const items = e.clipboardData.items;
        for (let i = 0; i < items.length; i++) {
            if (items[i].type.indexOf('image') !== -1) {
                const blob = items[i].getAsFile();
                if (blob.type === 'image/gif') {
                    const reader = new FileReader(); reader.readAsDataURL(blob);
                    reader.onload = (event) => enviarMensaje(event.target.result, 'image');
                } else {
                    compressImage(blob, 800, (b64) => enviarMensaje(b64, 'image'));
                }
            }
        }
    });

    document.getElementById('fileInput').addEventListener('change', (e) => {
        const file = e.target.files[0];
        if(file) {
            if (file.type === 'image/gif') {
                const reader = new FileReader(); reader.readAsDataURL(file);
                reader.onload = (event) => enviarMensaje(event.target.result, 'image');
            } else {
                compressImage(file, 800, (b64) => enviarMensaje(b64, 'image'));
            }
        }
    });

    // --- BUSCADOR DE GIFS RESILIENTE ---
    document.getElementById('gifBtn').addEventListener('click', () => {
        document.getElementById('gifPicker').classList.toggle('active');
        document.getElementById('emojiPicker').classList.remove('active');
    });

    document.getElementById('gifSearch').addEventListener('keypress', async (e) => {
        if(e.key === 'Enter') {
            e.preventDefault();
            const term = e.target.value;
            const results = document.getElementById('gifResults');
            results.innerHTML = '<p style="color:#888;">Buscando...</p>';
            try {
                // Usando Tenor API pública como alternativa súper rápida
                const res = await fetch(`https://g.tenor.com/v1/search?q=${term}&key=LIVDSRZULELA&limit=8`);
                const data = await res.json();
                results.innerHTML = '';
                if(data.results.length === 0) results.innerHTML = '<p>No hay resultados.</p>';
                data.results.forEach(gif => {
                    const img = document.createElement('img');
                    img.src = gif.media[0].tinygif.url; // Preview ligera
                    img.onclick = () => {
                        enviarMensaje(gif.media[0].gif.url, 'image'); // Enviar la pesada
                        document.getElementById('gifPicker').classList.remove('active');
                    };
                    results.appendChild(img);
                });
            } catch (error) {
                results.innerHTML = '<p style="color:red;">Error al buscar. Intenta de nuevo.</p>';
            }
        }
    });

    // --- SISTEMA DE PERFILES DISCORD ---
    window.openProfile = (username) => {
        viewingProfile = username;
        socket.emit('getProfile', username);
    };

    socket.on('profileData', (data) => {
        document.getElementById('dProfileName').textContent = data.username;
        document.getElementById('dProfileName').style.color = data.color || '#fff';
        document.getElementById('dProfileStatus').textContent = data.status || 'Disponible';
        document.getElementById('dProfileAvatar').src = data.avatar || 'https://cdn-icons-png.flaticon.com/512/149/149071.png';
        // Fondo dinámico basado en el color del usuario
        document.getElementById('dProfileBanner').style.background = `linear-gradient(135deg, ${data.color || '#2f81f7'}, #161b22)`;
        
        renderComments(data.comments);
        document.getElementById('discordProfileModal').classList.add('active');
        
        document.getElementById('dProfileDMBtn').onclick = () => {
            document.getElementById('discordProfileModal').classList.remove('active');
            switchRoom([window.currentUsername, data.username].sort().join('_'), `<i class="fas fa-lock" style="color:${data.color};"></i> DM: ${data.username}`);
        };
    });

    const renderComments = (comments) => {
        const wall = document.getElementById('dProfileComments');
        wall.innerHTML = comments.map(c => `
            <div class="d-comment">
                <b>${c.from}</b> <span>${c.time}</span>
                <p>${c.text}</p>
            </div>
        `).join('') || '<p style="color:#888; font-size:0.85rem;">No hay comentarios. ¡Sé el primero!</p>';
        wall.scrollTop = wall.scrollHeight;
    };

    document.getElementById('dCommentBtn').addEventListener('click', () => {
        const text = document.getElementById('dCommentText').value.trim();
        if(text && viewingProfile) {
            socket.emit('addComment', { targetUser: viewingProfile, from: window.currentUsername, text, time: new Date().toLocaleDateString() });
            document.getElementById('dCommentText').value = '';
        }
    });

    socket.on('newProfileComment', (data) => {
        if(viewingProfile === data.targetUser) {
            socket.emit('getProfile', viewingProfile); // Recargar
        }
    });

    document.getElementById('closeDiscordProfileBtn').addEventListener('click', () => document.getElementById('discordProfileModal').classList.remove('active'));

    // --- CONEXIÓN INICIAL Y LISTAS ---
    sendUserData();

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

    // Corrección para que la lista no se apile (Flexbox en CSS maneja la separación)
    socket.on('updateUserList', (users) => {
        document.getElementById('roomUsers').innerHTML = users.map(u => `
            <li onclick="openProfile('${u.username}')" class="list-user-item">
                <img src="${u.avatar}">
                <div class="user-list-info">
                    <span style="color:${u.color}; font-weight:700;">${u.username}</span>
                    <small>${u.status || 'Disponible'}</small>
                </div>
            </li>
        `).join('');
    });

    socket.on('updateGlobalUsers', (users) => {
        document.getElementById('globalUsers').innerHTML = users.map(u => `
            <li onclick="openProfile('${u.username}')" class="list-user-item">
                <div class="status-dot"></div>
                <img src="${u.avatar}">
                <div class="user-list-info">
                    <span style="color:${u.color || '#fff'}; font-weight:700;">${u.username}</span>
                    <small>${u.room.includes('_') ? 'Privado/Oculto' : u.room}</small>
                </div>
            </li>
        `).join('');
    });

    // --- ENVIAR Y RECIBIR MENSAJES (BURBUJAS PERSONALIZADAS) ---
    const enviarMensaje = (texto, tipo = 'text') => {
        if (!texto) return;
        socket.emit('chatMessage', {
            username: window.currentUsername, text: texto, type: tipo,
            room: currentRoom, color: userColor, avatar: userAvatar,
            bubbleBg: userBubbleColor, bubbleOpacity: userBubbleOpacity,
            reply: replyingTo, time: new Date().toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})
        });
        document.getElementById('cancelReplyBtn').click(); 
    };

    document.getElementById('chatForm').addEventListener('submit', (e) => {
        e.preventDefault(); enviarMensaje(messageInput.value.trim(), 'text'); messageInput.value = '';
    });

    socket.on('message', (message) => {
        const div = document.createElement('div');
        const isMe = message.username === window.currentUsername;
        div.className = `message ${isMe ? 'my-message' : ''}`;
        
        // Aplicar el color y transparencia mágica a la burbuja
        if (message.bubbleBg) {
            div.style.background = hexToRgba(message.bubbleBg, message.bubbleOpacity || 1);
            if (!isMe) div.style.border = `1px solid ${message.bubbleBg}`; // Bordecito para los demás
        }

        let replyHTML = '';
        if (message.reply) {
            replyHTML = `
                <div class="quoted-message" style="border-left-color: ${isMe ? '#fff' : message.color};">
                    <strong style="color: ${isMe ? '#fff' : message.color};">${message.reply.username}</strong>
                    <p>${message.reply.text.startsWith('data:image') || message.reply.text.startsWith('http') ? '📷 Imagen / GIF' : message.reply.text}</p>
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
                <span style="color: ${message.color}; font-weight: 800;">${message.username}</span>
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

    // --- GRABADORA ---
    const voiceBtn = document.getElementById('voiceBtn');
    voiceBtn.addEventListener('click', async () => {
        if (!isRecording) {
            try {
                const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
                mediaRecorder = new MediaRecorder(stream);
                audioChunks = [];
                mediaRecorder.ondataavailable = e => audioChunks.push(e.data);
                mediaRecorder.onstop = () => {
                    const reader = new FileReader(); reader.readAsDataURL(new Blob(audioChunks, { type: 'audio/webm' }));
                    reader.onloadend = () => enviarMensaje(reader.result, 'audio');
                };
                mediaRecorder.start(); isRecording = true; voiceBtn.classList.add('recording');
            } catch (err) { alert("Permite el micrófono."); }
        } else {
            mediaRecorder.stop(); isRecording = false; voiceBtn.classList.remove('recording');
        }
    });

    // --- MISCELÁNEA ---
    window.setReply = (username, text) => {
        replyingTo = { username, text }; document.getElementById('replyName').textContent = username;
        document.getElementById('replyText').textContent = text.startsWith('data:') || text.startsWith('http') ? '📷 Imagen' : text;
        document.getElementById('replyPreview').classList.add('active'); messageInput.focus();
    };
    document.getElementById('cancelReplyBtn').addEventListener('click', () => { replyingTo = null; document.getElementById('replyPreview').classList.remove('active'); });
    document.getElementById('emojiBtn').addEventListener('click', () => { document.getElementById('emojiPicker').classList.toggle('active'); document.getElementById('gifPicker').classList.remove('active'); });
    document.getElementById('emojiPicker').innerHTML = ['😀','😂','🥺','😎','😍','👍','❤️','🔥','🎉','✨','😭','🙏','😅','🤔','🥰'].map(e => `<span onclick="document.getElementById('messageInput').value += '${e}'">${e}</span>`).join('');
    document.getElementById('searchInput').addEventListener('input', (e) => {
        const term = e.target.value.toLowerCase();
        document.querySelectorAll('.message').forEach(msg => {
            msg.style.display = (msg.querySelector('.text')?.innerText.toLowerCase() || '').includes(term) ? 'block' : 'none';
        });
    });
});