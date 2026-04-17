import * as THREE from 'three';

export class Arena {
    constructor(scene) {
        this.scene = scene;
        this.obstacles = [];
        this.generate();
    }
    
    checkCollision(droneMesh) {
        const droneBox = new THREE.Box3().setFromObject(droneMesh);
        droneBox.expandByScalar(-0.4); // Forgiving hitbox

        for (let obs of this.obstacles) {
            const obsBox = new THREE.Box3().setFromObject(obs);
            if (droneBox.intersectsBox(obsBox)) {
                return true;
            }
        }
        return false;
    }
    
    generate() {
        const material = new THREE.MeshStandardMaterial({ 
            color: 0x888888,
            roughness: 0.4,
            metalness: 0.1
        });
        
        const geometry = new THREE.BoxGeometry(15, 60, 15);
        
        // Create random pillars
        for(let i=0; i<40; i++) {
            const mesh = new THREE.Mesh(geometry, material);
            
            // Random position spread out
            let posX = (Math.random() - 0.5) * 400;
            let posZ = (Math.random() - 0.5) * 400;
            
            // Keep center area somewhat clear
            if (Math.abs(posX) < 30 && Math.abs(posZ) < 30) {
                posX += 40 * Math.sign(posX);
                posZ += 40 * Math.sign(posZ);
            }
            
            mesh.position.set(posX, 0, posZ); // Centered at Y=0 so it goes from -30 to +30
            
            // Random rotation
            mesh.rotation.y = Math.random() * Math.PI;
            
            mesh.castShadow = true;
            mesh.receiveShadow = true;
            
            this.scene.add(mesh);
            this.obstacles.push(mesh);
        }
        
        // Optionally, add some floating rings or platforms later
    }
}
