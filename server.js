const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const cors = require('cors');

const app = express();
app.use(cors());
const server = http.createServer(app);
const io = new Server(server, { cors: { origin: "*" } });

let activeRooms = ['General', 'Programación', 'Juegos', 'Gatos Tuxedo'];
let activeUsers = {}; 
let profileComments = {}; // { username: [ {from, text, time} ] }

io.on('connection', (socket) => {
    // Al unirse, recibimos todos los datos nuevos (estado, opacidad, etc)
    socket.on('joinRoom', (userData) => {
        if (activeUsers[socket.id]) socket.leave(activeUsers[socket.id].room);
        
        socket.join(userData.room);
        activeUsers[socket.id] = userData;
        
        io.emit('updateRooms', activeRooms);
        io.to(userData.room).emit('updateUserList', Object.values(activeUsers).filter(u => u.room === userData.room && !u.room.includes('_')));
        io.emit('updateGlobalUsers', Object.values(activeUsers));
    });

    socket.on('chatMessage', (data) => {
        io.to(data.room).emit('message', data);
    });

    // --- SISTEMA DE PERFILES ESTILO DISCORD ---
    socket.on('getProfile', (targetUser) => {
        // Buscamos los datos actuales del usuario
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
    socket.on('createRoom', (roomName) => {
        if (!activeRooms.includes(roomName) && roomName.trim() !== '') {
            activeRooms.push(roomName);
            io.emit('updateRooms', activeRooms);
        }
    });

    socket.on('deleteRoom', (roomName) => {
        if (roomName !== 'General') {
            activeRooms = activeRooms.filter(r => r !== roomName);
            io.emit('updateRooms', activeRooms);
        }
    });

    socket.on('disconnect', () => {
        const user = activeUsers[socket.id];
        if (user) {
            delete activeUsers[socket.id];
            io.to(user.room).emit('updateUserList', Object.values(activeUsers).filter(u => u.room === user.room));
            io.emit('updateGlobalUsers', Object.values(activeUsers));
        }
    });
});

const PORT = process.env.PORT || 8000;
server.listen(PORT, () => console.log(`Nani? Server V2.0 corriendo en puerto ${PORT}`));