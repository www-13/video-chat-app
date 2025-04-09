const express = require('express');
const http = require('http');
const socketIo = require('socket.io');
const app = express();
const server = http.createServer(app);
const io = socketIo(server);

app.use(express.static('public'));

io.on('connection', (socket) => {
  console.log('User connected:', socket.id);

  socket.on('joinRoom', (roomCode) => {
    socket.join(roomCode);
    console.log(`${socket.id} joined room: ${roomCode}`);
    socket.to(roomCode).emit('userJoined', socket.id);
  });

  socket.on('signal', (data) => {
    io.to(data.to).emit('signal', {
      signal: data.signal,
      from: socket.id
    });
  });

  socket.on('disconnect', () => {
    console.log('User disconnected:', socket.id);
  });
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
