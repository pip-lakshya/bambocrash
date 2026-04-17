import * as THREE from 'three';

export class ProjectileSystem {
    constructor(scene) {
        this.scene = scene;
        this.projectiles = [];
        this.material = new THREE.MeshBasicMaterial({ color: 0xffaa00 });
        this.geometry = new THREE.SphereGeometry(0.3, 8, 8);
    }
    
    shoot(origin, direction) {
        const mesh = new THREE.Mesh(this.geometry, this.material);
        mesh.position.copy(origin);
        
        // Offset so it doesn't spawn exactly inside the drone
        mesh.position.addScaledVector(direction, 3);
        
        this.scene.add(mesh);
        
        this.projectiles.push({
            mesh: mesh,
            direction: direction.clone().normalize(),
            speed: 150,
            life: 2.0 // disappears after 2 seconds
        });
    }
    
    update(dt) {
        for(let i = this.projectiles.length - 1; i >= 0; i--) {
            const p = this.projectiles[i];
            p.mesh.position.addScaledVector(p.direction, p.speed * dt);
            p.life -= dt;
            
            // Basic life timeout
            if (p.life <= 0) {
                this.scene.remove(p.mesh);
                this.projectiles.splice(i, 1);
            }
        }
    }
}
