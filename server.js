const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const cors = require('cors');

const app = express();
app.use(cors());
const server = http.createServer(app);
const io = new Server(server, { cors: { origin: "*" }, maxHttpBufferSize: 1e8 }); 

let activeUsers = {}; 

io.on('connection', (socket) => {
    
    socket.on('joinRoom', (userData) => {
        if (activeUsers[socket.id]) socket.leave(activeUsers[socket.id].room);
        
        socket.join(userData.room);
        activeUsers[socket.id] = userData;
        
        const getUniqueUsers = (arr) => Object.values(arr.reduce((acc, u) => ({...acc, [u.username]: u}), {}));
        io.to(userData.room).emit('updateUserList', getUniqueUsers(Object.values(activeUsers).filter(u => u.room === userData.room && !u.room.includes('_'))));
        io.emit('updateGlobalUsers', getUniqueUsers(Object.values(activeUsers)));
    });

    socket.on('chatMessageNotification', (data) => {
        if(data.room.includes('_')) {
            const dmUsers = data.room.split('_');
            for(let sid in activeUsers) {
                if(dmUsers.includes(activeUsers[sid].username)) {
                    io.to(sid).emit('notification', data);
                }
            }
        } else {
            socket.to(data.room).emit('notification', data);
        }
    });

    socket.on('sendFriendRequest', ({ from, to }) => io.emit('friendRequestReceived', { from, to }));
    socket.on('acceptFriendRequest', ({ from, to }) => io.emit('friendRequestAccepted', { from, to }));

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