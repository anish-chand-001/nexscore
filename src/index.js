import express from 'express';
import { matchesRouter } from './routes/matches.route.js';
import dotenv from 'dotenv'
import http  from 'http'
import { attachWebSocketServer } from './ws/server.js';
import { log } from 'console';

dotenv.config()
const app = express();
const PORT = process.env.PORT || 8000;
const HOST = process.env.HOST  || '0.0.0.0'
const server = http.createServer(app);

// Middleware (optional but useful)
app.use(express.json());
app.use('/matches', matchesRouter);

const {broadcastMatchCreated} = attachWebSocketServer(server)
app.locals.broadcastMatchCreated = broadcastMatchCreated

// Start server
server.listen(PORT, HOST,() => {
  const baseURL = HOST == '0.0.0.0' ? `http://localhost:${PORT}`:`wss://${HOST}:${PORT}`
  console.log(`Server running on ${baseURL}`);
  console.log(`websocket server is running on ${baseURL.replace('http','ws')}/ws`);
  

});