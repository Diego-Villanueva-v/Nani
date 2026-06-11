import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js";
import { getAuth, onAuthStateChanged, signOut } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js";
import { getFirestore, doc, getDoc, setDoc, collection, query, where, getDocs } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";

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
let selectedChatToDelete = null; // Para borrar chats de la lista

let userAge, userGender, userColor, userBubbleColor, userBubbleOpacity, userStatus, userAvatar, chatBg, userBio, useVibration, useNotifs, useLightMode;
let myStickers = [], myFriends = [], myRequests = [], myRooms = [], mutedRooms = [];
let pendingSentRequests = [];

// ==========================================
// CACHE DE AVATARES Y SANITIZACIÓN
// ==========================================
const avatarCache = {}; // Almacena fotos para no llamar a Firebase constantemente

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

// Compresor Extremo para Avatares
const compressAvatar = (file, cb) => { 
    const r = new FileReader(); r.readAsDataURL(file); 
    r.onload = e => { 
        const i = new Image(); i.src = e.target.result; 
        i.onload = () => { 
            const c = document.createElement('canvas'); 
            const sc = Math.min(250/i.width, 1); 
            c.width = i.width*sc; c.height = i.height*sc; 
            c.getContext('2d').drawImage(i, 0, 0, c.width, c.height); 
            cb(c.toDataURL('image/jpeg', 0.6)); 
        }; 
    }; 
};
const compressImg = (file, cb) => { 
    const r = new FileReader(); r.readAsDataURL(file); 
    r.onload = e => { 
        const i = new Image(); i.src = e.target.result; 
        i.onload = () => { 
            const c = document.createElement('canvas'); 
            const sc = Math.min(800/i.width, 1); 
            c.width = i.width*sc; c.height = i.height*sc; 
            c.getContext('2d').drawImage(i, 0, 0, c.width, c.height); 
            cb(c.toDataURL('image/jpeg', 0.8)); 
        }; 
    }; 
};

// Traer foto desde Firestore si no está en cache
const fetchAvatar = async (username) => {
    if(avatarCache[username]) return;
    avatarCache[username] = 'loading'; // Evita llamadas duplicadas
    try {
        const q = query(collection(db, "usuarios"), where("username", "==", username));
        const docsSnap = await getDocs(q);
        if(!docsSnap.empty) {
            avatarCache[username] = docsSnap.docs[0].data().avatar || 'https://cdn-icons-png.flaticon.com/512/149/149071.png';
            renderMyRoomsUI(); 
            renderFriendsUI();
        }
    } catch(e) {
        avatarCache[username] = 'https://cdn-icons-png.flaticon.com/512/149/149071.png';
    }
};

// ==========================================
// MÉTODOS GLOBALES DE UI
// ==========================================
window.ui = {
    openProfile: (username) => {
        if(!username) return;
        viewingProfile = username; 
        socket.emit('getProfile', username); 
    },
    applyTheme: (isLight) => {
        if(isLight) {
            document.documentElement.classList.add('light-theme');
            document.body.classList.add('light-theme');
            localStorage.setItem('nani_theme', 'light');
        } else {
            document.documentElement.classList.remove('light-theme');
            document.body.classList.remove('light-theme');
            localStorage.setItem('nani_theme', 'dark');
        }
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
        
        const tv = document.getElementById(viewId); 
        if(tv) tv.classList.add('active');
        if(btnElement) btnElement.classList.add('active');
        
        if(viewId === 'viewLobby' && currentRoom !== 'Lobby') {
            currentRoom = 'Lobby'; 
            socket.emit('joinRoom', { uid: currentUserUid, username: currentUsername, email: currentUserEmail, room: currentRoom, color: userColor, avatar: userAvatar, status: userStatus, bubbleBg: userBubbleColor, bubbleOpacity: userBubbleOpacity, bio: userBio });
        }
        if(viewId === 'viewSocial') { const b = document.getElementById('reqTabBadge'); if(b) b.style.display = 'none'; const s = document.getElementById('navSocialBadge'); if(s) s.style.display = 'none'; }
        if(viewId === 'viewChats') { const b = document.getElementById('navChatsBadge'); if(b) b.style.display = 'none'; }
    },
    scrollToMessage: (msgId) => {
        const el = document.getElementById('msg-'+msgId);
        if(el) {
            el.scrollIntoView({behavior: 'smooth', block: 'center'});
            el.classList.add('highlight-msg');
            setTimeout(() => el.classList.remove('highlight-msg'), 2000);
        }
    },
    enterRoomDirect: (nr) => {
        if(currentRoom === nr && nr !== 'Lobby') return;
        currentRoom = nr; 
        const elT = document.getElementById('roomTitle'); if(elT) elT.innerHTML = escapeHTML(nr.replace(currentUsername, '').replace('_', ''));
        document.getElementById('chatMessages').innerHTML = ''; 
        checkRoomMembership();
        socket.emit('joinRoom', { uid: currentUserUid, username: currentUsername, email: currentUserEmail, room: currentRoom, color: userColor, avatar: userAvatar, status: userStatus, bubbleBg: userBubbleColor, bubbleOpacity: userBubbleOpacity, bio: userBio });
        window.ui.switchView('viewChat', null);
        socket.emit('getRoomProfile', currentRoom);
    },
    openDMRoom: (friendName) => {
        const roomName = [currentUsername, friendName].sort().join('_');
        window.ui.enterRoomDirect(roomName);
        if(!myRooms.includes(roomName)) { myRooms.push(roomName); saveAppPrefs(); renderMyRoomsUI(); }
    }
};

// ==========================================
// DELEGACIÓN GLOBAL (CORREGIDA PARA ACCIONES)
// ==========================================
document.addEventListener('click', (e) => {
    
    // 1. Acciones Dinámicas (Amigos, Cancelar, Opciones Chat) - ARRIBA PARA QUE FUNCIONE SIEMPRE
    const actionTarget = e.target.closest('[data-action]');
    if (actionTarget) {
        e.stopPropagation(); // Previene que se abra el perfil accidentalmente
        const action = actionTarget.getAttribute('data-action');
        const targetUser = actionTarget.getAttribute('data-user');
        const targetRoom = actionTarget.getAttribute('data-room');
        
        if(action === 'acceptFriend') {
            myFriends.push(targetUser);
            myRequests = myRequests.filter(r => r !== targetUser);
            saveAppPrefs();
            socket.emit('acceptFriendRequest', { from: currentUsername, to: targetUser });
            renderFriendsUI();
            const dmRoomName = [currentUsername, targetUser].sort().join('_');
            if(!myRooms.includes(dmRoomName)) { myRooms.push(dmRoomName); saveAppPrefs(); }
            showToast(`¡Ahora eres amigo de ${escapeHTML(targetUser)}!`, "success");
            
        } else if(action === 'rejectFriend') {
            myRequests = myRequests.filter(r => r !== targetUser);
            saveAppPrefs();
            renderFriendsUI();
            
        } else if(action === 'sendFriendReq') {
            socket.emit('sendFriendRequest', { from: currentUsername, to: targetUser });
            pendingSentRequests.push(targetUser);
            actionTarget.setAttribute('data-action', 'cancelFriendReq');
            actionTarget.innerHTML = '<i class="fas fa-times"></i> Cancelar Solicitud';
            actionTarget.classList.replace('btn-primary', 'btn-danger-outline');
            showToast("Solicitud enviada", "success");
            
        } else if(action === 'cancelFriendReq') {
            pendingSentRequests = pendingSentRequests.filter(r => r !== targetUser);
            actionTarget.setAttribute('data-action', 'sendFriendReq');
            actionTarget.innerHTML = '<i class="fas fa-user-plus"></i> Añadir Amigo';
            actionTarget.classList.replace('btn-danger-outline', 'btn-primary');
            showToast("Solicitud cancelada");
            
        } else if(action === 'removeFriend') {
            if(confirm(`¿Estás seguro de eliminar a ${escapeHTML(targetUser)} de tu lista de amigos?`)) {
                myFriends = myFriends.filter(f => f !== targetUser);
                saveAppPrefs();
                renderFriendsUI();
                showToast(`Eliminaste a ${escapeHTML(targetUser)} de tus amigos.`, "success");
            }
            
        } else if(action === 'chatOptions') {
            selectedChatToDelete = targetRoom;
            const ctxMenu = document.getElementById('chatContextMenu');
            if(ctxMenu) {
                let x = e.pageX; let y = e.pageY;
                if(x + 160 > window.innerWidth) x -= 160;
                if(y + 100 > window.innerHeight) y -= 100;
                ctxMenu.style.left = `${x}px`; ctxMenu.style.top = `${y}px`;
                ctxMenu.classList.add('active');
            }
        }
        return;
    }

    // Cerrar Menús contextuales si se hace clic fuera
    const mainCtx = document.getElementById('contextMenu');
    if(!e.target.closest('.context-menu') && mainCtx) mainCtx.classList.remove('active');
    const chatCtx = document.getElementById('chatContextMenu');
    if(!e.target.closest('.context-menu') && chatCtx) chatCtx.classList.remove('active');

    // 2. Perfiles
    const profileTarget = e.target.closest('[data-profile]');
    if (profileTarget) {
        let username = profileTarget.getAttribute('data-profile');
        if(username === 'me') username = currentUsername;
        if(username) {
            window.ui.openProfile(username);
            const isNavBtn = profileTarget.closest('.nav-item');
            if(isNavBtn) {
                document.querySelectorAll('.bottom-nav .nav-item').forEach(n => n.classList.remove('active'));
                isNavBtn.classList.add('active');
            }
        }
        return;
    }
    
    // 3. Unirse a Salas
    const roomTarget = e.target.closest('[data-room]');
    if (roomTarget) {
        window.ui.enterRoomDirect(roomTarget.getAttribute('data-room'));
        return;
    }

    // 4. Entrar a DMs
    const dmTarget = e.target.closest('[data-dm]');
    if (dmTarget) {
        window.ui.openDMRoom(dmTarget.getAttribute('data-dm'));
        return;
    }

    // 5. Navegación Inferior Nativa
    const navTarget = e.target.closest('.bottom-nav .nav-item[data-view]');
    if (navTarget) {
        window.ui.switchView(navTarget.dataset.view, navTarget);
        return;
    }

    // 6. Pestañas Genéricas
    const tabTarget = e.target.closest('.picker-tab, .f-tab');
    if (tabTarget) {
        const container = tabTarget.closest('.friends-container') || tabTarget.closest('.unified-picker');
        if(container) {
            container.querySelectorAll('.f-tab, .picker-tab').forEach(t => t.classList.remove('active'));
            container.querySelectorAll('.f-list, .picker-content').forEach(l => l.classList.remove('active'));
            tabTarget.classList.add('active');
            const tgtEl = document.getElementById(tabTarget.dataset.target);
            if(tgtEl) tgtEl.classList.add('active');
        }
        return;
    }

    // 7. Creador DM Directo desde Modal
    const dmCreateTarget = e.target.closest('[data-dm-create]');
    if(dmCreateTarget && viewingProfile) {
        document.getElementById('discordProfileModal').classList.remove('active'); 
        window.ui.openDMRoom(viewingProfile);
        return;
    }

    // 8. Botones de Onboarding
    if(e.target.id === 'nextOnboardBtn') {
        const age = document.getElementById('onboardAge').value;
        if(age >= 13) {
            document.getElementById('onboardStep1').classList.remove('active');
            document.getElementById('onboardStep2').classList.add('active');
        } else showToast("Debes ser mayor de 13 años.", 'error');
        return;
    }
    if(e.target.id === 'backOnboardBtn') {
        document.getElementById('onboardStep2').classList.remove('active');
        document.getElementById('onboardStep1').classList.add('active');
        return;
    }
    const genderBtn = e.target.closest('.gender-btn');
    if (genderBtn) {
        document.querySelectorAll('.gender-btn').forEach(b => b.classList.remove('active'));
        genderBtn.classList.add('active');
        tempGender = genderBtn.dataset.gender;
        return;
    }
    if(e.target.id === 'finishOnboardBtn') {
        const age = document.getElementById('onboardAge').value;
        if(age && tempGender) {
            setDoc(doc(db, "usuarios", currentUserUid), { age: age, gender: tempGender }, { merge: true }).then(()=>{
                userAge = age; userGender = tempGender;
                document.getElementById('onboardingModal').classList.remove('active');
                socket.emit('joinRoom', { uid: currentUserUid, username: currentUsername, email: currentUserEmail, room: currentRoom, color: userColor, avatar: userAvatar, status: userStatus, bubbleBg: userBubbleColor, bubbleOpacity: userBubbleOpacity, bio: userBio });
                showToast("Perfil completado.");
            }).catch(()=> showToast("Error al guardar.", 'error'));
        } else showToast("Selecciona tu género.", 'error');
        return;
    }
});

// ==========================================
// ELIMINAR CHATS DESDE EL MENÚ
// ==========================================
const safeAddListener = (id, event, handler) => { const el = document.getElementById(id); if (el) el.addEventListener(event, handler); };

safeAddListener('ctxDeleteChat', 'click', () => {
    if(selectedChatToDelete) {
        myRooms = myRooms.filter(r => r !== selectedChatToDelete);
        saveAppPrefs();
        renderMyRoomsUI();
        
        // Si estábamos dentro de ese chat, volvemos al inicio
        if(currentRoom === selectedChatToDelete) {
            window.ui.switchView('viewLobby');
        }
        
        showToast("Chat eliminado de tu lista", "success");
        document.getElementById('chatContextMenu').classList.remove('active');
        selectedChatToDelete = null;
    }
});

// ==========================================
// INICIO Y CONFIGURACIÓN
// ==========================================
let tempGender = '';
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
    myRooms = prefs.rooms || ['General']; 
    mutedRooms = prefs.mutedRooms || [];
    
    userAge = cloudData.age || '';
    userGender = cloudData.gender || '';
    userBio = cloudData.bio || ''; 
    userColor = prefs.color || '#d946ef';
    userBubbleColor = prefs.bubbleColor || '#9333ea';
    userBubbleOpacity = prefs.bubbleOpacity || '0.9';
    userStatus = prefs.status || 'Conectado';
    userAvatar = prefs.avatar || 'https://cdn-icons-png.flaticon.com/512/149/149071.png';
    chatBg = localStorage.getItem('nani_bg') || ''; 
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

    window.ui.applyTheme(useLightMode);
    
    const tt = document.getElementById('themeToggle'); if(tt) tt.checked = useLightMode;
    const vt = document.getElementById('vibToggle'); if(vt) vt.checked = useVibration;
    const nt = document.getElementById('notifToggle'); if(nt) nt.checked = useNotifs;
    
    if (chatBg) window.ui.applyBackground(chatBg);

    // Sistema Inmortal de Salas
    socket.emit('reviveRooms', myRooms.filter(r => !r.includes('_')).map(r => ({id: r, name: r, creator: currentUsername, uid: currentUserUid, description: 'Sala restaurada por usuario.', avatar: 'https://cdn-icons-png.flaticon.com/512/1370/1370907.png'})));

    socket.emit('joinRoom', { uid: currentUserUid, username: currentUsername, email: currentUserEmail, room: 'Lobby', color: userColor, avatar: userAvatar, status: userStatus, bubbleBg: userBubbleColor, bubbleOpacity: userBubbleOpacity, bio: userBio });
    
    window.ui.switchView('viewLobby', document.querySelector('.bottom-nav .nav-item[data-view="viewLobby"]'));
    renderFriendsUI();
}

const saveAppPrefs = async () => {
    try { 
        localStorage.setItem('nani_bg', chatBg); 
        await setDoc(doc(db, "usuarios", currentUserUid), { 
            bio: userBio,
            friendRequests: myRequests,
            friends: myFriends,
            preferences: { color: userColor, bubbleColor: userBubbleColor, bubbleOpacity: userBubbleOpacity, status: userStatus, avatar: userAvatar, bgLocal: chatBg, rooms: myRooms, mutedRooms: mutedRooms, stickers: myStickers, vibration: useVibration, notifications: useNotifs, lightMode: useLightMode } 
        }, { merge: true }); 
    } catch(e) {}
};

// ==========================================
// AJUSTES Y MENÚS
// ==========================================
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

// ==========================================
// SALAS Y PRIVADOS
// ==========================================
const checkRoomMembership = () => {
    if(currentRoom === 'Lobby') return;
    
    if(currentRoom.includes('_')) { // DM
        document.getElementById('chatForm').style.display = 'flex';
        document.getElementById('joinRoomPrompt').style.display = 'none';
        document.getElementById('chatMenuDropdownContainer').style.display = 'none';
        document.getElementById('toggleRoomUsersBtn').style.display = 'none';
        return;
    }
    
    document.getElementById('chatMenuDropdownContainer').style.display = 'block';
    document.getElementById('toggleRoomUsersBtn').style.display = 'block';

    if (myRooms.includes(currentRoom)) {
        document.getElementById('chatForm').style.display = 'flex';
        document.getElementById('joinRoomPrompt').style.display = 'none';
    } else {
        document.getElementById('chatForm').style.display = 'none';
        document.getElementById('joinRoomPrompt').style.display = 'flex';
    }
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

// Menú Chat (3 puntitos principal)
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

// Fondo HD
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
    const file = e.target.files[0];
    if(file) {
        const r = new FileReader(); r.readAsDataURL(file);
        r.onload = (ev) => {
            tempBgData = ev.target.result;
            document.getElementById('bgPreviewContainer').style.backgroundImage = `url('${tempBgData}')`;
            document.getElementById('bgPreviewModal').classList.add('active');
        };
    }
});
safeAddListener('cancelBgBtn', 'click', () => { document.getElementById('bgPreviewModal').classList.remove('active'); tempBgData = null; });
safeAddListener('applyBgBtn', 'click', () => {
    if(tempBgData) { chatBg = tempBgData; window.ui.applyBackground(chatBg); saveAppPrefs(); showToast("Fondo Aplicado."); }
    document.getElementById('bgPreviewModal').classList.remove('active');
});

// ==========================================
// RENDERIZAR "MIS CHATS" ESTILO PURP (CON FOTOS Y MENÚS)
// ==========================================
const renderMyRoomsUI = () => {
    const listRooms = document.getElementById('myJoinedRoomsList');
    const listDMs = document.getElementById('myDMsList');
    if(!listRooms || !listDMs) return;
    
    // Auto-limpieza inteligente
    const validRoomIds = currentRoomsData.map(r => r.id);
    const originalLen = myRooms.length;
    myRooms = myRooms.filter(id => id.includes('_') || validRoomIds.includes(id));
    if(myRooms.length !== originalLen) saveAppPrefs();
    
    listRooms.innerHTML = myRooms.filter(r => !r.includes('_')).map(rName => {
        const rData = currentRoomsData.find(rm => rm.id === rName);
        if(!rData) return ''; 
        return `
        <li class="f-item purp-chat-item" style="cursor:pointer;" data-room="${escapeHTML(rData.id)}">
            <div style="display:flex; align-items:center; gap:15px; flex:1;">
                <img src="${rData.avatar || 'https://cdn-icons-png.flaticon.com/512/1370/1370907.png'}" onerror="this.src='https://cdn-icons-png.flaticon.com/512/1370/1370907.png'" style="width:55px; height:55px; border-radius:18px; object-fit:cover; border: 2px solid var(--border);">
                <div style="display:flex; flex-direction:column;">
                    <span style="font-weight:800; color:var(--text-main); font-size:1.1rem;">${escapeHTML(rData.name)}</span>
                    <span style="color:var(--accent); font-size:0.75rem; font-weight:600;"><i class="fas fa-users"></i> ${rData.userCount || 0} online</span>
                </div>
            </div>
            <button class="chat-opts-btn" data-action="chatOptions" data-room="${escapeHTML(rData.id)}"><i class="fas fa-ellipsis-v"></i></button>
        </li>`;
    }).join('') || '<p style="color:var(--text-muted); text-align:center; margin-top:20px;">No te has unido a ninguna sala aún.</p>';

    listDMs.innerHTML = myRooms.filter(r => r.includes('_') && r.includes(currentUsername)).map(dmRoom => {
        const friend = dmRoom.replace(currentUsername, '').replace('_', '');
        const safeF = escapeHTML(friend);
        
        let avatarImg = 'https://cdn-icons-png.flaticon.com/512/149/149071.png';
        if(avatarCache[friend] && avatarCache[friend] !== 'loading') {
            avatarImg = avatarCache[friend];
        } else if (!avatarCache[friend]) {
            fetchAvatar(friend); 
        }

        return `
        <li class="f-item purp-chat-item" style="cursor:pointer;" data-dm="${safeF}">
            <div style="display:flex; align-items:center; gap:15px; flex:1;">
                <img src="${avatarImg}" onerror="this.src='https://cdn-icons-png.flaticon.com/512/149/149071.png'" style="width:55px; height:55px; border-radius:50%; object-fit:cover; border: 2px solid var(--border);">
                <div style="display:flex; flex-direction:column;">
                    <span style="font-weight:800; color:var(--text-main); font-size:1.05rem;">${safeF}</span>
                    <span style="color:var(--text-muted); font-size:0.75rem;">Mensaje Directo</span>
                </div>
            </div>
            <button class="chat-opts-btn" data-action="chatOptions" data-room="${escapeHTML(dmRoom)}"><i class="fas fa-ellipsis-v"></i></button>
        </li>`;
    }).join('') || '<p style="color:var(--text-muted); text-align:center; margin-top:20px;">No tienes chats privados aún.</p>';
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
            li.setAttribute('data-room', r.id);
            li.innerHTML = `<img src="${r.avatar || 'https://cdn-icons-png.flaticon.com/512/1370/1370907.png'}" onerror="this.src='https://cdn-icons-png.flaticon.com/512/1370/1370907.png'" style="width:40px; height:40px; border-radius:12px; object-fit:cover; margin-right:12px;"> <div style="display:flex; flex-direction:column; flex:1;"><span style="font-weight:600;">${safeRName}</span><span style="color:var(--text-muted); font-size:0.7rem;">Por: ${safeCreator} &bull; <i class="fas fa-user" style="color:var(--accent);"></i> ${userC} online</span></div> <i class="fas fa-sign-in-alt" style="color:var(--accent);"></i>`;
            li.style.display = 'flex'; li.style.alignItems = 'center'; li.style.background = 'var(--input-bg)'; li.style.marginBottom = '8px'; li.style.padding = '10px'; li.style.borderRadius = '12px'; li.style.cursor = 'pointer';
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
        if(!myRooms.includes(nr)) { myRooms.push(nr); saveAppPrefs(); }
        setTimeout(() => { window.ui.enterRoomDirect(nr); }, 300); 
    }
});

// ==========================================
// PERFIL DE SALA (CONFIG)
// ==========================================
let tempRoomAvatar = null;
socket.on('roomProfileData', (rd) => {
    try {
        const rt = document.getElementById('roomTitle');
        if(rt && !currentRoom.includes('_')) rt.innerHTML = `<img src="${rd.avatar || 'https://cdn-icons-png.flaticon.com/512/1370/1370907.png'}" onerror="this.src='https://cdn-icons-png.flaticon.com/512/1370/1370907.png'" style="width:30px; height:30px; border-radius:10px; object-fit:cover;"> ${escapeHTML(rd.name)}`;
        const rc = document.getElementById('roomCreator'); if(rc && !currentRoom.includes('_')) rc.textContent = `por ${escapeHTML(rd.creator)}`;
        
        const canEdit = (rd.uid === currentUserUid || rd.creator === currentUsername || isSuperAdmin);
        const brs = document.getElementById('btnRoomSettings'); if(brs) brs.style.display = canEdit ? 'block' : 'none';
        
        document.getElementById('rProfileAvatar').src = rd.avatar || 'https://cdn-icons-png.flaticon.com/512/1370/1370907.png';
        document.getElementById('rProfileName').textContent = escapeHTML(rd.name);
        document.getElementById('rProfileCreator').textContent = `Creador: ${escapeHTML(rd.creator)}`;
        document.getElementById('rProfileDesc').textContent = rd.description ? escapeHTML(rd.description) : "Una sala para conversar de todo un poco.";
        
        const mt = document.getElementById('muteRoomToggle');
        if(mt) mt.checked = mutedRooms.includes(rd.name);

        const editSec = document.getElementById('rProfileEditSection');
        if (canEdit) {
            editSec.style.display = 'block';
            document.getElementById('rEditName').value = escapeHTML(rd.name);
            document.getElementById('rEditDesc').value = rd.description ? escapeHTML(rd.description) : "";
            tempRoomAvatar = rd.avatar;
        } else {
            editSec.style.display = 'none';
        }
    } catch(err) { console.error("Error cargando sala:", err); }
});
safeAddListener('closeRoomProfileBtn', 'click', () => { document.getElementById('roomProfileModal').classList.remove('active'); });

safeAddListener('rEditAvatarInput', 'change', (e) => {
    if(e.target.files[0]) compressAvatar(e.target.files[0], (b64) => { document.getElementById('rProfileAvatar').src = b64; tempRoomAvatar = b64; });
});

safeAddListener('saveRoomProfileBtn', 'click', () => {
    const nName = escapeHTML(document.getElementById('rEditName').value);
    const nDesc = escapeHTML(document.getElementById('rEditDesc').value);
    socket.emit('updateRoomProfile', { roomName: currentRoom, newName: nName, description: nDesc, avatar: tempRoomAvatar, requesterUid: currentUserUid });
    
    if(nName && nName !== currentRoom) {
        myRooms = myRooms.map(r => r === currentRoom ? nName : r);
        currentRoom = nName;
        saveAppPrefs();
    }
    showToast("Sala actualizada", "success");
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
// AJUSTES APP (INTERRUPTORES)
// ==========================================
safeAddListener('themeToggle', 'change', (e) => { 
    useLightMode = e.target.checked; 
    window.ui.applyTheme(useLightMode);
    saveAppPrefs(); 
});
safeAddListener('vibToggle', 'change', (e) => { useVibration = e.target.checked; saveAppPrefs(); });
safeAddListener('notifToggle', 'change', (e) => { useNotifs = e.target.checked; saveAppPrefs(); });
safeAddListener('bubbleOpacity', 'input', (e) => { vibrate(15); });


// ==========================================
// PERFIL USUARIO Y SOCIAL
// ==========================================
safeAddListener('editProfileToggleBtn', 'click', () => {
    const editSec = document.getElementById('dProfileEditSection');
    editSec.style.display = editSec.style.display === 'none' ? 'block' : 'none';
    document.getElementById('bioInput').value = userBio;
    document.getElementById('colorPicker').value = userColor;
    document.getElementById('bubbleColorPicker').value = userBubbleColor;
    document.getElementById('bubbleOpacity').value = userBubbleOpacity;
    document.getElementById('statusSelect').value = userStatus;
});
safeAddListener('avatarInput', 'change', (e) => { if(e.target.files[0]) compressAvatar(e.target.files[0], (b64) => { document.getElementById('dProfileAvatar').src = b64; userAvatar = b64; }); });

safeAddListener('saveProfileBtn', 'click', async () => {
    const btn = document.getElementById('saveProfileBtn'); btn.textContent = 'Guardando...'; btn.disabled = true;
    userColor = document.getElementById('colorPicker').value; userBubbleColor = document.getElementById('bubbleColorPicker').value; userBubbleOpacity = document.getElementById('bubbleOpacity').value; userStatus = document.getElementById('statusSelect').value;
    userBio = escapeHTML(document.getElementById('bioInput').value.trim()); 
    
    try { 
        await saveAppPrefs();
        document.querySelectorAll('.my-message').forEach(m => { if (!m.classList.contains('type-image')) m.style.background = hexToRgba(userBubbleColor, userBubbleOpacity); const ns = m.querySelector('.msg-header span'); if(ns) ns.style.color = userColor; });
        socket.emit('joinRoom', { uid: currentUserUid, username: currentUsername, email: currentUserEmail, room: currentRoom, color: userColor, avatar: userAvatar, status: userStatus, bubbleBg: userBubbleColor, bubbleOpacity: userBubbleOpacity, bio: userBio });
        vibrate(100);
        setTimeout(() => { document.getElementById('dProfileEditSection').style.display = 'none'; btn.disabled = false; btn.textContent = 'Guardar Cambios'; window.ui.openProfile(currentUsername); }, 500);
    } catch(e) { showToast("Error al guardar", 'error'); btn.disabled = false; btn.textContent = 'Guardar Cambios'; }
});

socket.on('profileData', (data) => {
    try {
        avatarCache[data.username] = data.avatar; 
        
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
        
        const elBio = document.getElementById('dProfileBio');
        if(elBio) elBio.textContent = data.bio ? escapeHTML(data.bio) : 'Sin biografía.';

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
                dBtn.setAttribute('data-dm-create', escapeHTML(data.username));
            }
            if(aBtn) {
                aBtn.style.display = 'block'; 
                if(myFriends.includes(data.username)) { 
                    aBtn.innerHTML = '<i class="fas fa-user-check"></i> Amigo'; aBtn.disabled = true; 
                } else if(pendingSentRequests.includes(data.username)) {
                    aBtn.innerHTML = '<i class="fas fa-times"></i> Cancelar Solicitud'; aBtn.disabled = false; aBtn.setAttribute('data-action', 'cancelFriendReq'); aBtn.setAttribute('data-user', escapeHTML(data.username)); aBtn.classList.replace('btn-primary', 'btn-danger-outline');
                } else { 
                    aBtn.innerHTML = '<i class="fas fa-user-plus"></i> Añadir'; aBtn.disabled = false; aBtn.setAttribute('data-action', 'sendFriendReq'); aBtn.setAttribute('data-user', escapeHTML(data.username)); aBtn.classList.replace('btn-danger-outline', 'btn-primary');
                }
            }
            if(editBtn) editBtn.style.display = 'none';
        }
        
        const wall = document.getElementById('dProfileComments');
        if(wall) {
            wall.innerHTML = data.comments.map(c => `<div class="d-comment"><b style="color:var(--accent);">${escapeHTML(c.from)}</b> <span>${c.time} ${(data.username === currentUsername || isSuperAdmin) ? `<i class="fas fa-trash" style="color:var(--danger); cursor:pointer; margin-left:5px;" onclick="window.ui.deleteComment('${escapeHTML(data.username)}', '${c.id}')"></i>` : ''}</span><p>${escapeHTML(c.text)}</p></div>`).join('') || '<p style="color:var(--text-muted); font-size:0.9rem; text-align:center;">Muro vacío.</p>';
        }

        document.getElementById('discordProfileModal').classList.add('active');
        const editSection = document.getElementById('dProfileEditSection');
        if(editSection) editSection.style.display = 'none'; 

    } catch (err) { console.error("Error al renderizar perfil:", err); }
});

safeAddListener('dCommentBtn', 'click', () => { const text = escapeHTML(document.getElementById('dCommentText').value.trim()); if(text && viewingProfile) { socket.emit('addComment', { targetUser: viewingProfile, from: currentUsername, text: text, time: new Date().toLocaleDateString() }); document.getElementById('dCommentText').value = ''; } });
socket.on('newProfileComment', (data) => { if(viewingProfile === data.targetUser) socket.emit('getProfile', viewingProfile); });
safeAddListener('closeDiscordProfileBtn', 'click', () => { document.getElementById('discordProfileModal').classList.remove('active'); });

// ==========================================
// RENDERIZAR LISTAS SOCIALES (CON FOTOS)
// ==========================================
const renderFriendsUI = () => {
    const renderList = (containerId, arrayData, isRequest) => { 
        const el = document.getElementById(containerId);
        if(!el) return;
        
        el.innerHTML = arrayData.map(u => {
            const safeU = escapeHTML(u);
            
            let avatarImg = 'https://cdn-icons-png.flaticon.com/512/149/149071.png';
            if(avatarCache[u] && avatarCache[u] !== 'loading') {
                avatarImg = avatarCache[u];
            } else if (!avatarCache[u]) {
                fetchAvatar(u); 
            }

            if(isRequest) {
                return `
                <li class="f-item" style="cursor:pointer;" data-profile="${safeU}">
                    <div style="display:flex; align-items:center; gap:10px; flex:1;">
                        <img src="${avatarImg}" onerror="this.src='https://cdn-icons-png.flaticon.com/512/149/149071.png'" style="width:35px; height:35px; border-radius:50%; object-fit:cover;">
                        <span style="font-weight:bold; color:var(--text-main);">${safeU}</span>
                    </div>
                    <div style="display:flex; gap:5px;">
                        <button class="btn-primary" data-action="acceptFriend" data-user="${safeU}" style="padding:6px 12px; font-size:0.8rem; border-radius:8px; width:auto;">Aceptar</button> 
                        <button class="btn-danger-outline" data-action="rejectFriend" data-user="${safeU}" style="padding:6px 12px; font-size:0.8rem; border-radius:8px;"><i class="fas fa-times"></i></button>
                    </div>
                </li>`;
            } else {
                return `
                <li class="f-item" style="cursor:pointer;" data-profile="${safeU}">
                    <div style="display:flex; align-items:center; gap:10px; flex:1;">
                        <img src="${avatarImg}" onerror="this.src='https://cdn-icons-png.flaticon.com/512/149/149071.png'" style="width:35px; height:35px; border-radius:50%; object-fit:cover;">
                        <span style="font-weight:bold; color:var(--text-main);">${safeU}</span>
                    </div>
                    <button class="btn-danger-outline" data-action="removeFriend" data-user="${safeU}" title="Eliminar Amigo" style="padding:6px 10px; border-radius:8px; border:none; background:transparent;"><i class="fas fa-trash"></i></button>
                </li>`;
            }
        }).join('') || '<p style="color:var(--text-muted); font-size:0.9rem; text-align:center;">Lista vacía.</p>'; 
    };

    renderList('myFriendsList', myFriends, false); 
    renderList('pendingRequestsList', myRequests, true);
    renderMyRoomsUI(); 
};

socket.on('friendRequestReceived', ({ from, to }) => { 
    if(to === currentUsername && !myRequests.includes(from) && !myFriends.includes(from)) { 
        myRequests.push(from); 
        setDoc(doc(db, "usuarios", currentUserUid), { friendRequests: myRequests }, { merge: true }); 
        vibrate(200); 
        showToast(`¡${escapeHTML(from)} te envió una solicitud!`, "success");
        const b = document.getElementById('reqTabBadge'); if(b) b.style.display = 'inline-block';
        const ns = document.getElementById('navSocialBadge'); if(ns) ns.style.display = 'block';
        renderFriendsUI(); 
    }
});

socket.on('friendRequestAccepted', ({ from, to }) => { 
    if(to === currentUsername && !myFriends.includes(from)) { 
        myFriends.push(from); 
        setDoc(doc(db, "usuarios", currentUserUid), { friends: myFriends }, { merge: true }); 
        showToast(`¡${escapeHTML(from)} aceptó tu solicitud!`, "success");
        renderFriendsUI(); 
    }
});

safeAddListener('toggleRoomUsersBtn', 'click', () => document.getElementById('roomUsersPanel').classList.toggle('active'));
safeAddListener('closeRoomUsersBtn', 'click', () => document.getElementById('roomUsersPanel').classList.remove('active'));

socket.on('updateUserList', (users) => {
    users.forEach(u => avatarCache[u.username] = u.avatar);
    const rl = document.getElementById('roomUsersList');
    if(rl) rl.innerHTML = users.map(u => `<li class="f-item" data-profile="${escapeHTML(u.username)}" style="padding: 10px; cursor:pointer;"><div style="display:flex; align-items:center; gap:10px;"><img src="${u.avatar || 'https://cdn-icons-png.flaticon.com/512/149/149071.png'}" onerror="this.src='https://cdn-icons-png.flaticon.com/512/149/149071.png'" style="width:35px; height:35px; border-radius:50%; object-fit:cover;"><div><span style="color:${(u.username === currentUsername) ? userColor : (u.color||'#fff')}; font-weight:700; font-size:0.9rem;">${escapeHTML(u.username)}</span><br><small style="color:var(--text-muted); font-size:0.75rem;">${escapeHTML(u.status)}</small></div></div></li>`).join('') || '<p style="color:var(--text-muted); text-align:center; font-size:0.8rem;">Solo tú estás aquí.</p>';
});

socket.on('updateGlobalUsers', (users) => {
    users.forEach(u => avatarCache[u.username] = u.avatar);
    renderFriendsUI(); 
    
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
// ENVÍO DE MENSAJES Y ARCHIVOS
// ==========================================
const enviarMensaje = (texto, tipo = 'text') => {
    if (!texto) return;
    const safeText = tipo === 'text' ? escapeHTML(texto) : texto; 
    const idUnicoMsg = Date.now().toString() + Math.floor(Math.random()*1000); 
    
    socket.emit('chatMessage', { msgId: idUnicoMsg, uid: currentUserUid, username: currentUsername, text: safeText, type: tipo, room: currentRoom, color: userColor, avatar: userAvatar, bubbleBg: userBubbleColor, bubbleOpacity: userBubbleOpacity, reply: replyingTo, time: new Date().toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'}) });
    const cbtn = document.getElementById('cancelReplyBtn'); if(cbtn) cbtn.click(); 
};

safeAddListener('chatForm', 'submit', (e) => { 
    e.preventDefault(); 
    const mi = document.getElementById('messageInput');
    if(mi) { enviarMensaje(mi.value.trim(), 'text'); mi.value = ''; }
});

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
socket.on('loadHistory', (history) => { const cm = document.getElementById('chatMessages'); if(cm) { cm.innerHTML = ''; history.forEach(msg => renderMessage(msg, true)); cm.scrollTop = cm.scrollHeight; }});

const renderMessage = (msg, isHistoryLoad = false) => {
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
        rHtml = `<div class="quoted-message" onclick="window.ui.scrollToMessage('${msg.reply.msgId}')" style="border-left-color: ${isMe ? '#fff' : cNameColor}; cursor:pointer;"><strong style="color: ${isMe ? '#fff' : cNameColor};">${safeReplyUser}</strong><p>${isReplyMedia ? '📷 Media' : safeReplyText}</p></div>`;
    }

    let content = '';
    if (msg.type === 'image') content = `<img src="${msg.text}" class="msg-image compact-img" onclick="document.getElementById('lightboxImg').src=this.src; document.getElementById('lightboxModal').classList.add('active');">`;
    else if (msg.type === 'file') {
        const splitIndex = msg.text.indexOf('|');
        const fName = escapeHTML(msg.text.substring(0, splitIndex));
        const fData = msg.text.substring(splitIndex + 1);
        content = `<div class="file-message"><i class="fas fa-file-alt"></i> <a href="${fData}" download="${fName}" style="color:inherit; text-decoration:none;">${fName}</a></div>`;
    }
    else content = `<p class="text">${msg.text}</p>`;

    div.innerHTML = `<div class="msg-header" data-profile="${safeUsername}" style="cursor:pointer;"><img src="${safeAvatar}" onerror="this.src='https://cdn-icons-png.flaticon.com/512/149/149071.png'" class="msg-avatar"><span style="color: ${cNameColor}; font-weight: 800;">${safeUsername}</span></div>${rHtml} ${content} <div class="msg-footer"><span class="time">${msg.time}</span></div>`;
    
    div.addEventListener('contextmenu', (e) => { e.preventDefault(); showContextMenu(e, msg); });
    let touchTimer;
    div.addEventListener('touchstart', (e) => { touchTimer = window.setTimeout(() => showContextMenu(e, msg), 600); }, {passive: true});
    div.addEventListener('touchend', () => clearTimeout(touchTimer)); 
    div.addEventListener('touchmove', () => clearTimeout(touchTimer));

    const cm = document.getElementById('chatMessages'); 
    if(cm) { cm.appendChild(div); cm.scrollTop = cm.scrollHeight; }
    
    if(!isHistoryLoad && !isMe && useNotifs) { 
        if(msg.room === currentRoom) {
            if(!mutedRooms.includes(msg.room)) { const ns = document.getElementById('notificationSound'); if(ns) ns.play().catch(()=>{}); vibrate(150); }
        } else {
            if(msg.room.includes('_')) {
                if(!myRooms.includes(msg.room)) { myRooms.push(msg.room); saveAppPrefs(); renderMyRoomsUI(); }
                const bChats = document.getElementById('dmTabBadge'); if(bChats) bChats.style.display = 'inline-block';
                const sChats = document.getElementById('navChatsBadge'); if(sChats) sChats.style.display = 'block';
                showToast(`Nuevo mensaje privado de ${escapeHTML(msg.username)}`, 'success');
                const ns = document.getElementById('notificationSound'); if(ns) ns.play().catch(()=>{}); vibrate(150);
            } else if (!mutedRooms.includes(msg.room)) {
                showToast(`Nuevo mensaje en ${escapeHTML(msg.room)}`, 'success');
            }
        }
    }
};

socket.on('message', (msg) => {
    if(msg.room === currentRoom) {
        renderMessage(msg);
    } else if(msg.room.includes('_') && msg.room.includes(currentUsername)) {
        if(!myRooms.includes(msg.room)) { myRooms.push(msg.room); saveAppPrefs(); renderMyRoomsUI(); }
        const bChats = document.getElementById('dmTabBadge'); if(bChats) bChats.style.display = 'inline-block';
        const sChats = document.getElementById('navChatsBadge'); if(sChats) sChats.style.display = 'block';
        showToast(`Nuevo mensaje privado de ${escapeHTML(msg.username)}`, 'success');
        if(useNotifs) { const ns = document.getElementById('notificationSound'); if(ns) ns.play().catch(()=>{}); vibrate(150); }
    } else if (myRooms.includes(msg.room) && !mutedRooms.includes(msg.room) && useNotifs) {
        showToast(`Nuevo mensaje en ${escapeHTML(msg.room)}`, 'success');
    }
});

// COMPARTIR Y MENÚ CONTEXTUAL DE MENSAJES
const ctxMenu = document.getElementById('contextMenu');
const showContextMenu = (e, msgData) => {
    selectedMsgContext = msgData;
    let x = e.pageX || (e.touches && e.touches[0].pageX); let y = e.pageY || (e.touches && e.touches[0].pageY);
    if(x + 160 > window.innerWidth) x -= 160; if(y + 150 > window.innerHeight) y -= 150;
    ctxMenu.style.left = `${x}px`; ctxMenu.style.top = `${y}px`; ctxMenu.classList.add('active');
    document.getElementById('ctxSaveSticker').style.display = msgData.type === 'image' ? 'flex' : 'none';
    document.getElementById('ctxDelete').style.display = (msgData.uid === currentUserUid || isSuperAdmin) ? 'flex' : 'none';
    vibrate(50);
};

safeAddListener('ctxProfile', 'click', () => { window.ui.openProfile(selectedMsgContext.username); ctxMenu.classList.remove('active'); });
safeAddListener('ctxReply', 'click', () => {
    replyingTo = { username: selectedMsgContext.username, text: selectedMsgContext.text, msgId: selectedMsgContext.msgId }; 
    document.getElementById('replyName').textContent = escapeHTML(selectedMsgContext.username);
    document.getElementById('replyText').textContent = selectedMsgContext.type === 'image' ? '📷 Imagen' : escapeHTML(selectedMsgContext.text);
    document.getElementById('replyPreview').classList.add('active'); 
    const mi = document.getElementById('messageInput'); if(mi) mi.focus();
    ctxMenu.classList.remove('active');
});

safeAddListener('ctxShare', 'click', async () => {
    if(!selectedMsgContext) return;
    const isMedia = selectedMsgContext.type === 'image' || selectedMsgContext.type === 'file';
    const shareText = isMedia ? `Mira esto en la sala de Nani App` : `De ${selectedMsgContext.username}: "${selectedMsgContext.text}"`;
    const shareUrl = isMedia ? '' : window.location.href; 
    
    if (navigator.share && !isMedia) {
        try { await navigator.share({ title: 'Nani? App', text: shareText, url: shareUrl }); } catch (err) {}
    } else {
        try { await navigator.clipboard.writeText(shareText + " " + window.location.href); showToast("Copiado al portapapeles.", "success"); } 
        catch(e) { showToast("Error al copiar.", "error"); }
    }
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