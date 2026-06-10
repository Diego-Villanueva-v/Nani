const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const cors = require('cors');

const app = express();
app.use(cors());
const server = http.createServer(app);
const io = new Server(server, { cors: { origin: "*" } });

let activeRooms = [
    { id: 'General', name: 'General', creator: 'Sistema' },
    { id: 'Programacion', name: 'Programación', creator: 'Sistema' },
    { id: 'Juegos', name: 'Juegos', creator: 'Sistema' }
];

let activeUsers = {}; 
let profileComments = {}; 
let roomHistory = {}; 

const SUPER_ADMIN_EMAIL = 'unknownlineof@gmail.com';

io.on('connection', (socket) => {
    socket.on('joinRoom', (userData) => {
        if (activeUsers[socket.id]) socket.leave(activeUsers[socket.id].room);
        
        userData.isAdmin = userData.email === SUPER_ADMIN_EMAIL;
        
        socket.join(userData.room);
        activeUsers[socket.id] = userData;
        io.emit('updateRooms', activeRooms);
        
        if (userData.room !== 'Lobby') {
            if (!roomHistory[userData.room]) roomHistory[userData.room] = [];
            socket.emit('loadHistory', roomHistory[userData.room]);
        }

        const getUniqueUsers = (arr) => Object.values(arr.reduce((acc, u) => ({...acc, [u.username]: u}), {}));
        io.to(userData.room).emit('updateUserList', getUniqueUsers(Object.values(activeUsers).filter(u => u.room === userData.room && !u.room.includes('_'))));
        
        // Ahora sí envía TODOS los usuarios globales, incluyendo los del Lobby
        io.emit('updateGlobalUsers', getUniqueUsers(Object.values(activeUsers)));
    });

    socket.on('chatMessage', (data) => {
        if (!roomHistory[data.room]) roomHistory[data.room] = [];
        data.msgId = Date.now().toString(); 
        roomHistory[data.room].push(data);
        if (roomHistory[data.room].length > 500) roomHistory[data.room].shift();
        io.to(data.room).emit('message', data);
    });

    socket.on('deleteMessage', ({ room, msgId, requesterEmail }) => {
        if (requesterEmail === SUPER_ADMIN_EMAIL) {
            if (roomHistory[room]) {
                roomHistory[room] = roomHistory[room].filter(m => m.msgId !== msgId);
                io.to(room).emit('messageDeleted', msgId);
            }
        }
    });

    socket.on('getProfile', (targetUser) => {
        const user = Object.values(activeUsers).find(u => u.username === targetUser) || {};
        const comments = profileComments[targetUser] || [];
        
        // Si el usuario no está activo, igual devuelve sus datos por defecto para evitar que el front crashee
        socket.emit('profileData', { 
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

    socket.on('addComment', ({ targetUser, from, text, time }) => {
        if(!profileComments[targetUser]) profileComments[targetUser] = [];
        profileComments[targetUser].push({ id: Date.now().toString(), from, text, time });
        io.emit('newProfileComment', { targetUser });
    });

    socket.on('deleteComment', ({ targetUser, commentId, requesterUser, requesterEmail }) => {
        if (targetUser === requesterUser || requesterEmail === SUPER_ADMIN_EMAIL) {
            if (profileComments[targetUser]) profileComments[targetUser] = profileComments[targetUser].filter(c => c.id !== commentId);
            io.emit('newProfileComment', { targetUser });
        }
    });

    socket.on('sendFriendRequest', ({ from, to }) => io.emit('friendRequestReceived', { from, to }));
    socket.on('acceptFriendRequest', ({ from, to }) => io.emit('friendRequestAccepted', { from, to }));

    socket.on('createRoom', ({ roomName, creator }) => {
        if (!activeRooms.find(r => r.id === roomName) && roomName.trim() !== '') {
            activeRooms.push({ id: roomName, name: roomName, creator: creator });
            io.emit('updateRooms', activeRooms);
        }
    });

    socket.on('deleteRoom', ({ roomName, requesterUser, requesterEmail }) => {
        const room = activeRooms.find(r => r.id === roomName);
        if (room && !['General', 'Programacion', 'Juegos'].includes(room.id)) {
            if (room.creator === requesterUser || requesterEmail === SUPER_ADMIN_EMAIL) {
                activeRooms = activeRooms.filter(r => r.id !== roomName);
                delete roomHistory[roomName];
                io.emit('updateRooms', activeRooms);
                io.emit('forceLeaveRoom', roomName); 
            }
        }
    });

    socket.on('disconnect', () => {
        const user = activeUsers[socket.id];
        if (user) {
            delete activeUsers[socket.id];
            const getUniqueUsers = (arr) => Object.values(arr.reduce((acc, u) => ({...acc, [u.username]: u}), {}));
            io.to(user.room).emit('updateUserList', getUniqueUsers(Object.values(activeUsers).filter(u => u.room === user.room && !u.room.includes('_'))));
            io.emit('updateGlobalUsers', getUniqueUsers(Object.values(activeUsers)));
        }
    });
});

const PORT = process.env.PORT || 8000;
server.listen(PORT, () => console.log(`Nani? Server corriendo en puerto ${PORT}`));