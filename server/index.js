const express = require("express");
const http = require("http");
const { Server } = require("socket.io");
const cors = require("cors");

const app = express();
app.use(cors());
const server = http.createServer(app);
const io = new Server(server, {
  cors: {
    origin: "*",
    methods: ["GET", "POST"],
  },
});

const users = {};

io.on("connection", (socket) => {
  socket.on("join-room", ({ roomId, name }) => {
    socket.join(roomId);
    users[socket.id] = { roomId, name };

    // Notify the new user of existing users
    const otherUsers = Object.keys(users).filter(
      (id) => id !== socket.id && users[id].roomId === roomId
    );

    socket.emit("all-users", { users: otherUsers });

    // Notify other users about new user
    socket.to(roomId).emit("user-joined", { userId: socket.id });

    console.log(`${name} joined room: ${roomId}`);
  });

  socket.on("offer", ({ offer, to }) => {
    io.to(to).emit("offer", { offer, from: socket.id });
  });

  socket.on("answer", ({ answer, to }) => {
    io.to(to).emit("answer", { answer, from: socket.id });
  });

  socket.on("ice-candidate", ({ candidate, to }) => {
    io.to(to).emit("ice-candidate", { candidate, from: socket.id });
  });

  socket.on("send-message", ({ message, room }) => {
    socket.to(room).emit("receive-message", { message });
  });

  socket.on("disconnect", () => {
    const user = users[socket.id];
    if (user) {
      const { roomId } = user;
      socket.to(roomId).emit("user-disconnected", socket.id);
      delete users[socket.id];
    }
  });
});

server.listen(5000, () => {
  console.log("Socket.IO server running on http://localhost:5000");
});
