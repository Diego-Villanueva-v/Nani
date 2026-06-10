const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const cors = require('cors');

const app = express();
app.use(cors());
const server = http.createServer(app);
const io = new Server(server, { cors: { origin: "*" } });

// Salas iniciales
let activeRooms = [
    { id: 'General', name: 'General', creator: 'Sistema' },
    { id: 'Programación', name: 'Programación', creator: 'Sistema' },
    { id: 'Juegos', name: 'Juegos', creator: 'Sistema' }
];

let activeUsers = {}; 
let profileComments = {}; 
let roomHistory = {}; // Guarda el historial de mensajes por sala

// Lista de Super Administradores
const SUPER_ADMINS = ['unknownlineof', 'Diego'];

io.on('connection', (socket) => {
    
    socket.on('joinRoom', (userData) => {
        if (activeUsers[socket.id]) socket.leave(activeUsers[socket.id].room);
        
        socket.join(userData.room);
        activeUsers[socket.id] = userData;
        
        io.emit('updateRooms', activeRooms);
        
        // Enviar historial de la sala al usuario que acaba de entrar
        if (!roomHistory[userData.room]) roomHistory[userData.room] = [];
        socket.emit('loadHistory', roomHistory[userData.room]);

        // Filtrar usuarios únicos por nombre para no repetir en UI
        const getUniqueUsers = (usersArray) => {
            const unique = {};
            usersArray.forEach(u => unique[u.username] = u);
            return Object.values(unique);
        };

        io.to(userData.room).emit('updateUserList', getUniqueUsers(Object.values(activeUsers).filter(u => u.room === userData.room && !u.room.includes('_'))));
        io.emit('updateGlobalUsers', getUniqueUsers(Object.values(activeUsers)));
    });

    socket.on('chatMessage', (data) => {
        // Guardar en el historial (Límite 500 mensajes)
        if (!roomHistory[data.room]) roomHistory[data.room] = [];
        data.msgId = Date.now().toString(); // ID único para poder eliminarlo
        roomHistory[data.room].push(data);
        if (roomHistory[data.room].length > 500) roomHistory[data.room].shift();

        io.to(data.room).emit('message', data);
    });

    socket.on('deleteMessage', ({ room, msgId, requester }) => {
        if (SUPER_ADMINS.includes(requester)) {
            if (roomHistory[room]) {
                roomHistory[room] = roomHistory[room].filter(m => m.msgId !== msgId);
                io.to(room).emit('messageDeleted', msgId);
            }
        }
    });

    // --- SISTEMA DE PERFILES DISCORD ---
    socket.on('getProfile', (targetUser) => {
        const user = Object.values(activeUsers).find(u => u.username === targetUser) || {};
        const comments = profileComments[targetUser] || [];
        socket.emit('profileData', { username: targetUser, status: user.status, avatar: user.avatar, color: user.color, comments });
    });

    socket.on('addComment', ({ targetUser, from, text, time }) => {
        if(!profileComments[targetUser]) profileComments[targetUser] = [];
        profileComments[targetUser].push({ from, text, time });
        io.emit('newProfileComment', { targetUser, comment: { from, text, time } });
    });

    // --- GESTIÓN DE SALAS ---
    socket.on('createRoom', ({ roomName, creator }) => {
        if (!activeRooms.find(r => r.id === roomName) && roomName.trim() !== '') {
            activeRooms.push({ id: roomName, name: roomName, creator: creator });
            io.emit('updateRooms', activeRooms);
        }
    });

    socket.on('deleteRoom', ({ roomName, requester }) => {
        const room = activeRooms.find(r => r.id === roomName);
        if (room && room.id !== 'General' && room.id !== 'Programación' && room.id !== 'Juegos') {
            // Solo el creador o un Super Admin puede borrarla
            if (room.creator === requester || SUPER_ADMINS.includes(requester)) {
                activeRooms = activeRooms.filter(r => r.id !== roomName);
                delete roomHistory[roomName];
                io.emit('updateRooms', activeRooms);
                io.emit('forceLeaveRoom', roomName); // Obliga a todos a salir de esa sala
            }
        }
    });

    socket.on('disconnect', () => {
        const user = activeUsers[socket.id];
        if (user) {
            delete activeUsers[socket.id];
            
            const getUniqueUsers = (arr) => {
                const uniq = {}; arr.forEach(u => uniq[u.username] = u); return Object.values(uniq);
            };

            io.to(user.room).emit('updateUserList', getUniqueUsers(Object.values(activeUsers).filter(u => u.room === user.room && !u.room.includes('_'))));
            io.emit('updateGlobalUsers', getUniqueUsers(Object.values(activeUsers)));
        }
    });
});

const PORT = process.env.PORT || 8000;
server.listen(PORT, () => console.log(`Nani? V3.0 Server (Synthwave) en puerto ${PORT}`));