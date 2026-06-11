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
let currentRoom = 'Lobby', currentRoomsData = [];
let replyingTo = null, viewingProfile = null, selectedMsgContext = null;
let mediaRecorder, audioChunks = []; 

let userAge, userGender, userColor, userBubbleColor, userBubbleOpacity, userStatus, userAvatar, chatBg, useVibration, useNotifs, useLightMode;
let myStickers = [], myFriends = [], myRequests = [], myRooms = [], mutedRooms = [];

// ==========================================
// SEGURIDAD GLOBAL: SANITIZACIÓN ANTI-XSS
// ==========================================
const escapeHTML = (str) => {
    if(typeof str !== 'string') return '';
    return str.replace(/[&<>'"]/g, tag => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;' }[tag] || tag));
};

const showToast = (msg, type = 'success') => {
    const toast = document.getElementById('toastNotification');
    if(toast) { toast.textContent = msg; toast.className = `toast show ${type}`; setTimeout(() => { toast.classList.remove('show'); }, 3000); }
};
const hexToRgba = (hex, op) => { let r=parseInt(hex.slice(1,3),16), g=parseInt(hex.slice(3,5),16), b=parseInt(hex.slice(5,7),16); return `rgba(${r},${g},${b},${op})`; };
const vibrate = (ms) => { if(useVibration && navigator.vibrate) navigator.vibrate(ms); };
const compressImg = (file, cb) => { const r = new FileReader(); r.readAsDataURL(file); r.onload = e => { const i = new Image(); i.src = e.target.result; i.onload = () => { const c = document.createElement('canvas'); const sc = Math.min(800/i.width, 1); c.width = i.width*sc; c.height = i.height*sc; c.getContext('2d').drawImage(i, 0, 0, c.width, c.height); cb(c.toDataURL('image/jpeg', 0.8)); }; }; };

const safeAddListener = (id, event, handler) => {
    const el = document.getElementById(id);
    if (el) el.addEventListener(event, handler);
};

// ==========================================
// MÉTODOS GLOBALES FIJOS (UI)
// ==========================================
window.ui = {
    openProfile: (username) => {
        if(!username) return;
        viewingProfile = username; 
        socket.emit('getProfile', username); 
    },
    applyBackground: (bgUrl) => {
        const cm = document.getElementById('chatMessages');
        if(!cm) return;
        if(!bgUrl || bgUrl === 'Nane.jpg') {
            cm.style.cssText = ''; 
        } else {
            cm.style.cssText = `background-image: url('${bgUrl}'); background-size: cover !important; background-position: center !important; background-repeat: no-repeat !important; background-attachment: fixed !important;`;
        }
    },
    switchView: (viewId, btnElement) => {
        document.querySelectorAll('.app-view').forEach(v => v.classList.remove('active'));
        document.querySelectorAll('.bottom-nav .nav-item').forEach(n => n.classList.remove('active'));
        const tv = document.getElementById(viewId); if(tv) tv.classList.add('active');
        if(btnElement) btnElement.classList.add('active');
        if(viewId === 'viewLobby' && currentRoom !== 'Lobby') {
            currentRoom = 'Lobby'; socket.emit('joinRoom', { uid: currentUserUid, username: currentUsername, email: currentUserEmail, room: currentRoom, color: userColor, avatar: userAvatar, status: userStatus, bubbleBg: userBubbleColor, bubbleOpacity: userBubbleOpacity });
        }
    },
    scrollToMessage: (msgId) => {
        const el = document.getElementById('msg-'+msgId);
        if(el) {
            el.scrollIntoView({behavior: 'smooth', block: 'center'});
            el.classList.add('highlight-msg');
            setTimeout(() => el.classList.remove('highlight-msg'), 2000);
        }
    }
};

// Delegación global para perfiles (Infalible)
document.addEventListener('click', (e) => {
    const target = e.target.closest('[data-profile]');
    if (target) {
        let username = target.getAttribute('data-profile');
        if(username === 'me') username = currentUsername;
        if(username) {
            window.ui.openProfile(username);
            const isNavBtn = target.closest('.nav-item');
            if(isNavBtn) {
                document.querySelectorAll('.bottom-nav .nav-item').forEach(n => n.classList.remove('active'));
                isNavBtn.classList.add('active');
            }
        }
    }
});

// ==========================================
// INICIO Y CONFIGURACIÓN (CON PRIMARY KEY UID)
// ==========================================
onAuthStateChanged(auth, async (user) => {
    if (!user) return window.location.href = 'index.html';
    
    currentUserUid = user.uid; // Primary Key
    currentUserEmail = user.email;
    isSuperAdmin = currentUserEmail === SUPER_ADMIN_EMAIL;
    
    const docSnap = await getDoc(doc(db, "usuarios", user.uid));
    const cloudData = docSnap.exists() ? docSnap.data() : {};
    
    currentUsername = cloudData.username || user.email.split('@')[0];
    const prefs = cloudData.preferences || {};
    
    myStickers = prefs.stickers || [];
    myFriends = cloudData.friends || [];
    myRequests = cloudData.friendRequests || [];
    myRooms = prefs.rooms || ['General']; 
    mutedRooms = prefs.mutedRooms || [];
    
    userAge = cloudData.age || '';
    userGender = cloudData.gender || '';
    userColor = prefs.color || '#d946ef';
    userBubbleColor = prefs.bubbleColor || '#9333ea';
    userBubbleOpacity = prefs.bubbleOpacity || '0.9';
    userStatus = prefs.status || 'Conectado';
    userAvatar = prefs.avatar || 'https://cdn-icons-png.flaticon.com/512/149/149071.png';
    chatBg = prefs.bgLocal || ''; 
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

    if(useLightMode) { document.documentElement.classList.add('light-theme'); localStorage.setItem('nani_theme', 'light'); } 
    else { document.documentElement.classList.remove('light-theme'); localStorage.setItem('nani_theme', 'dark'); }
    
    const tt = document.getElementById('themeToggle'); if(tt) tt.checked = useLightMode;
    const vt = document.getElementById('vibToggle'); if(vt) vt.checked = useVibration;
    const nt = document.getElementById('notifToggle'); if(nt) nt.checked = useNotifs;
    
    if (chatBg) window.ui.applyBackground(chatBg);

    sendUserData('Lobby'); 
    window.ui.switchView('viewLobby', document.querySelector('.bottom-nav .nav-item[data-view="viewLobby"]'));
    renderFriendsUI();
    renderMyRoomsUI();
}

const saveAppPrefs = async () => {
    try { await setDoc(doc(db, "usuarios", currentUserUid), { preferences: { color: userColor, bubbleColor: userBubbleColor, bubbleOpacity: userBubbleOpacity, status: userStatus, avatar: userAvatar, bgLocal: chatBg, rooms: myRooms, mutedRooms: mutedRooms, stickers: myStickers, vibration: useVibration, notifications: useNotifs, lightMode: useLightMode } }, { merge: true }); } catch(e) {}
};

// ==========================================
// VISTAS Y NAVEGACIÓN
// ==========================================
document.querySelectorAll('.bottom-nav .nav-item[data-view]').forEach(btn => {
    btn.addEventListener('click', () => window.ui.switchView(btn.dataset.view, btn));
});

safeAddListener('navSettingsBtn', 'click', () => {
    document.querySelectorAll('.bottom-nav .nav-item').forEach(n => n.classList.remove('active'));
    document.getElementById('navSettingsBtn').classList.add('active');
    document.getElementById('settingsModal').classList.add('active');
});

safeAddListener('closeConfigBtn', 'click', () => {
    document.getElementById('settingsModal').classList.remove('active');
    const cav = document.querySelector('.app-view.active');
    if(cav) { 
        document.querySelectorAll('.bottom-nav .nav-item').forEach(n => n.classList.remove('active')); 
        const mb = document.querySelector(`.bottom-nav .nav-item[data-view="${cav.id}"]`); 
        if(mb) mb.classList.add('active'); 
    }
});
safeAddListener('logoutBtnCtx', 'click', () => signOut(auth).then(() => window.location.href = 'index.html'));

const sendUserData = (room = currentRoom) => {
    socket.emit('joinRoom', { uid: currentUserUid, username: currentUsername, email: currentUserEmail, room, color: userColor, avatar: userAvatar, status: userStatus, bubbleBg: userBubbleColor, bubbleOpacity: userBubbleOpacity });
};

// ==========================================
// SALAS Y MEMBRESÍA
// ==========================================
const checkRoomMembership = () => {
    if(currentRoom === 'Lobby') return;
    if (myRooms.includes(currentRoom)) {
        document.getElementById('chatForm').style.display = 'flex';
        document.getElementById('joinRoomPrompt').style.display = 'none';
    } else {
        document.getElementById('chatForm').style.display = 'none';
        document.getElementById('joinRoomPrompt').style.display = 'flex';
    }
};

window.enterRoomDirect = (nr) => {
    if(currentRoom === nr && nr !== 'Lobby') return;
    currentRoom = nr; 
    const elT = document.getElementById('roomTitle'); if(elT) elT.innerHTML = escapeHTML(nr);
    document.getElementById('chatMessages').innerHTML = ''; 
    checkRoomMembership();
    sendUserData(); 
    window.ui.switchView('viewChat', null);
    socket.emit('getRoomProfile', currentRoom);
};

safeAddListener('btnJoinCurrentRoom', 'click', () => {
    if (!myRooms.includes(currentRoom)) {
        myRooms.push(currentRoom);
        saveAppPrefs();
        checkRoomMembership();
        renderMyRoomsUI();
        showToast("¡Te has unido a la sala!");
    }
});

safeAddListener('leaveRoomBtnActual', 'click', () => {
    if(confirm("¿Seguro que deseas abandonar esta sala?")){
        myRooms = myRooms.filter(r => r !== currentRoom);
        saveAppPrefs();
        renderMyRoomsUI();
        document.getElementById('roomProfileModal').classList.remove('active');
        window.ui.switchView('viewLobby', document.querySelector('.bottom-nav .nav-item[data-view="viewLobby"]'));
    }
});

// Menú Chat (3 puntitos)
safeAddListener('btnChatMenuToggle', 'click', () => { document.getElementById('chatMenuDropdown').classList.toggle('show'); });
document.addEventListener('click', (e) => { 
    if(!e.target.closest('.custom-dropdown')) { const d = document.getElementById('chatMenuDropdown'); if(d) d.classList.remove('show'); }
});
safeAddListener('menuRoomInfo', 'click', () => {
    document.getElementById('chatMenuDropdown').classList.remove('show');
    socket.emit('getRoomProfile', currentRoom);
    document.getElementById('roomProfileModal').classList.add('active');
});
safeAddListener('menuClearChatLocal', 'click', () => {
    document.getElementById('chatMenuDropdown').classList.remove('show');
    document.getElementById('chatMessages').innerHTML = '';
    showToast("Chat local vaciado");
});

// Cambiar Fondo Modal
let tempBgData = null;
safeAddListener('menuChangeBg', 'click', () => {
    document.getElementById('chatMenuDropdown').classList.remove('show');
    document.getElementById('bgLocalInputChat').click();
});
safeAddListener('menuResetBg', 'click', () => {
    document.getElementById('chatMenuDropdown').classList.remove('show');
    chatBg = ''; window.ui.applyBackground(chatBg); saveAppPrefs(); showToast("Fondo quitado.");
});
safeAddListener('bgLocalInputChat', 'change', (e) => {
    if(e.target.files[0]) compressImg(e.target.files[0], (b64) => {
        tempBgData = b64;
        document.getElementById('bgPreviewContainer').style.backgroundImage = `url('${b64}')`;
        document.getElementById('bgPreviewModal').classList.add('active');
    });
});
safeAddListener('cancelBgBtn', 'click', () => {
    document.getElementById('bgPreviewModal').classList.remove('active');
    tempBgData = null;
});
safeAddListener('applyBgBtn', 'click', () => {
    if(tempBgData) { chatBg = tempBgData; window.ui.applyBackground(chatBg); saveAppPrefs(); showToast("Fondo Aplicado."); }
    document.getElementById('bgPreviewModal').classList.remove('active');
});

const renderMyRoomsUI = () => {
    const list = document.getElementById('myJoinedRoomsList');
    if(!list) return;
    list.innerHTML = myRooms.map(rName => {
        const rData = currentRoomsData.find(rm => rm.id === rName) || { name: rName, avatar: 'https://cdn-icons-png.flaticon.com/512/1370/1370907.png', creator: 'Sistema' };
        return `<li class="f-item" style="cursor:pointer;" onclick="window.enterRoomDirect('${escapeHTML(rName)}')">
            <div style="display:flex; align-items:center; gap:12px;">
                <img src="${rData.avatar || 'https://cdn-icons-png.flaticon.com/512/1370/1370907.png'}" onerror="this.src='https://cdn-icons-png.flaticon.com/512/1370/1370907.png'" style="width:45px; height:45px; border-radius:14px; object-fit:cover;">
                <div style="display:flex; flex-direction:column;">
                    <span style="font-weight:700; color:var(--text-main); font-size:1.05rem;">${escapeHTML(rData.name)}</span>
                    <span style="color:var(--text-muted); font-size:0.75rem;">${escapeHTML(rData.creator)}</span>
                </div>
            </div>
            <i class="fas fa-chevron-right" style="color:var(--accent);"></i>
        </li>`;
    }).join('') || '<p style="color:var(--text-muted); text-align:center;">No te has unido a ninguna sala aún.</p>';
};

// ==========================================
// BÚSQUEDA Y CREACIÓN DE SALAS
// ==========================================
safeAddListener('searchRoomInput', 'input', (e) => {
    const term = e.target.value.toLowerCase();
    document.querySelectorAll('#dropdownList li').forEach(li => {
        li.style.display = li.textContent.toLowerCase().includes(term) ? 'flex' : 'none';
    });
});

socket.on('updateRooms', (rooms) => {
    currentRoomsData = rooms; 
    renderMyRoomsUI(); 
    const dl = document.getElementById('dropdownList'); 
    if(!dl) return;
    dl.innerHTML = '';
    rooms.forEach(r => {
        if(!r.id.includes('_')) { 
            const safeRName = escapeHTML(r.name);
            const safeCreator = escapeHTML(r.creator);
            const userC = r.userCount || 0; 
            const li = document.createElement('li'); 
            li.innerHTML = `<img src="${r.avatar || 'https://cdn-icons-png.flaticon.com/512/1370/1370907.png'}" onerror="this.src='https://cdn-icons-png.flaticon.com/512/1370/1370907.png'" style="width:40px; height:40px; border-radius:12px; object-fit:cover; margin-right:12px;"> <div style="display:flex; flex-direction:column; flex:1;"><span style="font-weight:600;">${safeRName}</span><span style="color:var(--text-muted); font-size:0.7rem;">Por: ${safeCreator} &bull; <i class="fas fa-user" style="color:var(--accent);"></i> ${userC} online</span></div> <i class="fas fa-sign-in-alt" style="color:var(--accent);"></i>`;
            li.style.display = 'flex'; li.style.alignItems = 'center'; li.style.background = 'var(--input-bg)'; li.style.marginBottom = '8px'; li.style.padding = '10px'; li.style.borderRadius = '12px';
            li.addEventListener('click', () => window.enterRoomDirect(r.id));
            dl.appendChild(li);
        }
    });
});

safeAddListener('createRoomBtn', 'click', () => {
    const el = document.getElementById('newRoomInput');
    if(!el) return;
    const nr = escapeHTML(el.value.trim()).substring(0, 30);
    if(nr) { 
        socket.emit('createRoom', { roomName: nr, creator: currentUsername, uid: currentUserUid }); 
        el.value = ''; 
        // Auto-unirse al crear
        if(!myRooms.includes(nr)) { myRooms.push(nr); saveAppPrefs(); }
        setTimeout(() => { window.enterRoomDirect(nr); }, 300); 
    }
});

// ==========================================
// PERFIL DE SALA (CONFIGURACIÓN)
// ==========================================
safeAddListener('openRoomProfileBtn', 'click', () => {
    socket.emit('getRoomProfile', currentRoom);
    document.getElementById('roomProfileModal').classList.add('active');
});

let tempRoomAvatar = null;
socket.on('roomProfileData', (rd) => {
    try {
        const rt = document.getElementById('roomTitle');
        if(rt) rt.innerHTML = `<img src="${rd.avatar || 'https://cdn-icons-png.flaticon.com/512/1370/1370907.png'}" onerror="this.src='https://cdn-icons-png.flaticon.com/512/1370/1370907.png'" style="width:30px; height:30px; border-radius:10px; object-fit:cover;"> ${escapeHTML(rd.name)}`;
        const rc = document.getElementById('roomCreator'); if(rc) rc.textContent = `por ${escapeHTML(rd.creator)}`;
        
        // El creador es el rey
        const canEdit = (rd.uid === currentUserUid || rd.creator === currentUsername || isSuperAdmin);
        const brs = document.getElementById('btnRoomSettings'); if(brs) brs.style.display = canEdit ? 'block' : 'none';
        
        document.getElementById('rProfileAvatar').src = rd.avatar || 'https://cdn-icons-png.flaticon.com/512/1370/1370907.png';
        document.getElementById('rProfileName').textContent = escapeHTML(rd.name);
        document.getElementById('rProfileCreator').textContent = `Creador: ${escapeHTML(rd.creator)}`;
        document.getElementById('rProfileDesc').textContent = rd.description ? escapeHTML(rd.description) : "Una sala para conversar de todo un poco.";
        
        // Switch de Silencio
        const mt = document.getElementById('muteRoomToggle');
        if(mt) mt.checked = mutedRooms.includes(rd.name);

        const editSec = document.getElementById('rProfileEditSection');
        if (canEdit) {
            editSec.style.display = 'block';
            document.getElementById('rEditDesc').value = rd.description ? escapeHTML(rd.description) : "";
            tempRoomAvatar = rd.avatar;
        } else {
            editSec.style.display = 'none';
        }
    } catch(err) { console.error("Error cargando sala:", err); }
});
safeAddListener('closeRoomProfileBtn', 'click', () => { document.getElementById('roomProfileModal').classList.remove('active'); });

safeAddListener('rEditAvatarInput', 'change', (e) => {
    if(e.target.files[0]) compressImg(e.target.files[0], (b64) => { document.getElementById('rProfileAvatar').src = b64; tempRoomAvatar = b64; });
});

safeAddListener('saveRoomProfileBtn', 'click', () => {
    const nDesc = escapeHTML(document.getElementById('rEditDesc').value);
    socket.emit('updateRoomProfile', { roomName: currentRoom, description: nDesc, avatar: tempRoomAvatar, requesterUid: currentUserUid });
    showToast("Sala actualizada");
});

safeAddListener('deleteRoomBtnActual', 'click', () => {
    if(confirm(`¿Seguro que deseas ELIMINAR GLOBALMENTE la sala ${currentRoom}?`)) {
        socket.emit('deleteRoom', { roomName: currentRoom, requesterUid: currentUserUid, requesterEmail: currentUserEmail, requesterUser: currentUsername });
        document.getElementById('roomProfileModal').classList.remove('active');
    }
});
socket.on('forceLeaveRoom', (dr) => { 
    if(currentRoom === dr) { showToast(`La sala fue eliminada globalmente.`); window.ui.switchView('viewLobby', document.querySelector('.bottom-nav .nav-item[data-view="viewLobby"]')); } 
    myRooms = myRooms.filter(r => r !== dr);
    saveAppPrefs();
    renderMyRoomsUI();
});

safeAddListener('muteRoomToggle', 'change', (e) => {
    if(e.target.checked) { if(!mutedRooms.includes(currentRoom)) mutedRooms.push(currentRoom); }
    else { mutedRooms = mutedRooms.filter(r => r !== currentRoom); }
    saveAppPrefs();
});

// ==========================================
// TABS GENÉRICOS Y AJUSTES APP
// ==========================================
document.querySelectorAll('.picker-tab, .f-tab').forEach(tab => {
    tab.addEventListener('click', (e) => {
        // Uso closest para asegurar que el clic agarre el botón, incluso si tocan el icono dentro
        const realTab = e.target.closest('button');
        if(!realTab) return;
        const container = realTab.closest('.friends-container') || realTab.closest('.unified-picker');
        if(container) {
            container.querySelectorAll('.f-tab, .picker-tab').forEach(t => t.classList.remove('active'));
            container.querySelectorAll('.f-list, .picker-content').forEach(l => l.classList.remove('active'));
            realTab.classList.add('active');
            document.getElementById(realTab.dataset.target).classList.add('active');
        }
    });
});

safeAddListener('themeToggle', 'change', (e) => { 
    useLightMode = e.target.checked; 
    if(useLightMode) { document.documentElement.classList.add('light-theme'); localStorage.setItem('nani_theme', 'light'); } 
    else { document.documentElement.classList.remove('light-theme'); localStorage.setItem('nani_theme', 'dark'); }
    saveAppPrefs(); 
});
safeAddListener('vibToggle', 'change', (e) => { useVibration = e.target.checked; saveAppPrefs(); });
safeAddListener('notifToggle', 'change', (e) => { useNotifs = e.target.checked; saveAppPrefs(); });

// SLIDER DE TRANSPARENCIA VIBRATORIO
safeAddListener('bubbleOpacity', 'input', (e) => { vibrate(15); });

safeAddListener('editProfileToggleBtn', 'click', () => {
    const editSec = document.getElementById('dProfileEditSection');
    editSec.style.display = editSec.style.display === 'none' ? 'block' : 'none';
    document.getElementById('colorPicker').value = userColor;
    document.getElementById('bubbleColorPicker').value = userBubbleColor;
    document.getElementById('bubbleOpacity').value = userBubbleOpacity;
    document.getElementById('statusSelect').value = userStatus;
});
safeAddListener('avatarInput', 'change', (e) => { if(e.target.files[0]) compressImg(e.target.files[0], (b64) => { document.getElementById('dProfileAvatar').src = b64; userAvatar = b64; }); });

safeAddListener('saveProfileBtn', 'click', async () => {
    const btn = document.getElementById('saveProfileBtn'); btn.textContent = 'Guardando...'; btn.disabled = true;
    userColor = document.getElementById('colorPicker').value; userBubbleColor = document.getElementById('bubbleColorPicker').value; userBubbleOpacity = document.getElementById('bubbleOpacity').value; userStatus = document.getElementById('statusSelect').value;
    
    try { 
        await saveAppPrefs();
        document.querySelectorAll('.my-message').forEach(m => { if (!m.classList.contains('type-image')) m.style.background = hexToRgba(userBubbleColor, userBubbleOpacity); const ns = m.querySelector('.msg-header span'); if(ns) ns.style.color = userColor; });
        sendUserData(); vibrate(100);
        setTimeout(() => { document.getElementById('dProfileEditSection').style.display = 'none'; btn.disabled = false; btn.textContent = 'Guardar Cambios'; window.ui.openProfile(currentUsername); }, 500);
    } catch(e) { showToast("Error al guardar", 'error'); btn.disabled = false; btn.textContent = 'Guardar Cambios'; }
});

// ==========================================
// RENDERIZADO DEL PERFIL
// ==========================================
socket.on('profileData', (data) => {
    try {
        document.getElementById('dProfileName').textContent = escapeHTML(data.username); 
        document.getElementById('dProfileName').style.color = data.color || '#fff';
        
        const shortUid = data.uid ? `#${data.uid.substring(0, 6).toUpperCase()}` : '#XXXXXX';
        const elUid = document.getElementById('dProfileUid');
        if(elUid) elUid.textContent = shortUid;

        const adBadge = document.getElementById('adminBadge');
        if(adBadge) adBadge.style.display = data.isAdmin ? 'inline-block' : 'none';
        
        let sColor = '#22c55e', sText = 'Conectado';
        if(data.status === 'Ausente') { sColor = '#eab308'; sText = 'Ausente'; }
        else if(data.status === 'Ocupado') { sColor = '#ef4444'; sText = 'Ocupado'; }
        else if(data.status === 'Desconectado') { sColor = '#64748b'; sText = 'Desconectado'; }
        
        const sd = document.querySelector('#dProfileStatusBadge .status-dot');
        if(sd) sd.style.background = sColor;
        const st = document.querySelector('#dProfileStatusBadge .status-text');
        if(st) st.textContent = sText;
        
        document.getElementById('dProfileAvatar').src = data.avatar || 'https://cdn-icons-png.flaticon.com/512/149/149071.png';
        document.getElementById('dProfileBanner').style.background = `linear-gradient(135deg, ${data.color || '#d946ef'}, #18181b)`;
        
        const dBtn = document.getElementById('dProfileDMBtn'), aBtn = document.getElementById('dProfileAddFriendBtn'), editBtn = document.getElementById('editProfileToggleBtn');
        
        if(data.username === currentUsername) { 
            if(dBtn) dBtn.style.display = 'none'; 
            if(aBtn) aBtn.style.display = 'none'; 
            if(editBtn) editBtn.style.display = 'inline-block';
        } else {
            if(dBtn) {
                dBtn.style.display = 'block'; 
                dBtn.onclick = () => { document.getElementById('discordProfileModal').classList.remove('active'); window.enterRoomDirect([currentUsername, data.username].sort().join('_')); };
            }
            if(aBtn) {
                aBtn.style.display = 'block'; 
                if(myFriends.includes(data.username)) { aBtn.innerHTML = '<i class="fas fa-user-check"></i> Amigo'; aBtn.disabled = true; }
                else { aBtn.innerHTML = '<i class="fas fa-user-plus"></i> Añadir'; aBtn.disabled = false; aBtn.onclick = () => { socket.emit('sendFriendRequest', { from: currentUsername, to: data.username }); aBtn.innerHTML = "Enviada"; aBtn.disabled = true; }; }
            }
            if(editBtn) editBtn.style.display = 'none';
        }
        
        const wall = document.getElementById('dProfileComments');
        if(wall) {
            wall.innerHTML = data.comments.map(c => `<div class="d-comment"><b style="color:var(--accent);">${escapeHTML(c.from)}</b> <span>${c.time} ${(data.username === currentUsername || isSuperAdmin) ? `<i class="fas fa-trash" style="color:var(--danger); cursor:pointer; margin-left:5px;" onclick="socket.emit('deleteComment', {targetUser:'${data.username}', commentId:'${c.id}', requesterUid:'${currentUserUid}', requesterEmail:'${currentUserEmail}'})"></i>` : ''}</span><p>${escapeHTML(c.text)}</p></div>`).join('') || '<p style="color:var(--text-muted); font-size:0.9rem; text-align:center;">Muro vacío.</p>';
        }

        document.getElementById('discordProfileModal').classList.add('active');
        const editSection = document.getElementById('dProfileEditSection');
        if(editSection) editSection.style.display = 'none'; 

    } catch (err) { console.error("Error renderizando perfil:", err); }
});

safeAddListener('dCommentBtn', 'click', () => { const text = escapeHTML(document.getElementById('dCommentText').value.trim()); if(text && viewingProfile) { socket.emit('addComment', { targetUser: viewingProfile, from: currentUsername, text: text, time: new Date().toLocaleDateString() }); document.getElementById('dCommentText').value = ''; } });
socket.on('newProfileComment', (data) => { if(viewingProfile === data.targetUser) socket.emit('getProfile', viewingProfile); });
safeAddListener('closeDiscordProfileBtn', 'click', () => { document.getElementById('discordProfileModal').classList.remove('active'); });

// ==========================================
// LISTAS SOCIALES Y GLOBALES 
// ==========================================
const renderFriendsUI = () => {
    const gl = (c, arr, isR) => { 
        const el = document.getElementById(c);
        if(!el) return;
        el.innerHTML = arr.map(u => {
        const safeU = escapeHTML(u);
        return `<li class="f-item" style="cursor:pointer;" data-profile="${safeU}"><span style="font-weight:bold; color:var(--text-main); flex:1;">${safeU}</span>${isR ? `<div><button class="btn-primary" onclick="event.stopPropagation(); window.acceptFriend('${safeU}')" style="padding:5px 10px; font-size:0.8rem; border-radius:8px;">Aceptar</button> <button class="btn-danger-outline" onclick="event.stopPropagation(); window.rejectFriend('${safeU}')" style="padding:5px 10px; font-size:0.8rem;">X</button></div>` : ''}</li>`
    }).join('') || '<p style="color:var(--text-muted); font-size:0.9rem; text-align:center;">Lista vacía.</p>'; };
    gl('myFriendsList', myFriends, false); gl('pendingRequestsList', myRequests, true);
};
socket.on('friendRequestReceived', ({ from, to }) => { if(to === currentUsername && !myRequests.includes(from) && !myFriends.includes(from)) { myRequests.push(from); setDoc(doc(db, "usuarios", currentUserUid), { friendRequests: myRequests }, { merge: true }); vibrate(200); renderFriendsUI(); }});
window.acceptFriend = (rU) => { myFriends.push(rU); myRequests = myRequests.filter(r => r !== rU); setDoc(doc(db, "usuarios", currentUserUid), { friendRequests: myRequests, friends: myFriends }, { merge: true }); socket.emit('acceptFriendRequest', { from: currentUsername, to: rU }); renderFriendsUI(); };
window.rejectFriend = (rU) => { myRequests = myRequests.filter(r => r !== rU); setDoc(doc(db, "usuarios", currentUserUid), { friendRequests: myRequests }, { merge: true }); renderFriendsUI(); };
socket.on('friendRequestAccepted', ({ from, to }) => { if(to === currentUsername && !myFriends.includes(from)) { myFriends.push(from); setDoc(doc(db, "usuarios", currentUserUid), { friends: myFriends }, { merge: true }); renderFriendsUI(); }});

safeAddListener('toggleRoomUsersBtn', 'click', () => document.getElementById('roomUsersPanel').classList.toggle('active'));
safeAddListener('closeRoomUsersBtn', 'click', () => document.getElementById('roomUsersPanel').classList.remove('active'));

socket.on('updateUserList', (users) => {
    const rl = document.getElementById('roomUsersList');
    if(rl) rl.innerHTML = users.map(u => `<li class="f-item" data-profile="${escapeHTML(u.username)}" style="padding: 10px; cursor:pointer;"><div style="display:flex; align-items:center; gap:10px;"><img src="${u.avatar || 'https://cdn-icons-png.flaticon.com/512/149/149071.png'}" onerror="this.src='https://cdn-icons-png.flaticon.com/512/149/149071.png'" style="width:35px; height:35px; border-radius:50%; object-fit:cover;"><div><span style="color:${(u.username === currentUsername) ? userColor : (u.color||'#fff')}; font-weight:700; font-size:0.9rem;">${escapeHTML(u.username)}</span><br><small style="color:var(--text-muted); font-size:0.75rem;">${escapeHTML(u.status)}</small></div></div></li>`).join('') || '<p style="color:var(--text-muted); text-align:center; font-size:0.8rem;">Solo tú estás aquí.</p>';
});

socket.on('updateGlobalUsers', (users) => {
    const gl = document.getElementById('globalLobbyUsersList');
    if(gl) gl.innerHTML = users.map(u => `<li class="f-item" data-profile="${escapeHTML(u.username)}" style="padding: 10px; cursor:pointer; background: transparent; border-color: rgba(255,255,255,0.05); margin-bottom:5px;"><div style="display:flex; align-items:center; gap:10px;"><img src="${u.avatar || 'https://cdn-icons-png.flaticon.com/512/149/149071.png'}" onerror="this.src='https://cdn-icons-png.flaticon.com/512/149/149071.png'" style="width:30px; height:30px; border-radius:50%; object-fit:cover;"><div><span style="color:${(u.username === currentUsername) ? userColor : (u.color||'#fff')}; font-weight:600; font-size:0.85rem;">${escapeHTML(u.username)}</span><br><small style="color:var(--text-muted); font-size:0.7rem;">${escapeHTML(u.status)}</small></div></div></li>`).join('') || '<p style="color:var(--text-muted); text-align:center;">Nadie conectado.</p>';
});

// ==========================================
// EMOJIS, STICKERS Y GIFS VIVOS
// ==========================================
const up = document.getElementById('unifiedPicker');
safeAddListener('toggleUnifiedPickerBtn', 'click', () => { if(up) up.classList.toggle('active'); if(up && up.classList.contains('active')) updateStickerMenu(); });
safeAddListener('closeUnifiedPickerBtn', 'click', () => { if(up) up.classList.remove('active'); });

const updateStickerMenu = () => { const sr = document.getElementById('stickerResults'); if(sr) sr.innerHTML = myStickers.map(url => `<img src="${url}" onclick="window.sendSticker('${url}')">`).join('') || '<p style="grid-column:span 2; text-align:center; color:var(--text-muted); font-size:0.8rem;">Sin stickers guardados.</p>'; };
window.sendSticker = (url) => { enviarMensaje(url, 'image'); if(up) up.classList.remove('active'); };

const emojis = ['😀','😂','🥺','😎','😍','👍','❤️','🔥','🎉','✨','😭','🙏','😅','🤔','🥰','👽','👻','🤖','💩','💀','💅','💃','👀','🧠','👅','🚀','🛸','🎨','🎮','🏆','🍕','🍔','🍟','☕','🍷','⚽','🏀','🎸','💡','💯','💜','✨','💀'];
const emc = document.getElementById('emojiPickerContent');
if(emc) emc.addEventListener('click', (e) => {
    if(e.target.tagName === 'SPAN') { const mi = document.getElementById('messageInput'); if(mi) mi.value += e.target.innerText; }
});
if(emc) emc.innerHTML = emojis.map(e => `<span>${e}</span>`).join('');

safeAddListener('doGifSearchBtn', 'click', async () => {
    const term = escapeHTML(document.getElementById('gifSearch').value.trim()); if(!term) return;
    const res = document.getElementById('gifResults'); res.innerHTML = '<p>Buscando...</p>';
    try {
        const req = await fetch(`https://g.tenor.com/v1/search?q=${term}&key=LIVDSRZULELA&limit=12`); const d = await req.json();
        res.innerHTML = d.results.length === 0 ? '<p>Sin resultados.</p>' : '';
        d.results.forEach(g => { const img = document.createElement('img'); img.src = g.media[0].tinygif.url; img.onclick = () => { enviarMensaje(g.media[0].gif.url, 'image'); up.classList.remove('active'); document.getElementById('gifSearch').value='';}; res.appendChild(img); });
    } catch(e) { res.innerHTML = '<p>Error.</p>'; }
});

// ==========================================
// COMPARTIR
// ==========================================
safeAddListener('shareBtnChat', 'click', async () => {
    if (navigator.share) {
        try {
            await navigator.share({
                title: 'Nani? App',
                text: `¡Únete a mí en la sala ${currentRoom} en Nani!`,
                url: window.location.href
            });
        } catch (err) { console.log('Error compartiendo:', err); }
    } else {
        showToast("Tu navegador no soporta la función de compartir nativa.", "error");
    }
});


// ==========================================
// ENVÍO DE MENSAJES Y NOTAS DE VOZ MESSENGER STYLE
// ==========================================
const enviarMensaje = (texto, tipo = 'text') => {
    if (!texto) return;
    const safeText = tipo === 'text' ? escapeHTML(texto) : texto; 
    const idUnicoMsg = Date.now().toString() + Math.floor(Math.random()*1000); // Genero ID antes de enviar
    
    socket.emit('chatMessage', { msgId: idUnicoMsg, uid: currentUserUid, username: currentUsername, text: safeText, type: tipo, room: currentRoom, color: userColor, avatar: userAvatar, bubbleBg: userBubbleColor, bubbleOpacity: userBubbleOpacity, reply: replyingTo, time: new Date().toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'}) });
    const cbtn = document.getElementById('cancelReplyBtn'); if(cbtn) cbtn.click(); 
};

safeAddListener('chatForm', 'submit', (e) => { 
    e.preventDefault(); 
    const mi = document.getElementById('messageInput');
    if(mi) { enviarMensaje(mi.value.trim(), 'text'); mi.value = ''; }
});

// Grabación Estilo Messenger (Pulsante)
let isRecording = false;
const recOverlay = document.getElementById('recordingOverlay');

const startRecording = async (e) => {
    if(e) e.preventDefault();
    if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
        return showToast("Tu navegador bloquea el micrófono. Necesitas HTTPS.", "error");
    }
    try {
        const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
        mediaRecorder = new MediaRecorder(stream);
        audioChunks = [];
        mediaRecorder.start();
        isRecording = true;
        if(recOverlay) recOverlay.classList.add('active');
        vibrate(50);
        mediaRecorder.addEventListener("dataavailable", event => audioChunks.push(event.data));
        mediaRecorder.addEventListener("stop", () => {
            const audioBlob = new Blob(audioChunks, { type: 'audio/webm' });
            const reader = new FileReader();
            reader.readAsDataURL(audioBlob);
            reader.onloadend = () => {
                if(isRecording) enviarMensaje(reader.result, 'audio');
            };
            stream.getTracks().forEach(t => t.stop());
            isRecording = false;
        });
    } catch(err) { showToast('Permiso de micrófono denegado o no disponible.', 'error'); }
};
const stopRecording = (e) => {
    if(e) e.preventDefault();
    if(mediaRecorder && mediaRecorder.state === 'recording') {
        if(recOverlay) recOverlay.classList.remove('active');
        mediaRecorder.stop();
    }
};

const vBtn = document.getElementById('voiceBtn');
if(vBtn) {
    vBtn.addEventListener('mousedown', startRecording);
    vBtn.addEventListener('touchstart', startRecording);
    window.addEventListener('mouseup', stopRecording);
    window.addEventListener('touchend', stopRecording);
}

safeAddListener('fileInput', 'change', (e) => { 
    const file = e.target.files[0]; 
    if(!file) return;
    if(file.size > 8 * 1024 * 1024) return showToast("El archivo supera 8MB.", "error");

    const isImage = file.type.startsWith('image/');
    if (isImage && file.type !== 'image/gif') { compressImg(file, (b64) => enviarMensaje(b64, 'image')); } 
    else {
        const r = new FileReader();
        r.readAsDataURL(file);
        r.onload = (ev) => {
            if(isImage) enviarMensaje(ev.target.result, 'image');
            else enviarMensaje(`${escapeHTML(file.name)}|${ev.target.result}`, 'file');
        };
    }
});

socket.on('messageDeleted', (msgId) => { const m = document.getElementById(`msg-${msgId}`); if(m) m.remove(); });
socket.on('loadHistory', (history) => { const cm = document.getElementById('chatMessages'); if(cm) { cm.innerHTML = ''; history.forEach(msg => renderMessage(msg)); cm.scrollTop = cm.scrollHeight; }});

const renderMessage = (msg) => {
    const div = document.createElement('div'); div.id = `msg-${msg.msgId}`;
    const isMe = msg.uid === currentUserUid;
    div.className = `message ${isMe ? 'my-message' : ''} ${msg.type === 'image' ? 'type-image' : ''}`;
    
    const cBg = isMe ? userBubbleColor : (msg.bubbleBg || '#9333ea');
    const cOp = isMe ? userBubbleOpacity : (msg.bubbleOpacity || 1);
    const cNameColor = isMe ? userColor : msg.color;

    if (msg.type !== 'image') { div.style.background = hexToRgba(cBg, cOp); if (!isMe) div.style.border = `1px solid ${cBg}`; }

    const safeUsername = escapeHTML(msg.username);
    const safeAvatar = msg.avatar || 'https://cdn-icons-png.flaticon.com/512/149/149071.png';

    let rHtml = ''; 
    if (msg.reply) {
        const safeReplyUser = escapeHTML(msg.reply.username);
        const safeReplyText = escapeHTML(msg.reply.text);
        const isReplyMedia = msg.reply.text.startsWith('data:') || msg.reply.text.startsWith('http');
        // WHATSAPP STYLE SCROLL TO REPLY
        rHtml = `<div class="quoted-message" onclick="window.ui.scrollToMessage('${msg.reply.msgId}')" style="border-left-color: ${isMe ? '#fff' : cNameColor}; cursor:pointer;"><strong style="color: ${isMe ? '#fff' : cNameColor};">${safeReplyUser}</strong><p>${isReplyMedia ? '📷 Media' : safeReplyText}</p></div>`;
    }

    let content = '';
    if (msg.type === 'image') content = `<img src="${msg.text}" class="msg-image compact-img" onclick="document.getElementById('lightboxImg').src=this.src; document.getElementById('lightboxModal').classList.add('active');">`;
    else if (msg.type === 'audio') content = `<audio controls src="${msg.text}" class="msg-audio"></audio>`;
    else if (msg.type === 'file') {
        const splitIndex = msg.text.indexOf('|');
        const fName = escapeHTML(msg.text.substring(0, splitIndex));
        const fData = msg.text.substring(splitIndex + 1);
        content = `<div class="file-message"><i class="fas fa-file-alt"></i> <a href="${fData}" download="${fName}" style="color:inherit; text-decoration:none;">${fName}</a></div>`;
    }
    else content = `<p class="text">${msg.text}</p>`;

    div.innerHTML = `<div class="msg-header" data-profile="${safeUsername}" style="cursor:pointer;"><img src="${safeAvatar}" onerror="this.src='https://cdn-icons-png.flaticon.com/512/149/149071.png'" class="msg-avatar"><span style="color: ${cNameColor}; font-weight: 800;">${safeUsername}</span></div>${rHtml} ${content} <div class="msg-footer"><span class="time">${msg.time}</span></div>`;
    
    div.addEventListener('contextmenu', (e) => showContextMenu(e, msg));
    div.addEventListener('touchstart', (e) => { pressTimer = window.setTimeout(() => showContextMenu(e, msg), 600); });
    div.addEventListener('touchend', () => clearTimeout(pressTimer)); div.addEventListener('touchmove', () => clearTimeout(pressTimer));

    const cm = document.getElementById('chatMessages'); 
    if(cm) { cm.appendChild(div); cm.scrollTop = cm.scrollHeight; }
    
    if(!isMe && useNotifs && !mutedRooms.includes(msg.room)) { 
        const ns = document.getElementById('notificationSound'); 
        if(ns) ns.play().catch(()=>{}); 
        vibrate(150); 
    }
};
socket.on('message', renderMessage);

safeAddListener('searchInput', 'input', (e) => { const term = e.target.value.toLowerCase(); document.querySelectorAll('.message').forEach(m => { m.style.display = (m.querySelector('.text, .file-message')?.innerText.toLowerCase() || '').includes(term) ? 'block' : 'none'; }); });
safeAddListener('cancelReplyBtn', 'click', () => { replyingTo = null; document.getElementById('replyPreview').classList.remove('active'); });

const ctxMenu = document.getElementById('contextMenu'); let pressTimer;
const showContextMenu = (e, msgData) => {
    e.preventDefault(); selectedMsgContext = msgData;
    let x = e.pageX || (e.touches && e.touches[0].pageX); let y = e.pageY || (e.touches && e.touches[0].pageY);
    if(x + 160 > window.innerWidth) x -= 160; if(y + 150 > window.innerHeight) y -= 150;
    ctxMenu.style.left = `${x}px`; ctxMenu.style.top = `${y}px`; ctxMenu.classList.add('active');
    document.getElementById('ctxSaveSticker').style.display = msgData.type === 'image' ? 'flex' : 'none';
    
    document.getElementById('ctxDelete').style.display = (msgData.uid === currentUserUid || isSuperAdmin) ? 'flex' : 'none';
    vibrate(50);
};
document.addEventListener('click', (e) => { if(!e.target.closest('.context-menu') && ctxMenu) ctxMenu.classList.remove('active'); });

safeAddListener('ctxProfile', 'click', () => { window.ui.openProfile(selectedMsgContext.username); ctxMenu.classList.remove('active'); });
safeAddListener('ctxReply', 'click', () => {
    replyingTo = { username: selectedMsgContext.username, text: selectedMsgContext.text, msgId: selectedMsgContext.msgId }; // msgId incluido para Whatsapp scroll
    document.getElementById('replyName').textContent = escapeHTML(selectedMsgContext.username);
    document.getElementById('replyText').textContent = selectedMsgContext.type === 'image' ? '📷 Imagen' : (selectedMsgContext.type === 'audio' ? '🎤 Audio' : escapeHTML(selectedMsgContext.text));
    document.getElementById('replyPreview').classList.add('active'); 
    const mi = document.getElementById('messageInput'); if(mi) mi.focus();
    ctxMenu.classList.remove('active');
});
safeAddListener('ctxSaveSticker', 'click', () => {
    if(!myStickers.includes(selectedMsgContext.text)) { myStickers.push(selectedMsgContext.text); setDoc(doc(db, "usuarios", currentUserUid), { preferences: { stickers: myStickers } }, { merge: true }); updateStickerMenu(); showToast("Sticker Guardado"); vibrate(100); }
    ctxMenu.classList.remove('active');
});
safeAddListener('ctxDelete', 'click', () => { 
    socket.emit('deleteMessage', { room: currentRoom, msgId: selectedMsgContext.msgId, requesterUid: currentUserUid, requesterEmail: currentUserEmail }); 
    ctxMenu.classList.remove('active'); 
});