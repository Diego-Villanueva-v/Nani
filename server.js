const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const cors = require('cors');

const app = express();
app.use(cors());
const server = http.createServer(app);
const io = new Server(server, { cors: { origin: "*" }, maxHttpBufferSize: 1e8 }); 

let activeRooms = [
    { id: 'General', name: 'General', creator: 'Sistema', uid: '000000', description: 'Sala principal de la comunidad.', avatar: 'https://cdn-icons-png.flaticon.com/512/1370/1370907.png' },
    { id: 'Programacion', name: 'Programación', creator: 'Sistema', uid: '000000', description: 'Para hablar de código y bugs.', avatar: 'https://cdn-icons-png.flaticon.com/512/1370/1370907.png' },
    { id: 'Juegos', name: 'Juegos', creator: 'Sistema', uid: '000000', description: 'Gamer zone.', avatar: 'https://cdn-icons-png.flaticon.com/512/1370/1370907.png' }
];

let activeUsers = {}; 
let profileComments = {}; 
let roomHistory = {}; 

const SUPER_ADMIN_EMAIL = 'unknownlineof@gmail.com';

const broadcastRoomsUpdate = () => {
    const roomsWithCounts = activeRooms.map(r => {
        const count = Object.values(activeUsers).filter(u => u.room === r.id).length;
        return { ...r, userCount: count };
    });
    io.emit('updateRooms', roomsWithCounts);
};

io.on('connection', (socket) => {
    socket.on('joinRoom', (userData) => {
        if (activeUsers[socket.id]) socket.leave(activeUsers[socket.id].room);
        
        userData.isAdmin = userData.email === SUPER_ADMIN_EMAIL;
        socket.join(userData.room);
        activeUsers[socket.id] = userData;
        
        broadcastRoomsUpdate();
        
        if (userData.room !== 'Lobby') {
            if (!roomHistory[userData.room]) roomHistory[userData.room] = [];
            // Optimización RAM: Solo mandamos los últimos 50 para evitar lag
            socket.emit('loadHistory', roomHistory[userData.room].slice(-50));
        }

        const getUniqueUsers = (arr) => Object.values(arr.reduce((acc, u) => ({...acc, [u.username]: u}), {}));
        io.to(userData.room).emit('updateUserList', getUniqueUsers(Object.values(activeUsers).filter(u => u.room === userData.room && !u.room.includes('_'))));
        io.emit('updateGlobalUsers', getUniqueUsers(Object.values(activeUsers)));
    });

    socket.on('chatMessage', (data) => {
        if (!roomHistory[data.room]) roomHistory[data.room] = [];
        data.msgId = data.msgId || Date.now().toString(); // Usamos el ID del cliente o creamos uno
        roomHistory[data.room].push(data);
        if (roomHistory[data.room].length > 100) roomHistory[data.room].shift(); // Optimización: Solo guardamos 100 max en RAM
        io.to(data.room).emit('message', data);
    });

    socket.on('deleteMessage', ({ room, msgId, requesterUid, requesterEmail }) => {
        const msg = roomHistory[room]?.find(m => m.msgId === msgId);
        // VALIDACIÓN ESTRICTA DE LA PRIMARY KEY (UID)
        if (requesterEmail === SUPER_ADMIN_EMAIL || (msg && msg.uid === requesterUid)) {
            if (roomHistory[room]) {
                roomHistory[room] = roomHistory[room].filter(m => m.msgId !== msgId);
                io.to(room).emit('messageDeleted', msgId);
            }
        }
    });

    socket.on('getProfile', (targetUser) => {
        const user = Object.values(activeUsers).find(u => u.username === targetUser) || {};
        const comments = profileComments[targetUser] || [];
        
        socket.emit('profileData', { 
            uid: user.uid || '',
            username: targetUser, 
            status: user.status || 'Desconectado', 
            avatar: user.avatar || 'https://cdn-icons-png.flaticon.com/512/149/149071.png', 
            color: user.color || '#d946ef', 
            age: user.age || '', 
            gender: user.gender || '', 
            isAdmin: user.isAdmin || false, 
            comments 
        });
    });

    socket.on('getRoomProfile', (roomName) => {
        const room = activeRooms.find(r => r.id === roomName) || { name: roomName, creator: 'Desconocido', uid: '', description: 'Sala Temporal', avatar: 'https://cdn-icons-png.flaticon.com/512/1370/1370907.png' };
        socket.emit('roomProfileData', room);
    });

    socket.on('updateRoomProfile', ({ roomName, description, avatar, requesterUid }) => {
        const roomIndex = activeRooms.findIndex(r => r.id === roomName);
        if (roomIndex !== -1) {
            // El UID funciona como Primary Key para validar los permisos aquí
            if (activeRooms[roomIndex].uid === requesterUid || isSuperAdmin) {
                if(description) activeRooms[roomIndex].description = description;
                if(avatar) activeRooms[roomIndex].avatar = avatar;
                broadcastRoomsUpdate();
                io.emit('roomProfileData', activeRooms[roomIndex]);
            }
        }
    });

    socket.on('addComment', ({ targetUser, from, text, time }) => {
        if(!profileComments[targetUser]) profileComments[targetUser] = [];
        profileComments[targetUser].push({ id: Date.now().toString(), from, text, time });
        io.emit('newProfileComment', { targetUser });
    });

    socket.on('deleteComment', ({ targetUser, commentId, requesterUid, requesterEmail }) => {
        const targetActiveUser = Object.values(activeUsers).find(u => u.username === targetUser);
        if ((targetActiveUser && targetActiveUser.uid === requesterUid) || requesterEmail === SUPER_ADMIN_EMAIL) {
            if (profileComments[targetUser]) profileComments[targetUser] = profileComments[targetUser].filter(c => c.id !== commentId);
            io.emit('newProfileComment', { targetUser });
        }
    });

    socket.on('sendFriendRequest', ({ from, to }) => io.emit('friendRequestReceived', { from, to }));
    socket.on('acceptFriendRequest', ({ from, to }) => io.emit('friendRequestAccepted', { from, to }));

    socket.on('createRoom', ({ roomName, creator, uid }) => {
        if (!activeRooms.find(r => r.id === roomName) && roomName.trim() !== '') {
            activeRooms.push({ id: roomName, name: roomName, creator: creator, uid: uid, description: 'Una nueva sala pública.', avatar: 'https://cdn-icons-png.flaticon.com/512/1370/1370907.png' });
            broadcastRoomsUpdate();
        }
    });

    socket.on('deleteRoom', ({ roomName, requesterUid, requesterUser, requesterEmail }) => {
        const room = activeRooms.find(r => r.id === roomName);
        if (room && !['General', 'Programacion', 'Juegos'].includes(room.id)) {
            // DOBLE VALIDACION EXTREMA POR UID O EMAIL DE DIOS
            if (room.uid === requesterUid || room.creator === requesterUser || requesterEmail === SUPER_ADMIN_EMAIL) {
                activeRooms = activeRooms.filter(r => r.id !== roomName);
                delete roomHistory[roomName];
                broadcastRoomsUpdate();
                io.emit('forceLeaveRoom', roomName); 
            }
        }
    });

    socket.on('disconnect', () => {
        const user = activeUsers[socket.id];
        if (user) {
            delete activeUsers[socket.id];
            broadcastRoomsUpdate();
            const getUniqueUsers = (arr) => Object.values(arr.reduce((acc, u) => ({...acc, [u.username]: u}), {}));
            io.to(user.room).emit('updateUserList', getUniqueUsers(Object.values(activeUsers).filter(u => u.room === user.room && !u.room.includes('_'))));
            io.emit('updateGlobalUsers', getUniqueUsers(Object.values(activeUsers)));
        }
    });
});

const PORT = process.env.PORT || 8000;
server.listen(PORT, () => console.log(`Nani? Server corriendo en puerto ${PORT}`));