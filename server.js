const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const cors = require('cors');

const app = express();
app.use(cors());

const server = http.createServer(app);
const io = new Server(server, {
    cors: { origin: "*", methods: ["GET", "POST"] }
});

// Lista de salas globales en memoria
let activeRooms = ['General', 'Programación', 'Juegos', 'Gatos Tuxedo'];

io.on('connection', (socket) => {
    console.log('Un usuario se conectó:', socket.id);

    // Enviar las salas disponibles apenas alguien entra
    socket.emit('updateRooms', activeRooms);

    // Unirse a una sala temática
    socket.on('joinRoom', ({ username, room }) => {
        socket.join(room);
        socket.emit('message', { username: 'Sistema', text: `¡Bienvenido a la sala ${room}, ${username}!`, time: new Date().toLocaleTimeString() });
        socket.broadcast.to(room).emit('message', { username: 'Sistema', text: `${username} se ha unido al chat.`, time: new Date().toLocaleTimeString() });
    });

    // Retransmitir mensajes
    socket.on('chatMessage', (data) => {
        io.to(data.room).emit('message', {
            username: data.username,
            text: data.text,
            type: data.type || 'text',
            time: new Date().toLocaleTimeString()
        });
    });

    // Crear una nueva sala
    socket.on('createRoom', (roomName) => {
        if (!activeRooms.includes(roomName) && roomName.trim() !== '') {
            activeRooms.push(roomName);
            io.emit('updateRooms', activeRooms); // Avisar a todos para que se actualice su menú
        }
    });

    // Eliminar una sala
    socket.on('deleteRoom', (roomName) => {
        if (roomName !== 'General') { // Protegemos 'General' para que siempre haya una sala base
            activeRooms = activeRooms.filter(r => r !== roomName);
            io.emit('updateRooms', activeRooms); 
        }
    });

    socket.on('disconnect', () => {
        console.log('Un usuario se desconectó');
    });
});

const PORT = process.env.PORT || 8000;
server.listen(PORT, () => {
    console.log(`Servidor de chat corriendo en el puerto ${PORT}`);
});