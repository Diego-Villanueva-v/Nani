const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const cors = require('cors');

const app = express();
app.use(cors());
const server = http.createServer(app);
const io = new Server(server, { cors: { origin: "*" } });

let activeRooms = ['General', 'Programación', 'Juegos', 'Gatos Tuxedo'];
let activeUsers = {}; // { socketId: { username, room, color } }

io.on('connection', (socket) => {
    // Cuando un usuario entra o cambia de sala
    socket.on('joinRoom', ({ username, room, color }) => {
        if (activeUsers[socket.id]) {
            socket.leave(activeUsers[socket.id].room);
        }
        
        socket.join(room);
        activeUsers[socket.id] = { username, room, color };
        
        io.emit('updateRooms', activeRooms);
        io.to(room).emit('updateUserList', Object.values(activeUsers).filter(u => u.room === room));
        io.emit('updateGlobalUsers', Object.values(activeUsers));
    });

    // Retransmitir mensajes a la sala correspondiente
    socket.on('chatMessage', (data) => {
        io.to(data.room).emit('message', data);
    });

    // Gestión de salas
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

    // Desconexión
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
server.listen(PORT, () => console.log(`Servidor en puerto ${PORT}`));