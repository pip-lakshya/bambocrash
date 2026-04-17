import * as THREE from 'three';
import { input } from './Input.js';

export function createDroneMesh(skin = 'drone') {
    const mesh = new THREE.Group();
    const rotors = [];
    
    if (skin === 'bamboo') {
        const goldMat = new THREE.MeshStandardMaterial({ color: 0xd4af37, metalness: 0.6, roughness: 0.4 });
        
        const baseGeo = new THREE.SphereGeometry(1, 16, 16, 0, Math.PI * 2, 0, Math.PI/2);
        const base = new THREE.Mesh(baseGeo, goldMat);
        mesh.add(base);
        
        const stickGeo = new THREE.CylinderGeometry(0.2, 0.2, 3);
        const stick = new THREE.Mesh(stickGeo, goldMat);
        stick.position.y = 1.5;
        mesh.add(stick);
        
        const headGeo = new THREE.CylinderGeometry(0.5, 0.5, 0.4);
        const head = new THREE.Mesh(headGeo, goldMat);
        head.position.y = 3;
        mesh.add(head);
        
        const rotorGeo = new THREE.CylinderGeometry(2.5, 2.5, 0.05, 32);
        const rotorMat = new THREE.MeshStandardMaterial({ color: 0xcccccc, transparent: true, opacity: 0.4 });
        const rotor = new THREE.Mesh(rotorGeo, rotorMat);
        rotor.position.y = 3.1;
        
        const stripeGeo = new THREE.BoxGeometry(4.8, 0.06, 0.2);
        const stripeMat = new THREE.MeshStandardMaterial({ color: 0x333333, transparent: true, opacity: 0.5 });
        const stripe1 = new THREE.Mesh(stripeGeo, stripeMat);
        const stripe2 = new THREE.Mesh(stripeGeo, stripeMat);
        stripe2.rotation.y = Math.PI / 2;
        rotor.add(stripe1);
        rotor.add(stripe2);
        
        mesh.add(rotor);
        rotors.push(rotor);
        
        const frontMarkerGeo = new THREE.BoxGeometry(0.4, 0.4, 0.4);
        const frontMarkerMat = new THREE.MeshStandardMaterial({ color: 0xff3333 });
        const frontMarker = new THREE.Mesh(frontMarkerGeo, frontMarkerMat);
        frontMarker.position.set(0, 0.5, -1);
        mesh.add(frontMarker);
        
    } else {
        const bodyGeo = new THREE.BoxGeometry(2, 0.5, 2);
        const bodyMat = new THREE.MeshStandardMaterial({ color: 0x333333 });
        const body = new THREE.Mesh(bodyGeo, bodyMat);
        body.castShadow = true;
        mesh.add(body);
        
        const frontGeo = new THREE.BoxGeometry(0.5, 0.6, 2.2);
        const frontMat = new THREE.MeshStandardMaterial({ color: 0xff3333 });
        const front = new THREE.Mesh(frontGeo, frontMat);
        mesh.add(front);
        
        const rotorGeo = new THREE.CylinderGeometry(0.8, 0.8, 0.1, 16);
        const rotorMat = new THREE.MeshStandardMaterial({ color: 0x999999, transparent: true, opacity: 0.7 });
        
        const positions = [
            [1.2, 0.3, 1.2], [-1.2, 0.3, 1.2],
            [1.2, 0.3, -1.2], [-1.2, 0.3, -1.2]
        ];
        
        positions.forEach(pos => {
            const rotor = new THREE.Mesh(rotorGeo, rotorMat);
            rotor.position.set(pos[0], pos[1], pos[2]);
            mesh.add(rotor);
            rotors.push(rotor);
        });
    }
    
    mesh.scale.set(1.5, 1.5, 1.5);
    return { mesh, rotors };
}

export class Drone {
    constructor(scene, skin = 'drone') {
        this.scene = scene;
        
        const graphics = createDroneMesh(skin);
        this.mesh = graphics.mesh;
        this.rotors = graphics.rotors;
        this.skin = skin;

        this.scene.add(this.mesh);
        
        this.velocity = new THREE.Vector3();
        this.speed = 40; 
        this.turnSpeed = 2.0; 
        
        this.health = 100;
        this.lastHit = 0;
    }

    update(dt) {
        this.rotors.forEach(rotor => {
            rotor.rotation.y += 20 * dt;
        });

        let thrust = -input.joystick.y;
        if (input.isPressed('KeyW')) thrust = 1;
        if (input.isPressed('KeyS')) thrust = -1;
        
        let lift = 0;
        if (input.isPressed('ArrowUp') || input.isPressed('Space') || input.mobileButtons.ascend) lift = 1;
        if (input.isPressed('ArrowDown') || input.mobileButtons.descend) lift = -1;
        
        let turn = input.joystick.x;
        if (input.isPressed('KeyA') || input.isPressed('ArrowLeft')) turn = -1;
        if (input.isPressed('KeyD') || input.isPressed('ArrowRight')) turn = 1;
        
        let dYaw = turn * this.turnSpeed * dt;
        if (input.mouseDelta.x !== 0) {
            dYaw += input.mouseDelta.x * 0.002;
            input.mouseDelta.x = 0;
        }
        this.mesh.rotation.y -= dYaw;
        
        const forward = new THREE.Vector3(0, 0, -1).applyQuaternion(this.mesh.quaternion);
        
        const targetVelocity = forward.clone().multiplyScalar(thrust * this.speed);
        targetVelocity.y = lift * (this.speed * 0.6);
        
        this.velocity.lerp(targetVelocity, 6 * dt);
        this.mesh.position.addScaledVector(this.velocity, dt);

        const targetBankX = thrust * 0.3; 
        this.mesh.children.forEach(child => {
            if(!this.rotors.includes(child)) {
                child.rotation.x = THREE.MathUtils.lerp(child.rotation.x, targetBankX, dt * 5);
            }
        });
    }
}
