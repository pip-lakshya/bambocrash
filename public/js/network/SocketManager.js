import * as THREE from 'three';
import { createDroneMesh } from '../game/Drone.js';

export class SocketManager {
    constructor(scene, username, skin, roomCode = 'GLOBAL') {
        this.scene = scene;
        this.socket = io(); 
        this.otherPlayers = {};
        
        this.username = username;
        this.skin = skin;
        this.roomCode = roomCode;
        
        this.socket.emit('joinGame', { username, skin, room: roomCode });
        
        this.setupEvents();
        
        setInterval(() => {
            this.socket.emit('ping', Date.now());
        }, 2000);
    }
    
    setupEvents() {
        this.socket.on('pong', (timestamp) => {
            const latency = Date.now() - timestamp;
            const pingText = document.getElementById('ping-text');
            if (pingText) pingText.innerText = `Ping: ${latency}ms`;
        });
        
        this.socket.on('playerCount', (count) => {
            const countText = document.getElementById('player-count');
            if (countText) countText.innerText = `Players: ${count}`;
        });
        
        this.socket.on('currentPlayers', (players) => {
            Object.keys(players).forEach(id => {
                if (id === this.socket.id) {
                    // Us
                } else if (!this.otherPlayers[id]) {
                    this.addOtherPlayer(players[id]);
                }
            });
        });
        
        this.socket.on('newPlayer', (playerInfo) => {
            // Unused since currentPlayers is broadcast on join, but good fallback
            if (!this.otherPlayers[playerInfo.id]) this.addOtherPlayer(playerInfo);
        });
        
        this.socket.on('playerDisconnect', (playerId) => {
            if (this.otherPlayers[playerId]) {
                this.scene.remove(this.otherPlayers[playerId].mesh);
                delete this.otherPlayers[playerId];
            }
        });
        
        this.socket.on('playerMoved', (playerInfo) => {
            if (this.otherPlayers[playerInfo.id]) {
                const pInfo = this.otherPlayers[playerInfo.id];
                pInfo.mesh.position.set(playerInfo.position.x, playerInfo.position.y, playerInfo.position.z);
                pInfo.mesh.rotation.y = playerInfo.rotation.y;
                pInfo.health = playerInfo.health;
                
                if (pInfo.healthBar) {
                    const hp = Math.max(0.01, playerInfo.health / 100);
                    pInfo.healthBar.scale.x = hp;
                    pInfo.healthBar.position.x = -2.5 * (1 - hp);
                }
                
                // Spin their rotors visually
                pInfo.rotors.forEach(r => r.rotation.y += 0.5);
            }
        });
    }
    
    addOtherPlayer(playerInfo) {
        const graphics = createDroneMesh(playerInfo.skin);
        const mesh = graphics.mesh;
        
        mesh.position.set(playerInfo.position.x, playerInfo.position.y, playerInfo.position.z);
        this.scene.add(mesh);
        
        // Add a name tag above them
        const canvas = document.createElement('canvas');
        const context = canvas.getContext('2d');
        context.font = 'Bold 40px Arial';
        context.fillStyle = 'rgba(255,255,255,1.0)';
        context.fillText(playerInfo.username || 'Pilot', 0, 40);
        
        const texture = new THREE.CanvasTexture(canvas);
        const spriteMat = new THREE.SpriteMaterial({ map: texture, transparent: true });
        const sprite = new THREE.Sprite(spriteMat);
        sprite.position.set(0, 3, 0);
        sprite.scale.set(6, 3, 1);
        mesh.add(sprite);
        
        // Redraw Dynamic Health Bar Base
        const bgMat = new THREE.MeshBasicMaterial({color: 0xff0000, side: THREE.DoubleSide});
        const bgMesh = new THREE.Mesh(new THREE.PlaneGeometry(5, 0.4), bgMat);
        bgMesh.position.set(0, 4.2, 0);
        mesh.add(bgMesh);
        
        const fillMat = new THREE.MeshBasicMaterial({color: 0x00ff00, side: THREE.DoubleSide});
        const fillMesh = new THREE.Mesh(new THREE.PlaneGeometry(5, 0.4), fillMat);
        fillMesh.position.set(0, 4.2, 0.01);
        mesh.add(fillMesh);
        
        const hitboxGeo = new THREE.BoxGeometry(3, 4, 3);
        const hitboxMat = new THREE.MeshBasicMaterial({ visible: false });
        const hitbox = new THREE.Mesh(hitboxGeo, hitboxMat);
        mesh.add(hitbox);
        
        this.otherPlayers[playerInfo.id] = { 
            mesh: mesh, 
            rotors: graphics.rotors,
            username: playerInfo.username,
            hitbox: hitbox,
            healthBar: fillMesh,
            healthBg: bgMesh
        };
    }
    
    emitMovement(droneMesh) {
        this.socket.emit('playerMovement', {
            id: this.socket.id,
            health: window.localPlayerHealth || 100, // passed from main.js implicitly via window since they are isolated
            position: {
                x: droneMesh.position.x,
                y: droneMesh.position.y,
                z: droneMesh.position.z
            },
            rotation: {
                y: droneMesh.rotation.y
            }
        });
    }
}
