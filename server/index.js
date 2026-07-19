const http = require('http');
const express = require('express');
const { Server } = require('socket.io');
const cors = require('cors');

const { addUser, removeUser, getUser, getUsersInRoom } = require('./users');
const router = require('./router');

const PORT = process.env.PORT || 5000;
// Comma-separated list of allowed origins, e.g. "https://myapp.com,http://localhost:3000"
const ALLOWED_ORIGINS = process.env.CLIENT_ORIGIN
  ? process.env.CLIENT_ORIGIN.split(',').map((origin) => origin.trim())
  : '*';

const app = express();
const server = http.createServer(app);

// Socket.IO v4 requires CORS to be configured on the Server instance itself,
// not just on the Express app (this was missing before and blocks browser clients).
const io = new Server(server, {
  cors: {
    origin: ALLOWED_ORIGINS,
    methods: ['GET', 'POST'],
  },
});

app.use(cors({ origin: ALLOWED_ORIGINS }));
app.use(router);

io.on('connection', (socket) => {
  socket.on('join', ({ name, room }, callback) => {
    if (typeof callback !== 'function') return;

    const { error, user } = addUser({ id: socket.id, name, room });

    if (error) return callback(error);

    socket.join(user.room);

    socket.emit('message', { user: 'admin', text: `${user.name}, welcome to room ${user.room}.` });
    socket.broadcast.to(user.room).emit('message', { user: 'admin', text: `${user.name} has joined!` });

    io.to(user.room).emit('roomData', { room: user.room, users: getUsersInRoom(user.room) });

    callback();
  });

  socket.on('sendMessage', (message, callback) => {
    const user = getUser(socket.id);

    // Guard against a client sending a message before/after a valid join
    // (e.g. after a disconnect or a server restart wiped the in-memory user list).
    if (!user) {
      if (typeof callback === 'function') callback('You are not in a room. Please rejoin.');
      return;
    }

    io.to(user.room).emit('message', { user: user.name, text: message });

    if (typeof callback === 'function') callback();
  });

  socket.on('disconnect', () => {
    const user = removeUser(socket.id);

    if (user) {
      io.to(user.room).emit('message', { user: 'Admin', text: `${user.name} has left.` });
      io.to(user.room).emit('roomData', { room: user.room, users: getUsersInRoom(user.room) });
    }
  });
});

server.listen(PORT, () => console.log(`Server has started on port ${PORT}.`));
