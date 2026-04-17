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
        const data = fs.readFileSync(SCORES_FILE, 'utf8');
        const scores = JSON.parse(data).sort((a,b) => b.kills - a.kills).slice(0, 10);
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

    // Tell the new player about all existing players
    socket.emit('currentPlayers', players);

    // Broadcast player count
    io.emit('playerCount', Object.keys(players).length);

    // Join Game
    socket.on('joinGame', (data) => {
        players[socket.id] = { 
            id: socket.id, 
            username: data.username, 
            skin: data.skin, 
            position: { x: 0, y: 20, z: 0 }, 
            rotation: { y: 0 } 
        };
        io.emit('currentPlayers', players); // Send everyone the latest info
        io.emit('playerCount', Object.keys(players).length);
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
            
            let shooterRec = scoresData.find(s => s.playerName === shooterName);
            if (!shooterRec) { shooterRec = { playerName: shooterName, kills: 0, deaths: 0 }; scoresData.push(shooterRec); }
            shooterRec.kills++;
            
            let victimRec = scoresData.find(s => s.playerName === victimName);
            if (!victimRec) { victimRec = { playerName: victimName, kills: 0, deaths: 0 }; scoresData.push(victimRec); }
            victimRec.deaths++;
            
            fs.writeFileSync(SCORES_FILE, JSON.stringify(scoresData));
            io.emit('scoresUpdated');
            
            io.emit('killFeed', { 
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
        socket.broadcast.emit('playerMoved', players[socket.id]);
    });

    socket.on('disconnect', () => {
        console.log('user disconnected: ' + socket.id);
        delete players[socket.id];
        io.emit('playerDisconnect', socket.id);
        io.emit('playerCount', Object.keys(players).length);
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
