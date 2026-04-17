import * as THREE from 'three';
import { Drone } from './game/Drone.js';
import { Arena } from './game/Arena.js';
import { ProjectileSystem } from './game/Projectiles.js';
import { PowerupSystem } from './game/Powerups.js';
import { input } from './game/Input.js';
import { SocketManager } from './network/SocketManager.js';
import { MobileJoystick } from './game/MobileJoystick.js';

const scene = new THREE.Scene();
scene.background = new THREE.Color(0x87CEEB); 
scene.fog = new THREE.FogExp2(0x87CEEB, 0.003);

const camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 1000);

const canvas = document.createElement('canvas');
document.body.appendChild(canvas);

const renderer = new THREE.WebGLRenderer({ canvas: canvas, antialias: true });
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.setPixelRatio(window.devicePixelRatio);
renderer.shadowMap.enabled = true;

const ambientLight = new THREE.AmbientLight(0xffffff, 0.6);
scene.add(ambientLight);

const dirLight = new THREE.DirectionalLight(0xffffff, 0.8);
dirLight.position.set(200, 500, 300);
dirLight.castShadow = true;
dirLight.shadow.camera.left = -150;
dirLight.shadow.camera.right = 150;
dirLight.shadow.camera.top = 150;
dirLight.shadow.camera.bottom = -150;
scene.add(dirLight);

const planeGeometry = new THREE.PlaneGeometry(1000, 1000);
const planeMaterial = new THREE.MeshStandardMaterial({ color: 0x55aa55 });
const plane = new THREE.Mesh(planeGeometry, planeMaterial);
plane.rotation.x = -Math.PI / 2;
plane.receiveShadow = true;
plane.position.y = -50; 
scene.add(plane);

const arena = new Arena(scene);
const projectiles = new ProjectileSystem(scene);
const powerups = new PowerupSystem(scene);
const mobileJoystick = new MobileJoystick();

let player, socketManager;
let timeSinceLastShot = 0;
let screenShakeTime = 0;
let gamePaused = false;
let roundActive = true;
let camPitch = 0;
const explosions = [];

const clock = new THREE.Clock();
const lookAtTarget = new THREE.Vector3();

// UI Elements
const speedText = document.getElementById('speed-text');
const scoreboard = document.getElementById('scoreboard');
const scoreList = document.getElementById('score-list');
const btnScoresMobile = document.getElementById('btn-scores-mobile');

let scoreToggled = false;
if (btnScoresMobile) {
    btnScoresMobile.addEventListener('touchstart', (e) => {
        e.preventDefault();
        scoreToggled = !scoreToggled;
    });
    btnScoresMobile.addEventListener('click', () => {
        scoreToggled = !scoreToggled;
    });
}

// Skin Selection
document.querySelectorAll('.skin-btn').forEach(btn => {
    btn.addEventListener('click', (e) => {
        document.querySelectorAll('.skin-btn').forEach(b => b.classList.remove('active'));
        e.target.classList.add('active');
    });
});

// UI Pause Logic
if (document.getElementById('btn-pause-ui')) {
    document.getElementById('btn-pause-ui').addEventListener('click', () => {
        gamePaused = !gamePaused;
        document.getElementById('pause-menu').classList.toggle('hidden', !gamePaused);
    });
}
if (document.getElementById('btn-resume')) {
    document.getElementById('btn-resume').addEventListener('click', () => {
        gamePaused = false;
        document.getElementById('pause-menu').classList.add('hidden');
    });
}

function refreshScoreboard() {
    fetch('/api/scores').then(r=>r.json()).then(data => {
        scoreList.innerHTML = data.map(s => `<li><span>${s.playerName}</span><span class="score-stats">${s.kills}K / ${s.deaths}D</span></li>`).join('');
    }).catch(() => {
        scoreList.innerHTML = '<li>Local Training Mode</li>';
    });
}
refreshScoreboard();

document.getElementById('btn-start').addEventListener('click', () => {
    const inputName = document.getElementById('username-input').value.trim();
    const username = inputName ? inputName : 'Pilot_' + Math.floor(Math.random()*1000);
    const skin = document.getElementById('btn-skin-bamboo').classList.contains('active') ? 'bamboo' : 'drone';
    
    // Request fullscreen for mobile/browser
    if (document.documentElement.requestFullscreen) {
        document.documentElement.requestFullscreen().catch((e) => console.log('Fullscreen failed:', e));
    }

    document.getElementById('main-menu').style.opacity = 0;
    setTimeout(() => document.getElementById('main-menu').remove(), 1000);
    
    player = new Drone(scene, skin);
    player.mesh.position.set(0, 0, 0);
    
    socketManager = new SocketManager(scene, username, skin);
    
    socketManager.socket.on('youGotHit', (data) => {
        player.health -= 20;
        const flash = document.getElementById('crash-flash');
        if(flash) { flash.style.opacity = 1; setTimeout(()=>flash.style.opacity=0, 400); }
        screenShakeTime = 0.5;
        
        if (player.health <= 0) {
            socketManager.socket.emit('iDied', data.shooterId);
            player.health = 100;
            player.mesh.position.set(Math.random()*100 - 50, 40, Math.random()*100 - 50); // Random respawn drop
        }
    });
    
    socketManager.socket.on('scoresUpdated', () => {
        refreshScoreboard();
    });
    
    socketManager.socket.on('killFeed', (data) => {
        const kfc = document.getElementById('kill-feed-container');
        if (kfc) {
            const entry = document.createElement('div');
            entry.className = 'kill-feed-entry';
            entry.innerHTML = `<span style="color:#00f2fe">${data.killer}</span> DESTROYED <span style="color:#ff3366">${data.victim}</span>`;
            kfc.appendChild(entry);
            setTimeout(() => entry.remove(), 4000);
        }
        
        if (data.position) {
            const geo = new THREE.BoxGeometry(0.8, 0.8, 0.8);
            const mat = new THREE.MeshBasicMaterial({color: 0xffaa00});
            for(let i=0; i<40; i++) {
                const p = new THREE.Mesh(geo, mat);
                p.position.set(data.position.x, data.position.y, data.position.z);
                p.velocity = new THREE.Vector3( (Math.random()-0.5)*40, (Math.random()-0.5)*40, (Math.random()-0.5)*40 );
                p.life = 1.0;
                scene.add(p);
                explosions.push(p);
            }
        }
    });
    
    socketManager.socket.on('timeUpdate', (time) => {
        const mins = Math.floor(time / 60);
        const secs = (time % 60).toString().padStart(2, '0');
        document.getElementById('timer-text').innerText = `Time: ${mins}:${secs}`;
    });
    
    socketManager.socket.on('roundEnd', () => {
        roundActive = false;
        scoreboard.classList.remove('hidden'); // Force open
        
        document.getElementById('pause-title').innerText = "ROUND OVER";
        document.getElementById('pause-desc').innerText = "Next round starting shortly...";
        document.getElementById('btn-resume').style.display = 'none';
        document.getElementById('pause-menu').classList.remove('hidden');
    });

    socketManager.socket.on('roundStart', () => {
        roundActive = true;
        scoreboard.classList.add('hidden');
        
        document.getElementById('pause-title').innerText = "PAUSED";
        document.getElementById('pause-desc').innerText = "Press 'P' or click below to resume";
        document.getElementById('btn-resume').style.display = 'inline-block';
        if(!gamePaused) document.getElementById('pause-menu').classList.add('hidden');
        
        // Reset player completely
        player.health = 100;
        player.velocity.set(0, 0, 0);
        player.mesh.position.set(Math.random()*100-50, 40, Math.random()*100-50);
    });

    animate();
});

window.addEventListener('resize', onWindowResize, false);
function onWindowResize() {
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);
}

function animate() {
    requestAnimationFrame(animate);
    
    // Run explosion physics regardless of pause so it finishes nicely
    let dt = clock.getDelta();
    if (dt > 0.1) dt = 0.1;
        
        for (let i = explosions.length - 1; i >= 0; i--) {
            const p = explosions[i];
            p.position.addScaledVector(p.velocity, dt);
            p.scale.multiplyScalar(0.92);
            p.life -= dt;
            if (p.life <= 0) {
                scene.remove(p);
                explosions.splice(i, 1);
            }
        }
        
        animateCore(dt);
}

function animateCore(dt) {
    
    // Check Pause Key BEFORE bailing out!
    if (input.isPressed('KeyP')) {
        if (!input.keys['_pLock']) {
            gamePaused = !gamePaused;
            input.keys['_pLock'] = true;
            document.getElementById('pause-menu').classList.toggle('hidden', !gamePaused);
        }
    } else {
        input.keys['_pLock'] = false;
    }
    
    if (gamePaused || !player) return; // Freeze visually
    
    const oldPosition = player.mesh.position.clone();
    
    player.update(dt);
    window.localPlayerHealth = player.health;
    
    const bounds = 250;
    if (Math.abs(player.mesh.position.x) > bounds) player.mesh.position.x = Math.sign(player.mesh.position.x) * bounds;
    if (Math.abs(player.mesh.position.z) > bounds) player.mesh.position.z = Math.sign(player.mesh.position.z) * bounds;
    if (player.mesh.position.y < 0) player.mesh.position.y = 0;
    if (player.mesh.position.y > 100) player.mesh.position.y = 100;
    
    if (arena.checkCollision(player.mesh)) {
        player.mesh.position.copy(oldPosition);
        player.velocity.set(0, 0, 0); 
        
        const now = Date.now() / 1000;
        if (now - player.lastHit > 1.0) { 
            player.health -= 10;
            player.lastHit = now;
            
            screenShakeTime = 0.4;
            const flash = document.getElementById('crash-flash');
            if(flash) { flash.style.opacity = 1; setTimeout(()=>flash.style.opacity=0, 400); }
            
            if (player.health <= 0) {
                player.health = 100; 
                player.mesh.position.set(0, 40, 0); 
            }
        }
    }
    
    socketManager.emitMovement(player.mesh);
    
    projectiles.update(dt);
    powerups.update(dt);
    
    powerups.checkCollision(player.mesh, (type) => {
        if (type === 'speed') {
            player.speed = 80; 
            setTimeout(() => { player.speed = 40; }, 3000);
        }
        if (type === 'heal') {
            player.health = Math.min(100, player.health + 40);
        }
    });

    // PvP Projectile checks
    projectiles.projectiles.forEach(p => {
        if (!p.mesh.visible) return;
        
        Object.entries(socketManager.otherPlayers).forEach(([id, other]) => {
            if (other.healthBar && other.healthBg) {
                other.healthBar.lookAt(camera.position);
                other.healthBg.lookAt(camera.position);
            }
            
            if (p.mesh.visible) {
                const dist = p.mesh.position.distanceTo(other.mesh.position);
                if (dist < 5.0) { // Accurate rigid spherical hit detection
                     p.mesh.visible = false;
                     socketManager.socket.emit('registeredHit', id);
                     
                     // Local instant visual FX (expanding white light at impact)
                     const impactLight = new THREE.PointLight(0xffffff, 5, 20);
                     impactLight.position.copy(p.mesh.position);
                     scene.add(impactLight);
                     setTimeout(() => scene.remove(impactLight), 100);
                }
            }
        });
    });
    
    timeSinceLastShot += dt;
    if (roundActive && (input.isPressed('Enter') || input.mobileButtons.shoot) && timeSinceLastShot > 0.15) {
        let forward = new THREE.Vector3(0, 0, -1).applyQuaternion(player.mesh.quaternion);
        
        // Aim Assist (Snap to closest player within 15 degree cone)
        let bestTarget = null;
        let bestAngle = 0.25; 
        const forwardNormal = forward.clone().normalize();
        
        Object.values(socketManager.otherPlayers).forEach(other => {
            const dirToTarget = other.mesh.position.clone().sub(player.mesh.position);
            const dist = dirToTarget.length();
            if (dist < 150 && dist > 5) {
                dirToTarget.normalize();
                const angle = forwardNormal.angleTo(dirToTarget);
                if (angle < bestAngle) {
                    bestAngle = angle;
                    bestTarget = dirToTarget; 
                }
            }
        });
        
        if (bestTarget) forward = bestTarget;
        
        const spawnPos = player.mesh.position.clone().add(forward.clone().multiplyScalar(4)); 
        projectiles.shoot(spawnPos, forward);
        timeSinceLastShot = 0;
    }
    
    if (input.mouseDelta.y !== 0) {
        camPitch += input.mouseDelta.y * 0.002;
        camPitch = Math.max(-Math.PI/3, Math.min(Math.PI/3, camPitch));
        input.mouseDelta.y = 0;
    }
    
    const orbitRadius = 15;
    const dy = Math.sin(camPitch) * orbitRadius;
    const dz = Math.cos(camPitch) * orbitRadius;
    
    const cameraOffset = new THREE.Vector3(0, dy + 4, dz); 
    cameraOffset.applyQuaternion(player.mesh.quaternion);
    
    const desiredCameraPos = player.mesh.position.clone().add(cameraOffset);
    camera.position.lerp(desiredCameraPos, 15 * dt);
    
    const lookAhead = new THREE.Vector3(0, -dy * 0.5, -20);
    lookAhead.applyQuaternion(player.mesh.quaternion);
    lookAhead.add(player.mesh.position);
    
    lookAtTarget.lerp(lookAhead, 15 * dt);
    camera.lookAt(lookAtTarget);
    
    speedText.innerText = Math.round(player.velocity.length());
    document.getElementById('health-text').innerText = player.health + "%";
    document.getElementById('health-bar').style.width = player.health + "%";
    
    if (input.isPressed('Tab') || scoreToggled) {
        scoreboard.classList.remove('hidden');
    } else {
        scoreboard.classList.add('hidden');
    }
    
    if (screenShakeTime > 0) {
        screenShakeTime -= dt;
        camera.position.x += (Math.random() - 0.5) * 1.5;
        camera.position.y += (Math.random() - 0.5) * 1.5;
    }
    
    renderer.render(scene, camera);
}
