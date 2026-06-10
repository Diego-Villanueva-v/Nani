import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js";
import { getAuth, onAuthStateChanged, signOut } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js";
import { getFirestore, doc, getDoc, setDoc } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";

const firebaseConfig = {
    apiKey: "AIzaSyDEnq3hg0mNd69JymjHKc1fU7XInY6laDk",
    authDomain: "gen-lang-client-0867834675.firebaseapp.com",
    projectId: "gen-lang-client-0867834675",
    storageBucket: "gen-lang-client-0867834675.firebasestorage.app",
    messagingSenderId: "751363702976",
    appId: "1:751363702976:web:3568444232a9343a136d25"
};

const app = initializeApp(firebaseConfig);
const auth = getAuth(app); 
const db = getFirestore(app);
const socket = io('https://chat-project-production-b900.up.railway.app'); 

const SUPER_ADMIN_EMAIL = 'unknownlineof@gmail.com';
let currentUserUid, currentUserEmail, currentUsername, isSuperAdmin;
let currentRoom = 'Lobby', selectedRoomToJoin = 'General', currentRoomsData = [];
let replyingTo = null, viewingProfile = null, selectedMsgContext = null;

let userAge, userGender, userColor, userBubbleColor, userBubbleOpacity, userStatus, userAvatar, chatBg, useVibration, useNotifs, useLightMode;
let myStickers = [], myFriends = [], myRequests = [];

const showToast = (msg, type = 'success') => {
    const toast = document.getElementById('toastNotification');
    toast.textContent = msg; toast.className = `toast show ${type}`;
    setTimeout(() => { toast.classList.remove('show'); }, 3000);
};

onAuthStateChanged(auth, async (user) => {
    if (!user) return window.location.href = 'index.html';
    
    currentUserUid = user.uid;
    currentUserEmail = user.email;
    isSuperAdmin = currentUserEmail === SUPER_ADMIN_EMAIL;
    
    const docSnap = await getDoc(doc(db, "usuarios", user.uid));
    const cloudData = docSnap.exists() ? docSnap.data() : {};
    
    currentUsername = cloudData.username || user.email.split('@')[0];
    const prefs = cloudData.preferences || {};
    
    myStickers = prefs.stickers || [];
    myFriends = cloudData.friends || [];
    myRequests = cloudData.friendRequests || [];
    
    userAge = cloudData.age || '';
    userGender = cloudData.gender || '';
    userColor = prefs.color || '#d946ef';
    userBubbleColor = prefs.bubbleColor || '#9333ea';
    userBubbleOpacity = prefs.bubbleOpacity || '0.9';
    userStatus = prefs.status || 'Conectado';
    userAvatar = prefs.avatar || 'https://cdn-icons-png.flaticon.com/512/149/149071.png';
    chatBg = prefs.bgLocal || 'Nane.jpg'; 
    useVibration = prefs.vibration !== false; 
    useNotifs = prefs.notifications !== false;
    useLightMode = prefs.lightMode === true;

    initApp();
});

function initApp() {
    if (!userAge || !userGender) {
        document.getElementById('onboardingModal').classList.add('active');
        document.getElementById('onboardStep1').classList.add('active');
        document.getElementById('onboardStep2').classList.remove('active');
    }

    if(useLightMode) document.body.classList.add('light-theme');
    document.getElementById('themeToggle').checked = useLightMode;
    document.getElementById('vibToggle').checked = useVibration; 
    document.getElementById('notifToggle').checked = useNotifs;
    if (chatBg) document.getElementById('chatMessages').style.backgroundImage = `url('${chatBg}')`;

    sendUserData('Lobby'); 
    switchAppView('viewLobby'); 
    renderFriendsUI();
}

let tempGender = '';
document.getElementById('nextOnboardBtn').addEventListener('click', () => {
    if(document.getElementById('onboardAge').value >= 13) {
        document.getElementById('onboardStep1').classList.remove('active'); document.getElementById('onboardStep2').classList.add('active');
    } else showToast("Debes ser mayor de 13 años.", 'error');
});
document.getElementById('backOnboardBtn').addEventListener('click', () => { document.getElementById('onboardStep2').classList.remove('active'); document.getElementById('onboardStep1').classList.add('active'); });
document.querySelectorAll('.gender-btn').forEach(btn => btn.addEventListener('click', () => { document.querySelectorAll('.gender-btn').forEach(b => b.classList.remove('active')); btn.classList.add('active'); tempGender = btn.dataset.gender; }));
document.getElementById('finishOnboardBtn').addEventListener('click', async () => {
    const age = document.getElementById('onboardAge').value;
    if(age && tempGender) {
        try {
            await setDoc(doc(db, "usuarios", currentUserUid), { age: age, gender: tempGender }, { merge: true });
            userAge = age; userGender = tempGender;
            document.getElementById('onboardingModal').classList.remove('active'); sendUserData(); showToast("Perfil completado.");
        } catch(e) { showToast("Error al guardar.", 'error'); }
    } else showToast("Selecciona tu género.", 'error');
});

const switchAppView = (viewId) => {
    document.querySelectorAll('.app-view').forEach(v => v.classList.remove('active'));
    document.querySelectorAll('.nav-item').forEach(n => n.classList.remove('active'));
    const tv = document.getElementById(viewId); if(tv) tv.classList.add('active');
    const btn = document.querySelector(`.nav-item[data-view="${viewId}"]`); if(btn) btn.classList.add('active');
    
    if(viewId === 'viewLobby' && currentRoom !== 'Lobby') {
        currentRoom = 'Lobby'; sendUserData('Lobby');
    }
};
document.querySelectorAll('.bottom-nav .nav-item[data-view]').forEach(btn => btn.addEventListener('click', () => switchAppView(btn.dataset.view)));

document.getElementById('navMyProfileBtn').addEventListener('click', () => {
    document.querySelectorAll('.bottom-nav .nav-item').forEach(n => n.classList.remove('active'));
    document.getElementById('navMyProfileBtn').classList.add('active');
    window.openProfile(currentUsername);
});

document.getElementById('navSettingsBtn').addEventListener('click', () => {
    document.querySelectorAll('.bottom-nav .nav-item').forEach(n => n.classList.remove('active'));
    document.getElementById('navSettingsBtn').classList.add('active');
    document.getElementById('settingsModal').classList.add('active');
});

document.getElementById('closeConfigBtn').addEventListener('click', () => {
    document.getElementById('settingsModal').classList.remove('active');
    const cav = document.querySelector('.app-view.active');
    if(cav) { 
        document.querySelectorAll('.bottom-nav .nav-item').forEach(n => n.classList.remove('active')); 
        const mb = document.querySelector(`.bottom-nav .nav-item[data-view="${cav.id}"]`); 
        if(mb) mb.classList.add('active'); 
    }
});
document.getElementById('logoutBtnCtx').addEventListener('click', () => signOut(auth).then(() => window.location.href = 'index.html'));

const hexToRgba = (hex, op) => { let r=parseInt(hex.slice(1,3),16), g=parseInt(hex.slice(3,5),16), b=parseInt(hex.slice(5,7),16); return `rgba(${r},${g},${b},${op})`; };
const vibrate = (ms) => { if(useVibration && navigator.vibrate) navigator.vibrate(ms); };
const compressImg = (file, cb) => { const r = new FileReader(); r.readAsDataURL(file); r.onload = e => { const i = new Image(); i.src = e.target.result; i.onload = () => { const c = document.createElement('canvas'); const sc = Math.min(800/i.width, 1); c.width = i.width*sc; c.height = i.height*sc; c.getContext('2d').drawImage(i, 0, 0, c.width, c.height); cb(c.toDataURL('image/jpeg', 0.8)); }; }; };

const sendUserData = (room = currentRoom) => {
    socket.emit('joinRoom', { username: currentUsername, email: currentUserEmail, room, color: userColor, avatar: userAvatar, status: userStatus, bubbleBg: userBubbleColor, bubbleOpacity: userBubbleOpacity, age: userAge, gender: userGender });
    checkRoomAdmin(room);
};

const checkRoomAdmin = (rn) => {
    const rd = currentRoomsData.find(r => r.id === rn);
    if(rd) {
        document.getElementById('roomCreator').textContent = rd.creator === 'Sistema' ? 'Sala Oficial' : `Creada por: ${rd.creator}`;
        document.getElementById('deleteRoomBtn').style.display = (rd.creator === currentUsername || isSuperAdmin) && !['General','Programacion','Juegos'].includes(rd.id) ? 'block' : 'none';
    }
};
const enterRoom = (nr, title) => {
    if(currentRoom === nr && nr !== 'Lobby') return;
    currentRoom = nr; document.getElementById('roomTitle').innerHTML = title; document.getElementById('chatMessages').innerHTML = ''; 
    sendUserData(); switchAppView('viewChat');
};
document.getElementById('leaveRoomBtn').addEventListener('click', () => { switchAppView('viewLobby'); });
document.getElementById('joinRoomBtn').addEventListener('click', () => enterRoom(selectedRoomToJoin, `Sala: ${selectedRoomToJoin}`));
document.getElementById('deleteRoomBtn').addEventListener('click', () => { if(confirm(`¿Eliminar sala ${currentRoom}?`)) socket.emit('deleteRoom', { roomName: currentRoom, requesterUser: currentUsername, requesterEmail: currentUserEmail }); });

document.getElementById('dropdownHeader').addEventListener('click', () => document.getElementById('dropdownList').classList.toggle('show'));
document.addEventListener('click', (e) => { if(!e.target.closest('.custom-dropdown')) document.getElementById('dropdownList').classList.remove('show'); });

socket.on('updateRooms', (rooms) => {
    currentRoomsData = rooms; const dl = document.getElementById('dropdownList'); dl.innerHTML = '';
    rooms.forEach(r => {
        if(!r.id.includes('_')) { 
            const li = document.createElement('li'); li.textContent = r.name;
            if(r.id === selectedRoomToJoin) { li.classList.add('active'); document.getElementById('selectedRoomText').textContent = r.name; }
            li.addEventListener('click', () => { selectedRoomToJoin = r.id; document.getElementById('selectedRoomText').textContent = r.name; dl.querySelectorAll('li').forEach(i => i.classList.remove('active')); li.classList.add('active'); dl.classList.remove('show'); });
            dl.appendChild(li);
        }
    });
    checkRoomAdmin(currentRoom);
});
socket.on('forceLeaveRoom', (dr) => { if(currentRoom === dr) { showToast(`Sala eliminada.`); switchAppView('viewLobby'); } });

document.getElementById('createRoomBtn').addEventListener('click', () => {
    const nr = document.getElementById('newRoomInput').value.trim();
    if(nr) { socket.emit('createRoom', { roomName: nr, creator: currentUsername }); document.getElementById('newRoomInput').value = ''; setTimeout(() => { selectedRoomToJoin = nr; enterRoom(nr, `Sala: ${nr}`); }, 300); }
});

document.querySelectorAll('.f-tab').forEach(tab => {
    tab.addEventListener('click', () => {
        const container = tab.closest('.friends-container') || tab.closest('.unified-picker');
        if(container) {
            container.querySelectorAll('.f-tab, .picker-tab').forEach(t => t.classList.remove('active'));
            container.querySelectorAll('.f-list, .picker-content').forEach(l => l.classList.remove('active'));
            tab.classList.add('active');
            document.getElementById(tab.dataset.target).classList.add('active');
        }
    });
});

document.getElementById('bgLocalInput').addEventListener('change', (e) => { if(e.target.files[0]) compressImg(e.target.files[0], (b64) => { chatBg = b64; document.getElementById('chatMessages').style.backgroundImage = `url('${chatBg}')`; saveAppPrefs(); }); });
document.getElementById('resetBgBtn').addEventListener('click', () => { chatBg = 'Nane.jpg'; document.getElementById('chatMessages').style.backgroundImage = `url('${chatBg}')`; saveAppPrefs(); });
document.getElementById('vibToggle').addEventListener('change', (e) => { useVibration = e.target.checked; saveAppPrefs(); });
document.getElementById('notifToggle').addEventListener('change', (e) => { useNotifs = e.target.checked; saveAppPrefs(); });
document.getElementById('themeToggle').addEventListener('change', (e) => { 
    useLightMode = e.target.checked; 
    if(useLightMode) document.body.classList.add('light-theme'); 
    else document.body.classList.remove('light-theme'); 
    saveAppPrefs(); 
});

const saveAppPrefs = async () => {
    try { await setDoc(doc(db, "usuarios", currentUserUid), { preferences: { color: userColor, bubbleColor: userBubbleColor, bubbleOpacity: userBubbleOpacity, status: userStatus, avatar: userAvatar, bgLocal: chatBg, stickers: myStickers, vibration: useVibration, notifications: useNotifs, lightMode: useLightMode } }, { merge: true }); showToast("Ajustes guardados"); } catch(e) {}
};

document.getElementById('editProfileToggleBtn').addEventListener('click', () => {
    const editSec = document.getElementById('dProfileEditSection');
    editSec.style.display = editSec.style.display === 'none' ? 'block' : 'none';
    document.getElementById('colorPicker').value = userColor;
    document.getElementById('bubbleColorPicker').value = userBubbleColor;
    document.getElementById('bubbleOpacity').value = userBubbleOpacity;
    document.getElementById('statusSelect').value = userStatus;
});
document.getElementById('avatarInput').addEventListener('change', (e) => { if(e.target.files[0]) compressImg(e.target.files[0], (b64) => { document.getElementById('dProfileAvatar').src = b64; userAvatar = b64; }); });

document.getElementById('saveProfileBtn').addEventListener('click', async () => {
    const btn = document.getElementById('saveProfileBtn'); btn.textContent = 'Guardando...'; btn.disabled = true;
    userColor = document.getElementById('colorPicker').value; userBubbleColor = document.getElementById('bubbleColorPicker').value; userBubbleOpacity = document.getElementById('bubbleOpacity').value; userStatus = document.getElementById('statusSelect').value;
    
    try { 
        await saveAppPrefs();
        document.querySelectorAll('.my-message').forEach(m => { if (!m.classList.contains('type-image')) m.style.background = hexToRgba(userBubbleColor, userBubbleOpacity); const ns = m.querySelector('.msg-header span'); if(ns) ns.style.color = userColor; });
        sendUserData(); vibrate(100);
        setTimeout(() => { document.getElementById('dProfileEditSection').style.display = 'none'; btn.disabled = false; btn.textContent = 'Guardar Cambios'; window.openProfile(currentUsername); }, 500);
    } catch(e) { showToast("Error al guardar", 'error'); btn.disabled = false; btn.textContent = 'Guardar Cambios'; }
});

document.getElementById('toggleRoomUsersBtn').addEventListener('click', () => document.getElementById('roomUsersPanel').classList.toggle('active'));
document.getElementById('closeRoomUsersBtn').addEventListener('click', () => document.getElementById('roomUsersPanel').classList.remove('active'));

socket.on('updateUserList', (users) => {
    const ul = document.getElementById('roomUsersList');
    ul.innerHTML = users.map(u => `<li class="f-item" style="padding: 10px;" onclick="window.openProfile('${u.username}')"><div style="display:flex; align-items:center; gap:10px;"><img src="${u.avatar}" style="width:35px; height:35px; border-radius:50%; object-fit:cover;"><div><span style="color:${(u.username === currentUsername) ? userColor : (u.color||'#fff')}; font-weight:700; font-size:0.9rem;">${u.username}</span><br><small style="color:var(--text-muted); font-size:0.75rem;">${u.status}</small></div></div></li>`).join('') || '<p style="color:var(--text-muted); text-align:center; font-size:0.8rem;">Solo tú estás aquí.</p>';
});

const up = document.getElementById('unifiedPicker');
document.getElementById('toggleUnifiedPickerBtn').addEventListener('click', () => { up.classList.toggle('active'); if(up.classList.contains('active')) updateStickerMenu(); });
document.querySelectorAll('.picker-tab').forEach(tb => { tb.addEventListener('click', (e) => { e.preventDefault(); document.querySelectorAll('.picker-tab').forEach(t => t.classList.remove('active')); document.querySelectorAll('.picker-content').forEach(c => c.classList.remove('active')); tb.classList.add('active'); document.getElementById(tb.dataset.target).classList.add('active'); }); });

const updateStickerMenu = () => { document.getElementById('stickerResults').innerHTML = myStickers.map(url => `<img src="${url}" onclick="window.sendSticker('${url}')">`).join('') || '<p style="grid-column:span 2; text-align:center; color:var(--text-muted); font-size:0.8rem;">Sin stickers.</p>'; };
window.sendSticker = (url) => { enviarMensaje(url, 'image'); up.classList.remove('active'); };

const emojis = ['😀','😂','🥺','😎','😍','👍','❤️','🔥','🎉','✨','😭','🙏','😅','🤔','🥰','👽','👻','🤖','💩','💀','💅','💃','👀','🧠','👅','🚀','🛸','🎨','🎮','🏆','🍕','🍔','🍟','☕','🍷','⚽','🏀','🎸','💡','💯','💜','✨','💀'];
document.getElementById('emojiPickerContent').innerHTML = emojis.map(e => `<span onclick="document.getElementById('messageInput').value += '${e}'">${e}</span>`).join('');

document.getElementById('doGifSearchBtn').addEventListener('click', async () => {
    const term = document.getElementById('gifSearch').value.trim(); if(!term) return;
    const res = document.getElementById('gifResults'); res.innerHTML = '<p>Buscando...</p>';
    try {
        const req = await fetch(`https://g.tenor.com/v1/search?q=${term}&key=LIVDSRZULELA&limit=12`); const d = await req.json();
        res.innerHTML = d.results.length === 0 ? '<p>No hay resultados.</p>' : '';
        d.results.forEach(g => { const img = document.createElement('img'); img.src = g.media[0].tinygif.url; img.onclick = () => { enviarMensaje(g.media[0].gif.url, 'image'); up.classList.remove('active'); document.getElementById('gifSearch').value='';}; res.appendChild(img); });
    } catch(e) { res.innerHTML = '<p>Error</p>'; }
});

const ctxMenu = document.getElementById('contextMenu'); let pressTimer;
const showContextMenu = (e, msgData) => {
    e.preventDefault(); selectedMsgContext = msgData;
    let x = e.pageX || (e.touches && e.touches[0].pageX); let y = e.pageY || (e.touches && e.touches[0].pageY);
    if(x + 160 > window.innerWidth) x -= 160; if(y + 150 > window.innerHeight) y -= 150;
    ctxMenu.style.left = `${x}px`; ctxMenu.style.top = `${y}px`; ctxMenu.classList.add('active');
    document.getElementById('ctxSaveSticker').style.display = msgData.type === 'image' ? 'flex' : 'none';
    document.getElementById('ctxDelete').style.display = (msgData.username === currentUsername || isSuperAdmin) ? 'flex' : 'none';
    vibrate(50);
};
document.addEventListener('click', (e) => { if(!e.target.closest('.context-menu')) ctxMenu.classList.remove('active'); });

document.getElementById('ctxProfile').addEventListener('click', () => {
    window.openProfile(selectedMsgContext.username);
    ctxMenu.classList.remove('active');
});
document.getElementById('ctxReply').addEventListener('click', () => {
    replyingTo = { username: selectedMsgContext.username, text: selectedMsgContext.text };
    document.getElementById('replyName').textContent = selectedMsgContext.username;
    document.getElementById('replyText').textContent = selectedMsgContext.type === 'image' ? '📷 Imagen' : selectedMsgContext.text;
    document.getElementById('replyPreview').classList.add('active'); document.getElementById('messageInput').focus();
    ctxMenu.classList.remove('active');
});
document.getElementById('ctxSaveSticker').addEventListener('click', () => {
    if(!myStickers.includes(selectedMsgContext.text)) {
        myStickers.push(selectedMsgContext.text); setDoc(doc(db, "usuarios", currentUserUid), { preferences: { stickers: myStickers } }, { merge: true });
        updateStickerMenu(); showToast("Sticker Guardado"); vibrate(100);
    }
    ctxMenu.classList.remove('active');
});
document.getElementById('ctxDelete').addEventListener('click', () => {
    socket.emit('deleteMessage', { room: currentRoom, msgId: selectedMsgContext.msgId, requesterEmail: currentUserEmail });
    ctxMenu.classList.remove('active');
});

window.openProfile = (username) => { viewingProfile = username; socket.emit('getProfile', username); };
const renderFriendsUI = () => {
    const gl = (c, arr, isR) => { document.getElementById(c).innerHTML = arr.map(u => `<li class="f-item"><span onclick="window.openProfile('${u}')" style="cursor:pointer; font-weight:bold; color:var(--text-main); flex:1;">${u}</span>${isR ? `<div><button class="btn-primary" onclick="window.acceptFriend('${u}')" style="padding:5px 10px; font-size:0.8rem; border-radius:8px;">Aceptar</button> <button class="btn-danger-outline" onclick="window.rejectFriend('${u}')" style="padding:5px 10px; font-size:0.8rem;">X</button></div>` : ''}</li>`).join('') || '<p style="color:var(--text-muted); font-size:0.9rem; text-align:center;">Lista vacía.</p>'; };
    gl('myFriendsList', myFriends, false); gl('pendingRequestsList', myRequests, true);
};

socket.on('profileData', (data) => {
    document.getElementById('dProfileName').textContent = data.username; document.getElementById('dProfileName').style.color = data.color || '#fff';
    document.getElementById('adminBadge').style.display = data.isAdmin ? 'inline-block' : 'none';
    
    let sColor = '#22c55e', sText = 'Conectado';
    if(data.status === 'Ausente') { sColor = '#eab308'; sText = 'Ausente'; }
    else if(data.status === 'Ocupado') { sColor = '#ef4444'; sText = 'Ocupado'; }
    else if(data.status === 'Desconectado') { sColor = '#64748b'; sText = 'Desconectado'; }
    document.querySelector('#dProfileStatusBadge .status-dot').style.background = sColor;
    document.querySelector('#dProfileStatusBadge .status-text').textContent = sText;
    
    document.getElementById('dProfileAvatar').src = data.avatar || 'https://cdn-icons-png.flaticon.com/512/149/149071.png';
    document.getElementById('dProfileBanner').style.background = `linear-gradient(135deg, ${data.color || '#d946ef'}, #18181b)`;
    document.getElementById('dProfileDetails').innerHTML = `${data.age ? data.age + ' años' : ''} ${data.gender === 'Masculino' ? '🙋‍♂️' : (data.gender === 'Femenino' ? '🙋‍♀️' : '🦄')}`;
    
    const dBtn = document.getElementById('dProfileDMBtn'), aBtn = document.getElementById('dProfileAddFriendBtn'), editBtn = document.getElementById('editProfileToggleBtn');
    
    if(data.username === currentUsername) { 
        dBtn.style.display = 'none'; 
        aBtn.style.display = 'none'; 
        editBtn.style.display = 'inline-block';
    } else {
        dBtn.style.display = 'block'; dBtn.onclick = () => { document.getElementById('discordProfileModal').classList.remove('active'); enterRoom([currentUsername, data.username].sort().join('_'), `<i class="fas fa-lock" style="color:${data.color};"></i> DM: ${data.username}`); };
        if(myFriends.includes(data.username)) { aBtn.innerHTML = '<i class="fas fa-user-check"></i> Amigo'; aBtn.disabled = true; }
        else { aBtn.innerHTML = '<i class="fas fa-user-plus"></i> Añadir'; aBtn.disabled = false; aBtn.onclick = () => { socket.emit('sendFriendRequest', { from: currentUsername, to: data.username }); aBtn.innerHTML = "Enviada"; aBtn.disabled = true; }; }
        aBtn.style.display = 'block';
        editBtn.style.display = 'none';
    }
    const wall = document.getElementById('dProfileComments');
    wall.innerHTML = data.comments.map(c => `<div class="d-comment"><b style="color:var(--accent);">${c.from}</b> <span>${c.time} ${(data.username === currentUsername || isSuperAdmin) ? `<i class="fas fa-trash" style="color:var(--danger); cursor:pointer; margin-left:5px;" onclick="socket.emit('deleteComment', {targetUser:'${data.username}', commentId:'${c.id}', requesterUser:'${currentUsername}', requesterEmail:'${currentUserEmail}'})"></i>` : ''}</span><p>${c.text}</p></div>`).join('') || '<p style="color:var(--text-muted); font-size:0.9rem; text-align:center;">Muro vacío.</p>';
    document.getElementById('discordProfileModal').classList.add('active');
    document.getElementById('dProfileEditSection').style.display = 'none'; 
});

document.getElementById('dCommentBtn').addEventListener('click', () => { const text = document.getElementById('dCommentText').value.trim(); if(text && viewingProfile) { socket.emit('addComment', { targetUser: viewingProfile, from: currentUsername, text, time: new Date().toLocaleDateString() }); document.getElementById('dCommentText').value = ''; } });
socket.on('newProfileComment', (data) => { if(viewingProfile === data.targetUser) socket.emit('getProfile', viewingProfile); });
document.getElementById('closeDiscordProfileBtn').addEventListener('click', () => {
    document.getElementById('discordProfileModal').classList.remove('active');
    const cav = document.querySelector('.app-view.active');
    if(cav && document.getElementById('navMyProfileBtn').classList.contains('active')) {
        document.querySelectorAll('.bottom-nav .nav-item').forEach(n => n.classList.remove('active')); 
        const mb = document.querySelector(`.bottom-nav .nav-item[data-view="${cav.id}"]`); 
        if(mb) mb.classList.add('active'); 
    }
});

socket.on('friendRequestReceived', ({ from, to }) => { if(to === currentUsername && !myRequests.includes(from) && !myFriends.includes(from)) { myRequests.push(from); setDoc(doc(db, "usuarios", currentUserUid), { friendRequests: myRequests }, { merge: true }); vibrate(200); renderFriendsUI(); }});
window.acceptFriend = (rU) => { myFriends.push(rU); myRequests = myRequests.filter(r => r !== rU); setDoc(doc(db, "usuarios", currentUserUid), { friendRequests: myRequests, friends: myFriends }, { merge: true }); socket.emit('acceptFriendRequest', { from: currentUsername, to: rU }); renderFriendsUI(); };
window.rejectFriend = (rU) => { myRequests = myRequests.filter(r => r !== rU); setDoc(doc(db, "usuarios", currentUserUid), { friendRequests: myRequests }, { merge: true }); renderFriendsUI(); };
socket.on('friendRequestAccepted', ({ from, to }) => { if(to === currentUsername && !myFriends.includes(from)) { myFriends.push(from); setDoc(doc(db, "usuarios", currentUserUid), { friends: myFriends }, { merge: true }); renderFriendsUI(); }});

socket.on('updateGlobalUsers', (users) => {
    document.getElementById('globalUsersList').innerHTML = users.map(u => `<li class="f-item" style="padding: 10px;" onclick="window.openProfile('${u.username}')"><div style="display:flex; align-items:center; gap:10px;"><img src="${u.avatar}" style="width:35px; height:35px; border-radius:50%; object-fit:cover;"><div><span style="color:${(u.username === currentUsername) ? userColor : (u.color||'#fff')}; font-weight:700;">${u.username}</span><br><small style="color:var(--text-muted);">${u.status}</small></div></div></li>`).join('') || '<p style="color:var(--text-muted); text-align:center;">Nadie aquí.</p>';
});

const enviarMensaje = (texto, tipo = 'text') => {
    if (!texto) return;
    socket.emit('chatMessage', { username: currentUsername, text: texto, type: tipo, room: currentRoom, color: userColor, avatar: userAvatar, bubbleBg: userBubbleColor, bubbleOpacity: userBubbleOpacity, reply: replyingTo, time: new Date().toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'}) });
    document.getElementById('cancelReplyBtn').click(); 
};

document.getElementById('chatForm').addEventListener('submit', (e) => { e.preventDefault(); enviarMensaje(document.getElementById('messageInput').value.trim(), 'text'); document.getElementById('messageInput').value = ''; });
document.addEventListener('paste', (e) => { const items = e.clipboardData.items; for (let i=0; i<items.length; i++) { if (items[i].type.indexOf('image') !== -1) { const blob = items[i].getAsFile(); if (blob.type === 'image/gif') { const r = new FileReader(); r.readAsDataURL(blob); r.onload = (ev) => enviarMensaje(ev.target.result, 'image'); } else { compressImg(blob, (b64) => enviarMensaje(b64, 'image')); } } } });
document.getElementById('fileInput').addEventListener('change', (e) => { const file = e.target.files[0]; if(file) { if (file.type === 'image/gif') { const r = new FileReader(); r.readAsDataURL(file); r.onload = (ev) => enviarMensaje(ev.target.result, 'image'); } else { compressImg(file, (b64) => enviarMensaje(b64, 'image')); } } });
socket.on('messageDeleted', (msgId) => { const m = document.getElementById(`msg-${msgId}`); if(m) m.remove(); });

socket.on('loadHistory', (history) => { const cm = document.getElementById('chatMessages'); cm.innerHTML = ''; history.forEach(msg => renderMessage(msg)); cm.scrollTop = cm.scrollHeight; });

const renderMessage = (msg) => {
    const div = document.createElement('div'); div.id = `msg-${msg.msgId}`;
    const isMe = msg.username === currentUsername;
    div.className = `message ${isMe ? 'my-message' : ''} ${msg.type === 'image' ? 'type-image' : ''}`;
    
    const cBg = isMe ? userBubbleColor : (msg.bubbleBg || '#9333ea');
    const cOp = isMe ? userBubbleOpacity : (msg.bubbleOpacity || 1);
    const cNameColor = isMe ? userColor : msg.color;

    if (msg.type !== 'image') { div.style.background = hexToRgba(cBg, cOp); if (!isMe) div.style.border = `1px solid ${cBg}`; }

    let rHtml = ''; if (msg.reply) rHtml = `<div class="quoted-message" style="border-left-color: ${isMe ? '#fff' : cNameColor};"><strong style="color: ${isMe ? '#fff' : cNameColor};">${msg.reply.username}</strong><p>${msg.reply.text.startsWith('data:') || msg.reply.text.startsWith('http') ? '📷 Imagen' : msg.reply.text}</p></div>`;

    let content = '';
    if (msg.type === 'image') content = `<img src="${msg.text}" class="msg-image compact-img" onclick="document.getElementById('lightboxImg').src=this.src; document.getElementById('lightboxModal').classList.add('active');">`;
    else if (msg.type === 'audio') content = `<audio controls src="${msg.text}" class="msg-audio"></audio>`;
    else content = `<p class="text">${msg.text}</p>`;

    div.innerHTML = `<div class="msg-header" onclick="window.openProfile('${msg.username}')" style="cursor:pointer;"><img src="${msg.avatar}" class="msg-avatar"><span style="color: ${cNameColor}; font-weight: 800;">${msg.username}</span></div>${rHtml} ${content} <div class="msg-footer"><span class="time">${msg.time}</span></div>`;
    
    div.addEventListener('contextmenu', (e) => showContextMenu(e, msg));
    div.addEventListener('touchstart', (e) => { pressTimer = window.setTimeout(() => showContextMenu(e, msg), 600); });
    div.addEventListener('touchend', () => clearTimeout(pressTimer)); div.addEventListener('touchmove', () => clearTimeout(pressTimer));

    const cm = document.getElementById('chatMessages'); cm.appendChild(div); cm.scrollTop = cm.scrollHeight;
    if(!isMe && useNotifs) { document.getElementById('notificationSound').play().catch(()=>{}); vibrate(150); }
};
socket.on('message', renderMessage);

document.getElementById('searchInput').addEventListener('input', (e) => { const term = e.target.value.toLowerCase(); document.querySelectorAll('.message').forEach(m => { m.style.display = (m.querySelector('.text')?.innerText.toLowerCase() || '').includes(term) ? 'block' : 'none'; }); });

document.getElementById('cancelReplyBtn').addEventListener('click', () => { replyingTo = null; document.getElementById('replyPreview').classList.remove('active'); });