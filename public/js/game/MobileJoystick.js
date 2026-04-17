import { input } from './Input.js';

export class MobileJoystick {
    constructor() {
        this.zone = document.getElementById('joystick-zone');
        this.knob = document.getElementById('joystick-knob');
        
        this.btnUp = document.getElementById('btn-ascend');
        this.btnDown = document.getElementById('btn-descend');
        this.btnShoot = document.getElementById('btn-shoot');
        
        if (!this.zone) return;

        this.isActive = false;
        this.center = { x: 0, y: 0 };
        this.radius = 40; // Max distance knob can move
        
        this.setupJoystick();
        this.setupButtons();
    }
    
    setupJoystick() {
        const handleStart = (e) => {
            e.preventDefault();
            this.isActive = true;
            const rect = this.zone.getBoundingClientRect();
            this.center = { x: rect.left + rect.width/2, y: rect.top + rect.height/2 };
            this.updateKnob(e.touches ? e.touches[0] : e);
        };
        
        const handleMove = (e) => {
            if (!this.isActive) return;
            e.preventDefault();
            this.updateKnob(e.touches ? e.touches[0] : e);
        };
        
        const handleEnd = (e) => {
            e.preventDefault();
            this.isActive = false;
            this.knob.style.transform = `translate(0px, 0px)`;
            input.joystick = { x: 0, y: 0 };
        };

        this.zone.addEventListener('touchstart', handleStart, { passive: false });
        this.zone.addEventListener('touchmove', handleMove, { passive: false });
        this.zone.addEventListener('touchend', handleEnd, { passive: false });
        this.zone.addEventListener('touchcancel', handleEnd, { passive: false });
    }
    
    updateKnob(evt) {
        let dx = evt.clientX - this.center.x;
        let dy = evt.clientY - this.center.y;
        
        const distance = Math.sqrt(dx*dx + dy*dy);
        if (distance > this.radius) {
            dx = (dx / distance) * this.radius;
            dy = (dy / distance) * this.radius;
        }
        
        this.knob.style.transform = `translate(${dx}px, ${dy}px)`;
        
        input.joystick.x = dx / this.radius;
        input.joystick.y = dy / this.radius;
    }
    
    setupButtons() {
        const bindBtn = (btn, action) => {
            if(!btn) return;
            const start = (e) => { e.preventDefault(); input.mobileButtons[action] = true; };
            const end = (e) => { e.preventDefault(); input.mobileButtons[action] = false; };
            
            btn.addEventListener('touchstart', start, { passive: false });
            btn.addEventListener('touchend', end, { passive: false });
            btn.addEventListener('touchcancel', end, { passive: false });
        };
        
        bindBtn(this.btnUp, 'ascend');
        bindBtn(this.btnDown, 'descend');
        bindBtn(this.btnShoot, 'shoot');
    }
}
