import express from 'express';
import { createServer } from 'http';
import { Server } from 'socket.io';
import path from 'path';

const app = express();
const httpServer = createServer(app);
const io = new Server(httpServer, {
  cors: {
    origin: "*",
    methods: ["GET", "POST"]
  }
});

// Serve static files
app.use(express.static(path.join(__dirname, '../../public')));

// WebSocket connection handling
io.on('connection', (socket) => {
  console.log('Client connected');

  // Handle audio data
  socket.on('audioData', (data) => {
    // Broadcast audio data to all connected clients except sender
    socket.broadcast.emit('audioStream', data);
  });

  // Handle latency measurements
  socket.on('latencyPing', (data) => {
    socket.emit('latencyPong', data);
  });

  socket.on('disconnect', () => {
    console.log('Client disconnected');
  });
});

const PORT = process.env.PORT || 3001;
httpServer.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
}); 