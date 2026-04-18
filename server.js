const express = require('express');
const app = express();
const http = require('http');
const server = http.createServer(app);
const { Server } = require("socket.io");
const io = new Server(server);
const fs = require('fs');
const path = require('path');

// Simple JSON DB Setup
const DATA_DIR = path.join(__dirname, 'data');
const SCORES_FILE = path.join(DATA_DIR, 'scores.json');

if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR);
if (!fs.existsSync(SCORES_FILE)) fs.writeFileSync(SCORES_FILE, JSON.stringify([
    { playerName: 'Alpha', kills: 0, deaths: 0 }
]));

// Serve static files from the 'public' directory
app.use(express.static('public'));
app.use(express.json());

// Scoreboard API
app.get('/api/scores', (req, res) => {
    try {
        const room = req.query.room || 'GLOBAL';
        const data = fs.readFileSync(SCORES_FILE, 'utf8');
        const scores = JSON.parse(data).filter(s => s.room === room).sort((a,b) => b.kills - a.kills).slice(0, 10);
        res.json(scores);
    } catch {
        res.json([{ playerName: 'SysError', kills: 0, deaths: 0 }]);
    }
});

// Basic Multiplayer Game State
const players = {};

io.on('connection', (socket) => {
    console.log('a user connected: ' + socket.id);

    // Do not create player here, wait for joinGame
    // players[socket.id] = { id: socket.id, position: { x: 0, y: 0, z: 0 }, rotation: { y: 0 } };

    // Tell the new player about all existing players (Not really needed globally anymore, handled in joinGame)

    // Join Game
    socket.on('joinGame', (data) => {
        const room = data.room || 'GLOBAL';
        socket.join(room);
        players[socket.id] = { 
            id: socket.id, 
            username: data.username, 
            skin: data.skin, 
            room: room,
            position: { x: 0, y: 20, z: 0 }, 
            rotation: { y: 0 } 
        };
        
        const roomPlayers = {};
        let count = 0;
        Object.values(players).forEach(p => {
            if (p.room === room) {
                roomPlayers[p.id] = p;
                count++;
            }
        });
        
        io.to(room).emit('currentPlayers', roomPlayers);
        io.to(room).emit('playerCount', count);
    });
    
    // Scoring & Hit processing
    socket.on('registeredHit', (victimId) => {
        if (!players[socket.id] || !players[victimId]) return;
        // Broadcast the hit so the victim knows it died
        io.to(victimId).emit('youGotHit', { shooterId: socket.id, shooterName: players[socket.id].username });
    });
    
    socket.on('iDied', (shooterId) => {
        if (!players[socket.id] || !players[shooterId]) return;
        
        try {
            const data = fs.readFileSync(SCORES_FILE, 'utf8');
            let scoresData = JSON.parse(data);
            
            const shooterName = players[shooterId].username;
            const victimName = players[socket.id].username;
            const room = players[socket.id].room;
            
            let shooterRec = scoresData.find(s => s.playerName === shooterName && s.room === room);
            if (!shooterRec) { shooterRec = { playerName: shooterName, kills: 0, deaths: 0, room: room }; scoresData.push(shooterRec); }
            shooterRec.kills++;
            
            let victimRec = scoresData.find(s => s.playerName === victimName && s.room === room);
            if (!victimRec) { victimRec = { playerName: victimName, kills: 0, deaths: 0, room: room }; scoresData.push(victimRec); }
            victimRec.deaths++;
            
            fs.writeFileSync(SCORES_FILE, JSON.stringify(scoresData));
            io.to(room).emit('scoresUpdated');
            
            io.to(room).emit('killFeed', { 
                killer: shooterName, 
                victim: victimName,
                position: players[socket.id].position 
            });
            
        } catch (e) { console.error('DB Error'); }
    });

    // Ping
    socket.on('ping', (timestamp) => {
        socket.emit('pong', timestamp);
    });

    // When a player moves
    socket.on('playerMovement', (movementData) => {
        if (!players[socket.id]) return;
        players[socket.id].position = movementData.position;
        players[socket.id].rotation = movementData.rotation;
        socket.to(players[socket.id].room).emit('playerMoved', players[socket.id]);
    });

    socket.on('disconnect', () => {
        console.log('user disconnected: ' + socket.id);
        if (players[socket.id]) {
            const room = players[socket.id].room;
            delete players[socket.id];
            io.to(room).emit('playerDisconnect', socket.id);
            
            let count = 0;
            Object.values(players).forEach(p => { if (p.room === room) count++; });
            io.to(room).emit('playerCount', count);
        }
    });
});

let roundTime = 180;
let roundActive = true;

setInterval(() => {
    if (!roundActive) return;
    roundTime--;
    io.emit('timeUpdate', roundTime);
    
    if (roundTime <= 0) {
        roundActive = false;
        io.emit('roundEnd');
        
        setTimeout(() => {
            // Reset Database right before starting the next round
            fs.writeFileSync(SCORES_FILE, JSON.stringify([]));
            io.emit('scoresUpdated');
            
            roundTime = 180;
            roundActive = true;
            io.emit('roundStart');
        }, 8000);
    }
}, 1000);

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
    console.log(`Server is running on port:${PORT}`);
});
