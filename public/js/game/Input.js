export class InputManager {
    constructor() {
        this.keys = {};
        this.mouseDown = false;
        
        this.joystick = { x: 0, y: 0 };
        this.mobileButtons = { ascend: false, descend: false, shoot: false };
        
        window.addEventListener('keydown', (e) => this.keys[e.code] = true);
        window.addEventListener('keyup', (e) => this.keys[e.code] = false);
        window.addEventListener('mousedown', (e) => {
            if (e.button === 0) this.mouseDown = true;
        });
        window.addEventListener('mouseup', (e) => {
            if (e.button === 0) this.mouseDown = false;
        });
        
        this.mouseDelta = { x: 0, y: 0 };
        document.addEventListener('mousemove', (e) => {
            if (document.pointerLockElement) {
                this.mouseDelta.x += e.movementX;
                this.mouseDelta.y += e.movementY;
            }
        });
        
        document.addEventListener('click', (e) => {
            if (e.target.tagName === 'CANVAS' && !document.pointerLockElement) {
                document.body.requestPointerLock();
            }
        });
        
        let lastTouchY = null;
        let lastTouchX = null;
        document.addEventListener('touchstart', (e) => {
            if (e.target.tagName === 'CANVAS') {
                lastTouchY = e.touches[0].clientY;
                lastTouchX = e.touches[0].clientX;
            }
        }, { passive: false });
        
        document.addEventListener('touchmove', (e) => {
            if (lastTouchY !== null && lastTouchX !== null && e.target.tagName === 'CANVAS') {
                e.preventDefault(); // Prevent scrolling
                this.mouseDelta.y += (e.touches[0].clientY - lastTouchY) * 3;
                this.mouseDelta.x += (e.touches[0].clientX - lastTouchX) * 3;
                lastTouchY = e.touches[0].clientY;
                lastTouchX = e.touches[0].clientX;
            }
        }, { passive: false });
        
        document.addEventListener('touchend', () => { lastTouchY = null; lastTouchX = null; });
        document.addEventListener('touchcancel', () => { lastTouchY = null; lastTouchX = null; });
        
        // Prevent default actions for keys we use
        window.addEventListener('keydown', (e) => {
            if (['Space', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Tab', 'Enter'].includes(e.code)) {
                e.preventDefault();
            }
        }, { passive: false });
    }

    isPressed(keyCode) {
        return !!this.keys[keyCode];
    }
}

export const input = new InputManager();
