document.addEventListener('userReady', () => {
    const socket = io('https://chat-project-production-b900.up.railway.app'); 
    
    // SEGURIDAD SUPER ADMIN (Vinculado a tu correo exacto)
    const SUPER_ADMIN_EMAIL = 'unknownlineof@gmail.com';
    const isSuperAdmin = window.currentUserEmail === SUPER_ADMIN_EMAIL;

    // --- I18N ---
    const lang = navigator.language.startsWith('es') ? 'es' : 'en';
    const dict = {
        es: { welcomeTo: "¡Bienvenido a Nani!", setupProfile: "Configuremos tu perfil.", yourAge: "Tu edad", selectGender: "Selecciona tu género", male: "Masculino", female: "Femenino", other: "Otro", start: "Empezar", discover: "Explora Nani", lobbyDesc: "Entra a salas globales y conoce gente.", publicRooms: "Salas Públicas", enterRoom: "Entrar a la sala", emojis: "Emojis", gifs: "GIFs", stickers: "Stickers", friends: "Comunidad", myFriends: "Mis Amigos", requests: "Solicitudes", navHome: "Inicio", navFriends: "Social", navProfile: "Perfil", navSettings: "Ajustes", ctxReply: "Responder", ctxSave: "Guardar", ctxDelete: "Eliminar", dm: "Mensaje", addFriend: "Añadir", wall: "Muro de Comentarios", settingsTitle: "Configuración", setAppearance: "Apariencia", changeAvatar: "Cambiar Avatar", colorName: "Nombre", colorBubble: "Burbuja", transparency: "Transparencia", wallpaper: "Fondo Chat", setSystem: "Sistema", notifications: "Notificaciones", vibration: "Vibración", support: "Soporte Técnico", logout: "Cerrar Sesión", save: "Guardar", close: "Cerrar", pendingReq: "Enviada" },
        en: { welcomeTo: "Welcome to Nani!", setupProfile: "Let's set up your profile.", yourAge: "Your age", selectGender: "Select your gender", male: "Male", female: "Female", other: "Other", start: "Start", discover: "Discover Nani", lobbyDesc: "Join global rooms and meet people.", publicRooms: "Public Rooms", enterRoom: "Join Room", emojis: "Emojis", gifs: "GIFs", stickers: "Stickers", friends: "Community", myFriends: "My Friends", requests: "Requests", navHome: "Home", navFriends: "Social", navProfile: "Profile", navSettings: "Settings", ctxReply: "Reply", ctxSave: "Save", ctxDelete: "Delete", dm: "Message", addFriend: "Add", wall: "Comment Wall", settingsTitle: "Settings", setAppearance: "Appearance", changeAvatar: "Change Avatar", colorName: "Name", colorBubble: "Bubble", transparency: "Opacity", wallpaper: "Chat BG", setSystem: "System", notifications: "Notifications", vibration: "Vibration", support: "Technical Support", logout: "Logout", save: "Save", close: "Close", pendingReq: "Sent" }
    };
    document.querySelectorAll('[data-i18n]').forEach(el => { el.textContent = dict[lang][el.dataset.i18n] || el.textContent; });

    // --- ESTADO GLOBAL ---
    let currentRoom = 'Lobby'; 
    let selectedRoomToJoin = 'General'; 
    let currentRoomsData = [];
    let replyingTo = null; 
    let viewingProfile = null;
    let selectedMsgContext = null;
    let isRecording = false; let mediaRecorder; let audioChunks = [];

    // --- CARGAR DATOS ---
    const cloudData = window.userCloudData || {};
    const prefs = cloudData.preferences || {};
    let myStickers = prefs.stickers || [];
    let myFriends = cloudData.friends || [];
    let myRequests = cloudData.friendRequests || [];
    
    let userAge = cloudData.age || '';
    let userGender = cloudData.gender || '';
    let userColor = prefs.color || '#d946ef';
    let userBubbleColor = prefs.bubbleColor || '#9333ea';
    let userBubbleOpacity = prefs.bubbleOpacity || '0.9';
    let userStatus = prefs.status || 'Disponible';
    let userAvatar = prefs.avatar || 'https://cdn-icons-png.flaticon.com/512/149/149071.png';
    let chatBg = prefs.bgLocal || 'Nane.jpg'; 
    let useVibration = prefs.vibration !== false; 
    let useNotifs = prefs.notifications !== false;

    // --- ONBOARDING ---
    if (!userAge || !userGender) document.getElementById('onboardingModal').classList.add('active');
    let tempGender = '';
    document.querySelectorAll('.gender-btn').forEach(btn => {
        btn.addEventListener('click', () => { document.querySelectorAll('.gender-btn').forEach(b => b.classList.remove('active')); btn.classList.add('active'); tempGender = btn.dataset.gender; });
    });
    document.getElementById('finishOnboardBtn').addEventListener('click', async () => {
        const age = document.getElementById('onboardAge').value;
        if(age && tempGender) {
            userAge = age; userGender = tempGender;
            await window.setDoc(window.doc(window.db, "usuarios", window.currentUserUid), { age: userAge, gender: userGender }, { merge: true });
            document.getElementById('onboardingModal').classList.remove('active'); sendUserData();
        } else { alert("Completa todos los campos"); }
    });

    const hexToRgba = (hex, op) => { let r=parseInt(hex.slice(1,3),16), g=parseInt(hex.slice(3,5),16), b=parseInt(hex.slice(5,7),16); return `rgba(${r},${g},${b},${op})`; };
    const vibrate = (ms) => { if(useVibration && navigator.vibrate) navigator.vibrate(ms); };
    const compressImage = (file, maxWidth, cb) => { const r = new FileReader(); r.readAsDataURL(file); r.onload = e => { const img = new Image(); img.src = e.target.result; img.onload = () => { const cvs = document.createElement('canvas'); const sc = Math.min(maxWidth/img.width, 1); cvs.width = img.width*sc; cvs.height = img.height*sc; cvs.getContext('2d').drawImage(img, 0, 0, cvs.width, cvs.height); cb(cvs.toDataURL('image/jpeg', 0.8)); }; }; };

    const sendUserData = (room = currentRoom) => {
        socket.emit('joinRoom', { username: window.currentUsername, email: window.currentUserEmail, room, color: userColor, avatar: userAvatar, status: userStatus, bubbleBg: userBubbleColor, bubbleOpacity: userBubbleOpacity, age: userAge, gender: userGender });
        checkRoomAdmin(room);
    };

    // Inicializar Interfaz
    document.getElementById('avatarPreview').src = userAvatar; document.getElementById('statusInput').value = userStatus;
    document.getElementById('colorPicker').value = userColor; document.getElementById('bubbleColorPicker').value = userBubbleColor;
    document.getElementById('bubbleOpacity').value = userBubbleOpacity; document.getElementById('opacityVal').textContent = `${Math.round(userBubbleOpacity * 100)}%`;
    document.getElementById('vibToggle').checked = useVibration; document.getElementById('notifToggle').checked = useNotifs;
    if (chatBg) document.getElementById('chatMessages').style.backgroundImage = `url('${chatBg}')`;

    // --- NAVEGACIÓN (BOTTOM NAV) ---
    const switchAppView = (viewId) => {
        document.querySelectorAll('.app-view').forEach(v => v.classList.remove('active'));
        document.querySelectorAll('.nav-item').forEach(n => n.classList.remove('active'));
        document.getElementById(viewId).classList.add('active');
        const navBtn = document.querySelector(`[data-view="${viewId}"]`);
        if(navBtn) navBtn.classList.add('active');
    };
    document.querySelectorAll('.nav-item[data-view]').forEach(btn => btn.addEventListener('click', () => switchAppView(btn.dataset.view)));
    document.getElementById('navSettingsBtn').addEventListener('click', () => document.getElementById('settingsModal').classList.add('active'));
    document.getElementById('navMyProfileBtn').addEventListener('click', () => window.openProfile(window.currentUsername));

    // --- TRANSICIONES DE SALAS ---
    const checkRoomAdmin = (roomName) => {
        const roomData = currentRoomsData.find(r => r.id === roomName);
        if (roomData) {
            document.getElementById('roomCreator').textContent = roomData.creator === 'Sistema' ? 'Sala Oficial' : `Creada por: ${roomData.creator}`;
            document.getElementById('deleteRoomBtn').style.display = (roomData.creator === window.currentUsername || isSuperAdmin) && !['General','Programación','Juegos'].includes(roomData.id) ? 'block' : 'none';
        }
    };

    const enterRoom = (newRoom, titleText) => {
        if(currentRoom === newRoom && newRoom !== 'Lobby') return;
        currentRoom = newRoom; document.getElementById('roomTitle').innerHTML = titleText; document.getElementById('chatMessages').innerHTML = ''; 
        sendUserData(); switchAppView('viewChat');
    };

    document.getElementById('leaveRoomBtn').addEventListener('click', () => { currentRoom = 'Lobby'; sendUserData('Lobby'); switchAppView('viewLobby'); });
    socket.on('forceLeaveRoom', (dr) => { if(currentRoom === dr) { alert(`Sala eliminada.`); switchAppView('viewLobby'); } });
    document.getElementById('joinRoomBtn').addEventListener('click', () => enterRoom(selectedRoomToJoin, `Sala: ${selectedRoomToJoin}`));
    document.getElementById('savedMessagesBtn').addEventListener('click', () => enterRoom(`${window.currentUsername}_saved`, `<i class="fas fa-bookmark" style="color:${userColor};"></i> Mis Guardados`));
    document.getElementById('deleteRoomBtn').addEventListener('click', () => { if(confirm(`¿Eliminar sala ${currentRoom}?`)) socket.emit('deleteRoom', { roomName: currentRoom, requesterUser: window.currentUsername, requesterEmail: window.currentUserEmail }); });
    socket.on('loadHistory', (history) => { const cm = document.getElementById('chatMessages'); cm.innerHTML = ''; history.forEach(msg => renderMessage(msg)); cm.scrollTop = cm.scrollHeight; });

    // --- DROPDOWN SALAS ---
    document.getElementById('dropdownHeader').addEventListener('click', () => document.getElementById('dropdownList').classList.toggle('show'));
    document.addEventListener('click', (e) => { if(!e.target.closest('.custom-dropdown')) document.getElementById('dropdownList').classList.remove('show'); });
    socket.on('updateRooms', (rooms) => {
        currentRoomsData = rooms; const dl = document.getElementById('dropdownList'); dl.innerHTML = '';
        rooms.forEach(room => {
            if(!room.id.includes('_')) { 
                const li = document.createElement('li'); li.textContent = room.name;
                if(room.id === selectedRoomToJoin) { li.classList.add('active'); document.getElementById('selectedRoomText').textContent = room.name; }
                li.addEventListener('click', () => { selectedRoomToJoin = room.id; document.getElementById('selectedRoomText').textContent = room.name; dl.querySelectorAll('li').forEach(i => i.classList.remove('active')); li.classList.add('active'); dl.classList.remove('show'); });
                dl.appendChild(li);
            }
        });
        checkRoomAdmin(currentRoom);
    });

    document.getElementById('createRoomBtn').addEventListener('click', () => {
        const newRoom = document.getElementById('newRoomInput').value.trim();
        if(newRoom) { socket.emit('createRoom', { roomName: newRoom, creator: window.currentUsername }); document.getElementById('newRoomInput').value = ''; setTimeout(() => { selectedRoomToJoin = newRoom; enterRoom(newRoom, `Sala: ${newRoom}`); }, 300); }
    });

    // --- GUARDAR CONFIGURACIÓN ---
    document.getElementById('bubbleOpacity').addEventListener('input', (e) => document.getElementById('opacityVal').textContent = `${Math.round(e.target.value * 100)}%`);
    document.getElementById('avatarInput').addEventListener('change', (e) => { if(e.target.files[0]) compressImage(e.target.files[0], 250, (b64) => { document.getElementById('avatarPreview').src = b64; userAvatar = b64; }); });
    document.getElementById('bgLocalInput').addEventListener('change', (e) => { if(e.target.files[0]) compressImage(e.target.files[0], 1200, (b64) => { chatBg = b64; document.getElementById('chatMessages').style.backgroundImage = `url('${chatBg}')`; }); });
    document.getElementById('resetBgBtn').addEventListener('click', () => { chatBg = 'Nane.jpg'; document.getElementById('chatMessages').style.backgroundImage = `url('${chatBg}')`; });
    
    document.getElementById('saveConfigBtn').addEventListener('click', async () => {
        document.getElementById('saveConfigBtn').textContent = '...';
        userColor = document.getElementById('colorPicker').value; userBubbleColor = document.getElementById('bubbleColorPicker').value; userBubbleOpacity = document.getElementById('bubbleOpacity').value; userStatus = document.getElementById('statusInput').value || 'Disponible'; useVibration = document.getElementById('vibToggle').checked; useNotifs = document.getElementById('notifToggle').checked;
        const prefsToSave = { color: userColor, bubbleColor: userBubbleColor, bubbleOpacity: userBubbleOpacity, status: userStatus, avatar: userAvatar, bgLocal: chatBg, stickers: myStickers, vibration: useVibration, notifications: useNotifs };
        try { await window.setDoc(window.doc(window.db, "usuarios", window.currentUserUid), { preferences: prefsToSave }, { merge: true }); } catch(e) {}
        
        document.querySelectorAll('.my-message').forEach(msg => { if (!msg.classList.contains('type-image')) msg.style.background = hexToRgba(userBubbleColor, userBubbleOpacity); const ns = msg.querySelector('.msg-header span'); if(ns) ns.style.color = userColor; });
        sendUserData(); document.getElementById('myMiniAvatar').src = userAvatar; document.getElementById('saveConfigBtn').textContent = dict[lang].save; document.getElementById('settingsModal').classList.remove('active');
    });

    // --- MENÚ UNIFICADO ADJUNTOS ---
    const unifiedPicker = document.getElementById('unifiedPicker');
    document.getElementById('toggleUnifiedPickerBtn').addEventListener('click', () => { unifiedPicker.classList.toggle('active'); if(unifiedPicker.classList.contains('active')) updateStickerMenu(); });
    document.querySelectorAll('.picker-tab').forEach(tab => { tab.addEventListener('click', (e) => { e.preventDefault(); document.querySelectorAll('.picker-tab').forEach(t => t.classList.remove('active')); document.querySelectorAll('.picker-content').forEach(c => c.classList.remove('active')); tab.classList.add('active'); document.getElementById(tab.dataset.target).classList.add('active'); }); });

    const updateStickerMenu = () => { document.getElementById('stickerResults').innerHTML = myStickers.map(url => `<img src="${url}" onclick="sendSticker('${url}')">`).join('') || '<p style="grid-column:span 2; text-align:center; color:var(--text-muted); font-size:0.8rem;">Sin stickers. Usa click derecho / manten presionada una imagen en el chat.</p>'; };
    window.sendSticker = (url) => { enviarMensaje(url, 'image'); unifiedPicker.classList.remove('active'); };

    const emojis = ['😀','😂','🥺','😎','😍','👍','❤️','🔥','🎉','✨','😭','🙏','😅','🤔','🥰','👽','👻','🤖','💩','💀','💅','💃','👀','🧠','👅','🚀','🛸','🎨','🎮','🏆','🍕','🍔','🍟','☕','🍷','⚽','🏀','🎸','📱','💻','💡','💸','💣','🔫','🛁','🚽','🔥','💯'];
    document.getElementById('emojiPickerContent').innerHTML = emojis.map(e => `<span onclick="document.getElementById('messageInput').value += '${e}'">${e}</span>`).join('');
    
    document.getElementById('doGifSearchBtn').addEventListener('click', async () => {
        const term = document.getElementById('gifSearch').value.trim(); if(!term) return;
        const resDiv = document.getElementById('gifResults'); resDiv.innerHTML = '<p>...</p>';
        try {
            const res = await fetch(`https://g.tenor.com/v1/search?q=${term}&key=LIVDSRZULELA&limit=12`); const data = await res.json();
            resDiv.innerHTML = data.results.length === 0 ? '<p>No hay resultados.</p>' : '';
            data.results.forEach(gif => { const img = document.createElement('img'); img.src = gif.media[0].tinygif.url; img.onclick = () => { enviarMensaje(gif.media[0].gif.url, 'image'); unifiedPicker.classList.remove('active'); document.getElementById('gifSearch').value='';}; resDiv.appendChild(img); });
        } catch(e) { resDiv.innerHTML = '<p>Error</p>'; }
    });
    document.getElementById('gifSearch').addEventListener('keydown', (e) => { if(e.key === 'Enter') { e.preventDefault(); document.getElementById('doGifSearchBtn').click(); }});

    // --- CONTEXT MENU (Click Derecho y Touch Long Press) ---
    const ctxMenu = document.getElementById('contextMenu');
    let pressTimer;
    
    const showContextMenu = (e, msgData) => {
        e.preventDefault();
        selectedMsgContext = msgData;
        let x = e.pageX || (e.touches && e.touches[0].pageX); let y = e.pageY || (e.touches && e.touches[0].pageY);
        // Ajuste para que no se salga de la pantalla
        if(x + 160 > window.innerWidth) x -= 160; if(y + 150 > window.innerHeight) y -= 150;
        
        ctxMenu.style.left = `${x}px`; ctxMenu.style.top = `${y}px`; ctxMenu.classList.add('active');
        document.getElementById('ctxSaveSticker').style.display = msgData.type === 'image' ? 'flex' : 'none';
        document.getElementById('ctxDelete').style.display = (msgData.username === window.currentUsername || isSuperAdmin) ? 'flex' : 'none';
        vibrate(50);
    };

    document.addEventListener('click', (e) => { if(!e.target.closest('.context-menu')) ctxMenu.classList.remove('active'); });
    document.getElementById('ctxReply').addEventListener('click', () => {
        if(selectedMsgContext) {
            replyingTo = { username: selectedMsgContext.username, text: selectedMsgContext.text };
            document.getElementById('replyName').textContent = selectedMsgContext.username;
            document.getElementById('replyText').textContent = selectedMsgContext.type === 'image' ? '📷 Imagen' : selectedMsgContext.text;
            document.getElementById('replyPreview').classList.add('active'); document.getElementById('messageInput').focus();
        }
        ctxMenu.classList.remove('active');
    });
    document.getElementById('ctxSaveSticker').addEventListener('click', () => {
        if(selectedMsgContext && selectedMsgContext.type === 'image') {
            if(!myStickers.includes(selectedMsgContext.text)) {
                myStickers.push(selectedMsgContext.text);
                window.setDoc(window.doc(window.db, "usuarios", window.currentUserUid), { preferences: { stickers: myStickers } }, { merge: true });
                updateStickerMenu(); vibrate(100); alert("Sticker Guardado");
            }
        }
        ctxMenu.classList.remove('active');
    });
    document.getElementById('ctxDelete').addEventListener('click', () => {
        if(selectedMsgContext) socket.emit('deleteMessage', { room: currentRoom, msgId: selectedMsgContext.msgId, requesterEmail: window.currentUserEmail });
        ctxMenu.classList.remove('active');
    });

    // --- PERFILES Y AMIGOS ---
    window.openProfile = (username) => { viewingProfile = username; socket.emit('getProfile', username); };
    
    const renderFriendsUI = () => {
        const genList = (container, arr, isReq) => {
            document.getElementById(container).innerHTML = arr.map(u => `
                <li class="f-item">
                    <span onclick="openProfile('${u}')" style="cursor:pointer; font-weight:bold; color:var(--text-main); flex:1;">${u}</span>
                    ${isReq ? `<div><button class="btn-primary" onclick="acceptFriend('${u}')" style="padding:5px 10px; font-size:0.8rem; border-radius:8px;">Aceptar</button> <button class="btn-danger-outline" onclick="rejectFriend('${u}')" style="padding:5px 10px; font-size:0.8rem;">X</button></div>` : ''}
                </li>
            `).join('') || '<p style="color:var(--text-muted); font-size:0.9rem;">Lista vacía.</p>';
        };
        genList('myFriendsList', myFriends, false); genList('pendingRequestsList', myRequests, true);
    };

    socket.on('profileData', (data) => {
        document.getElementById('dProfileName').textContent = data.username;
        document.getElementById('dProfileName').style.color = data.color || '#fff';
        document.getElementById('adminBadge').style.display = data.isAdmin ? 'inline-block' : 'none';
        document.getElementById('dProfileStatus').textContent = data.status || 'Disponible';
        document.getElementById('dProfileAvatar').src = data.avatar || 'https://cdn-icons-png.flaticon.com/512/149/149071.png';
        document.getElementById('dProfileBanner').style.background = `linear-gradient(135deg, ${data.color || '#d946ef'}, #18181b)`;
        
        let emojiG = data.gender === 'Masculino' ? '🙋‍♂️' : (data.gender === 'Femenino' ? '🙋‍♀️' : '🦄');
        document.getElementById('dProfileDetails').innerHTML = `${data.age ? data.age + ' años' : ''} ${emojiG}`;
        
        const dmBtn = document.getElementById('dProfileDMBtn'); const addBtn = document.getElementById('dProfileAddFriendBtn');
        if(data.username === window.currentUsername) { dmBtn.style.display = 'none'; addBtn.style.display = 'none'; } else {
            dmBtn.style.display = 'block'; dmBtn.onclick = () => { document.getElementById('discordProfileModal').classList.remove('active'); enterRoom([window.currentUsername, data.username].sort().join('_'), `<i class="fas fa-lock" style="color:${data.color};"></i> DM: ${data.username}`); };
            if(myFriends.includes(data.username)) { addBtn.innerHTML = '<i class="fas fa-user-check"></i> Amigo'; addBtn.disabled = true; }
            else { addBtn.innerHTML = '<i class="fas fa-user-plus"></i> Añadir'; addBtn.disabled = false; addBtn.onclick = () => { socket.emit('sendFriendRequest', { from: window.currentUsername, to: data.username }); addBtn.innerHTML = dict[lang].pendingReq; addBtn.disabled = true; }; }
            addBtn.style.display = 'block';
        }
        renderComments(data.comments, data.username); document.getElementById('discordProfileModal').classList.add('active');
    });
    
    const renderComments = (comments, profileOwner) => {
        const wall = document.getElementById('dProfileComments');
        const isMyProfile = profileOwner === window.currentUsername || isSuperAdmin;
        wall.innerHTML = comments.map(c => `<div class="d-comment"><b style="color:var(--accent);">${c.from}</b> <span>${c.time} ${isMyProfile ? `<i class="fas fa-trash" style="color:var(--danger); cursor:pointer; margin-left:5px;" onclick="socket.emit('deleteComment', {targetUser:'${profileOwner}', commentId:'${c.id}', requesterUser:'${window.currentUsername}', requesterEmail:'${window.currentUserEmail}'})"></i>` : ''}</span><p>${c.text}</p></div>`).join('') || '<p style="color:var(--text-muted); font-size:0.9rem;">Muro vacío.</p>';
        wall.scrollTop = wall.scrollHeight;
    };

    document.getElementById('dCommentBtn').addEventListener('click', () => { const text = document.getElementById('dCommentText').value.trim(); if(text && viewingProfile) { socket.emit('addComment', { targetUser: viewingProfile, from: window.currentUsername, text, time: new Date().toLocaleDateString() }); document.getElementById('dCommentText').value = ''; }});
    socket.on('newProfileComment', (data) => { if(viewingProfile === data.targetUser) socket.emit('getProfile', viewingProfile); });
    document.getElementById('closeDiscordProfileBtn').addEventListener('click', () => document.getElementById('discordProfileModal').classList.remove('active'));

    // Receptores Amigos
    socket.on('friendRequestReceived', ({ from, to }) => { if(to === window.currentUsername && !myRequests.includes(from) && !myFriends.includes(from)) { myRequests.push(from); window.setDoc(window.doc(window.db, "usuarios", window.currentUserUid), { friendRequests: myRequests }, { merge: true }); vibrate(200); renderFriendsUI(); }});
    window.acceptFriend = (reqUser) => { myFriends.push(reqUser); myRequests = myRequests.filter(r => r !== reqUser); window.setDoc(window.doc(window.db, "usuarios", window.currentUserUid), { friendRequests: myRequests, friends: myFriends }, { merge: true }); socket.emit('acceptFriendRequest', { from: window.currentUsername, to: reqUser }); renderFriendsUI(); };
    window.rejectFriend = (reqUser) => { myRequests = myRequests.filter(r => r !== reqUser); window.setDoc(window.doc(window.db, "usuarios", window.currentUserUid), { friendRequests: myRequests }, { merge: true }); renderFriendsUI(); };
    socket.on('friendRequestAccepted', ({ from, to }) => { if(to === window.currentUsername && !myFriends.includes(from)) { myFriends.push(from); window.setDoc(window.doc(window.db, "usuarios", window.currentUserUid), { friends: myFriends }, { merge: true }); renderFriendsUI(); }});

    // --- LISTAS GLOBALES ---
    const updateLists = (id, users) => {
        document.getElementById(id).innerHTML = users.map(u => {
            const isMe = u.username === window.currentUsername;
            return `<li class="f-item" style="padding: 10px;" onclick="openProfile('${u.username}')"><div style="display:flex; align-items:center; gap:10px;"><img src="${u.avatar}" style="width:35px; height:35px; border-radius:50%; object-fit:cover;"><div><span style="color:${isMe ? userColor : (u.color||'#fff')}; font-weight:700;">${u.username} ${isMe ? '<small style="color:var(--text-muted); font-weight:normal;">(Tú)</small>' : ''}</span><br><small style="color:var(--text-muted);">${u.status || 'Disponible'}</small></div></div></li>`;
        }).join('') || '<p style="color:var(--text-muted); font-size:0.9rem;">Nadie por aquí.</p>';
    };
    socket.on('updateUserList', (users) => updateLists('roomUsersList', users));
    socket.on('updateGlobalUsers', (users) => updateLists('globalUsersList', users));

    // --- ENVIAR Y RENDERIZAR MENSAJES ---
    const enviarMensaje = (texto, tipo = 'text') => {
        if (!texto) return;
        socket.emit('chatMessage', { username: window.currentUsername, text: texto, type: tipo, room: currentRoom, color: userColor, avatar: userAvatar, bubbleBg: userBubbleColor, bubbleOpacity: userBubbleOpacity, reply: replyingTo, time: new Date().toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'}) });
        document.getElementById('cancelReplyBtn').click(); 
    };

    document.getElementById('chatForm').addEventListener('submit', (e) => { e.preventDefault(); enviarMensaje(messageInput.value.trim(), 'text'); messageInput.value = ''; });

    document.addEventListener('paste', (e) => {
        const items = e.clipboardData.items;
        for (let i = 0; i < items.length; i++) {
            if (items[i].type.indexOf('image') !== -1) {
                const blob = items[i].getAsFile();
                if (blob.type === 'image/gif') { const r = new FileReader(); r.readAsDataURL(blob); r.onload = (ev) => enviarMensaje(ev.target.result, 'image'); } 
                else { compressImage(blob, 800, (b64) => enviarMensaje(b64, 'image')); }
            }
        }
    });

    document.getElementById('fileInput').addEventListener('change', (e) => {
        const file = e.target.files[0];
        if(file) {
            if (file.type === 'image/gif') { const r = new FileReader(); r.readAsDataURL(file); r.onload = (ev) => enviarMensaje(ev.target.result, 'image'); } 
            else { compressImage(file, 800, (b64) => enviarMensaje(b64, 'image')); }
        }
    });

    const renderMessage = (message) => {
        const div = document.createElement('div'); div.id = `msg-${message.msgId}`;
        const isMe = message.username === window.currentUsername;
        div.className = `message ${isMe ? 'my-message' : ''} ${message.type === 'image' ? 'type-image' : ''}`;
        
        const cBg = isMe ? userBubbleColor : (message.bubbleBg || '#9333ea');
        const cOp = isMe ? userBubbleOpacity : (message.bubbleOpacity || 1);
        const cNameColor = isMe ? userColor : message.color;

        if (message.type !== 'image') { div.style.background = hexToRgba(cBg, cOp); if (!isMe) div.style.border = `1px solid ${cBg}`; }

        let rHtml = ''; if (message.reply) rHtml = `<div class="quoted-message" style="border-left-color: ${isMe ? '#fff' : cNameColor};"><strong style="color: ${isMe ? '#fff' : cNameColor};">${message.reply.username}</strong><p>${message.reply.text.startsWith('data:') || message.reply.text.startsWith('http') ? '📷 Imagen' : message.reply.text}</p></div>`;

        let content = '';
        if (message.type === 'image') content = `<img src="${message.text}" class="msg-image compact-img" onclick="document.getElementById('lightboxImg').src=this.src; document.getElementById('lightboxModal').classList.add('active');">`;
        else if (message.type === 'audio') content = `<audio controls src="${message.text}" class="msg-audio"></audio>`;
        else content = `<p class="text">${message.text}</p>`;

        div.innerHTML = `
            <div class="msg-header"><img src="${message.avatar}" class="msg-avatar"><span style="color: ${cNameColor}; font-weight: 800;">${message.username}</span></div>
            ${rHtml} ${content} <div class="msg-footer"><span class="time">${message.time}</span></div>
        `;
        
        // Touch events para celular (Menú contextual unificado)
        div.addEventListener('contextmenu', (e) => showContextMenu(e, message));
        div.addEventListener('touchstart', (e) => { pressTimer = window.setTimeout(() => showContextMenu(e, message), 600); });
        div.addEventListener('touchend', () => clearTimeout(pressTimer)); div.addEventListener('touchmove', () => clearTimeout(pressTimer));

        chatMessages.appendChild(div); chatMessages.scrollTop = chatMessages.scrollHeight;
        if(!isMe && useNotifs) { document.getElementById('notificationSound').play().catch(()=>{}); vibrate(150); }
    };
    socket.on('message', renderMessage);

    document.getElementById('searchInput').addEventListener('input', (e) => { const term = e.target.value.toLowerCase(); document.querySelectorAll('.message').forEach(msg => { msg.style.display = (msg.querySelector('.text')?.innerText.toLowerCase() || '').includes(term) ? 'block' : 'none'; }); });

    sendUserData('Lobby'); renderFriendsUI();
});