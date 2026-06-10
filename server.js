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

io.on('connection', (socket) => {
    socket.on('joinRoom', ({ username, room, color, avatar }) => {
        if (activeUsers[socket.id]) {
            socket.leave(activeUsers[socket.id].room);
        }
        
        socket.join(room);
        activeUsers[socket.id] = { username, room, color, avatar };
        
        io.emit('updateRooms', activeRooms);
        // Filtramos para no mostrar salas privadas o de guardados en la lista pública
        io.to(room).emit('updateUserList', Object.values(activeUsers).filter(u => u.room === room && !u.room.includes('_')));
        io.emit('updateGlobalUsers', Object.values(activeUsers));
    });

    socket.on('chatMessage', (data) => {
        io.to(data.room).emit('message', data);
    });

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
server.listen(PORT, () => console.log(`Nani? Server corriendo en puerto ${PORT}`));