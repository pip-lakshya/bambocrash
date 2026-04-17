import * as THREE from 'three';

export class PowerupSystem {
    constructor(scene) {
        this.scene = scene;
        this.powerups = [];
        
        this.healMat = new THREE.MeshStandardMaterial({ color: 0x00ff00, emissive: 0x005500 });
        this.speedMat = new THREE.MeshStandardMaterial({ color: 0x0000ff, emissive: 0x000055 });
        this.geometry = new THREE.BoxGeometry(1.5, 1.5, 1.5);
        
        this.spawnPowerups();
    }
    
    spawnPowerups() {
        for (let i = 0; i < 15; i++) {
            const isHeal = Math.random() > 0.5;
            const mesh = new THREE.Mesh(this.geometry, isHeal ? this.healMat : this.speedMat);
            
            mesh.position.set(
                (Math.random() - 0.5) * 300,
                10 + Math.random() * 30,
                (Math.random() - 0.5) * 300
            );
            
            this.scene.add(mesh);
            this.powerups.push({ mesh, type: isHeal ? 'heal' : 'speed', active: true });
        }
    }
    
    update(dt) {
        this.powerups.forEach(p => {
            if (p.active) {
                // Spin
                p.mesh.rotation.x += dt;
                p.mesh.rotation.y += dt;
            }
        });
    }
    
    checkCollision(droneMesh, onPickup) {
        // Super simple AABB collision check
        const droneBox = new THREE.Box3().setFromObject(droneMesh);
        
        this.powerups.forEach((p, index) => {
            if (p.active) {
                const pBox = new THREE.Box3().setFromObject(p.mesh);
                if (droneBox.intersectsBox(pBox)) {
                    p.active = false;
                    p.mesh.visible = false;
                    onPickup(p.type);
                    
                    // Respawn
                    setTimeout(() => {
                        p.active = true;
                        p.mesh.visible = true;
                    }, 10000); // 10 seconds respawn
                }
            }
        });
    }
}
