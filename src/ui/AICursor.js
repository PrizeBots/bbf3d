/**
 * AICursor - Visible 3D cursor controlled by AI player
 *
 * Similar to PlayerCursor but controlled programmatically rather than by mouse.
 * Shows the AI's current focus and intended actions.
 */
export class AICursor {
    constructor(scene, camera, team = 'blue') {
        this.scene = scene;
        this.camera = camera;
        this.team = team;
        this.mesh = null;
        this.fingers = [];
        this.thumb = null;
        this.palm = null;

        // Current gesture state
        this.gesture = 'pointing';

        // Position tracking - AI sets target, cursor smoothly follows
        this.targetPosition = new BABYLON.Vector3(0, 0, 0);
        this.currentPosition = new BABYLON.Vector3(0, 0, 0);
        this.smoothSpeed = 0.08; // Slower than player for visible AI movement

        // Movement state
        this.isMoving = false;
        this.arrivalCallback = null;
        this.arrivalThreshold = 0.5;

        // Visibility
        this.isVisible = true;

        // Team glow color (blue for AI)
        this.glowColor = team === 'blue'
            ? new BABYLON.Color3(0.3, 0.5, 1)
            : new BABYLON.Color3(1, 0.3, 0.3);

        this.create();
        this.setupUpdateLoop();
    }

    /**
     * Create the glove hand mesh using primitives
     */
    create() {
        // Create root transform
        this.mesh = new BABYLON.TransformNode("aiCursor", this.scene);
        this.mesh.position.y = 0.5;

        // Create palm
        this.palm = BABYLON.MeshBuilder.CreateSphere(
            "aiCursorPalm",
            {
                diameterX: 1.2,
                diameterY: 0.4,
                diameterZ: 1.0,
                segments: 12
            },
            this.scene
        );
        this.palm.parent = this.mesh;
        this.palm.position.y = 0.2;

        // Create material for glove (white with blue glow for AI)
        const gloveMaterial = new BABYLON.StandardMaterial("aiGloveMat", this.scene);
        gloveMaterial.diffuseColor = new BABYLON.Color3(0.9, 0.9, 0.95);
        gloveMaterial.emissiveColor = this.glowColor.scale(0.3); // Slightly stronger glow
        gloveMaterial.specularColor = new BABYLON.Color3(0.3, 0.3, 0.4);
        this.palm.material = gloveMaterial;

        // Create fingers
        const fingerPositions = [
            { x: -0.35, z: 0.4 },
            { x: -0.12, z: 0.45 },
            { x: 0.12, z: 0.45 },
            { x: 0.35, z: 0.4 }
        ];

        const fingerLengths = [0.6, 0.7, 0.65, 0.5];

        fingerPositions.forEach((pos, i) => {
            const finger = BABYLON.MeshBuilder.CreateCapsule(
                `aiCursorFinger${i}`,
                {
                    radius: 0.1,
                    height: fingerLengths[i],
                    tessellation: 8,
                    subdivisions: 1
                },
                this.scene
            );

            finger.parent = this.mesh;
            finger.position.x = pos.x;
            finger.position.z = pos.z + fingerLengths[i] / 2;
            finger.position.y = 0.2;
            finger.rotation.x = Math.PI / 2;
            finger.material = gloveMaterial;

            this.fingers.push({
                mesh: finger,
                basePos: { x: pos.x, z: pos.z },
                length: fingerLengths[i],
                baseRotX: Math.PI / 2
            });
        });

        // Create thumb
        this.thumb = BABYLON.MeshBuilder.CreateCapsule(
            "aiCursorThumb",
            {
                radius: 0.12,
                height: 0.5,
                tessellation: 8,
                subdivisions: 1
            },
            this.scene
        );
        this.thumb.parent = this.mesh;
        this.thumb.position.x = -0.55;
        this.thumb.position.z = 0;
        this.thumb.position.y = 0.2;
        this.thumb.rotation.x = Math.PI / 2;
        this.thumb.rotation.z = -Math.PI / 4;
        this.thumb.material = gloveMaterial;

        // Set initial gesture
        this.setGesture('pointing');

        // Start at blue castle position
        const startX = 65; // Blue castle X position
        this.currentPosition.x = startX;
        this.targetPosition.x = startX;
        this.mesh.position.x = startX;
    }

    /**
     * Setup update loop for smooth movement
     */
    setupUpdateLoop() {
        this.scene.onBeforeRenderObservable.add(() => {
            this.update();
        });
    }

    /**
     * Update cursor position smoothly
     */
    update() {
        if (!this.mesh || !this.isVisible) return;

        // Smooth follow to target
        const dx = this.targetPosition.x - this.currentPosition.x;
        const dz = this.targetPosition.z - this.currentPosition.z;
        const distance = Math.sqrt(dx * dx + dz * dz);

        this.currentPosition.x += dx * this.smoothSpeed;
        this.currentPosition.z += dz * this.smoothSpeed;

        this.mesh.position.x = this.currentPosition.x;
        this.mesh.position.z = this.currentPosition.z;

        // Face camera direction
        const cameraDirection = this.camera.getForwardRay().direction;
        const angle = Math.atan2(cameraDirection.x, cameraDirection.z);
        this.mesh.rotation.y = angle + Math.PI;

        // Check if arrived at target
        if (this.isMoving && distance < this.arrivalThreshold) {
            this.isMoving = false;
            if (this.arrivalCallback) {
                const callback = this.arrivalCallback;
                this.arrivalCallback = null;
                callback();
            }
        }
    }

    /**
     * Move cursor to a position (called by AI player)
     * @param {BABYLON.Vector3} position - Target position
     * @param {Function} [onArrival] - Callback when cursor arrives
     */
    moveTo(position, onArrival = null) {
        this.targetPosition.x = position.x;
        this.targetPosition.z = position.z;
        this.isMoving = true;
        this.arrivalCallback = onArrival;
    }

    /**
     * Move to position and return a promise
     */
    moveToAsync(position) {
        return new Promise((resolve) => {
            this.moveTo(position, resolve);
        });
    }

    /**
     * Set movement speed (for AI difficulty tuning)
     */
    setSpeed(speed) {
        this.smoothSpeed = Math.max(0.02, Math.min(0.2, speed));
    }

    /**
     * Set cursor gesture
     */
    setGesture(gesture) {
        if (gesture === this.gesture) return;
        this.gesture = gesture;

        switch (gesture) {
            case 'pointing':
                this.setPosePointing();
                break;
            case 'open':
                this.setPoseOpen();
                break;
            case 'grabbing':
                this.setPoseGrabbing();
                break;
            case 'thumbsUp':
                this.setPoseThumbsUp();
                break;
        }
    }

    /**
     * Pointing pose
     */
    setPosePointing() {
        this.fingers.forEach((finger, i) => {
            if (i === 0) {
                finger.mesh.rotation.x = Math.PI / 2;
                finger.mesh.position.z = finger.basePos.z + finger.length / 2;
                finger.mesh.position.y = 0.2;
            } else {
                finger.mesh.rotation.x = Math.PI / 2 + 1.2;
                finger.mesh.position.z = finger.basePos.z;
                finger.mesh.position.y = 0;
            }
        });

        this.thumb.rotation.x = Math.PI / 2 + 0.5;
        this.thumb.rotation.z = -Math.PI / 4;
    }

    /**
     * Open pose
     */
    setPoseOpen() {
        this.fingers.forEach((finger, i) => {
            finger.mesh.rotation.x = Math.PI / 2;
            finger.mesh.position.z = finger.basePos.z + finger.length / 2;
            finger.mesh.position.y = 0.2;
            finger.mesh.rotation.z = (i - 1.5) * 0.1;
        });

        this.thumb.rotation.x = Math.PI / 2;
        this.thumb.rotation.z = -Math.PI / 3;
    }

    /**
     * Grabbing pose
     */
    setPoseGrabbing() {
        this.fingers.forEach((finger) => {
            finger.mesh.rotation.x = Math.PI / 2 + 1.5;
            finger.mesh.position.z = finger.basePos.z - 0.1;
            finger.mesh.position.y = -0.1;
            finger.mesh.rotation.z = 0;
        });

        this.thumb.rotation.x = Math.PI / 2 + 1.0;
        this.thumb.rotation.z = 0;
    }

    /**
     * Thumbs up pose
     */
    setPoseThumbsUp() {
        this.fingers.forEach((finger) => {
            finger.mesh.rotation.x = Math.PI / 2 + 1.5;
            finger.mesh.position.z = finger.basePos.z - 0.1;
            finger.mesh.position.y = -0.1;
        });

        this.thumb.rotation.x = 0;
        this.thumb.rotation.z = 0;
        this.thumb.position.y = 0.5;
    }

    /**
     * Flash thumbs up briefly
     */
    flashThumbsUp(duration = 500) {
        const previousGesture = this.gesture;
        this.setGesture('thumbsUp');

        setTimeout(() => {
            this.setGesture(previousGesture);
        }, duration);
    }

    /**
     * Get current position
     */
    getPosition() {
        return this.currentPosition.clone();
    }

    /**
     * Check if cursor is currently moving
     */
    isCurrentlyMoving() {
        return this.isMoving;
    }

    /**
     * Set visibility
     */
    setVisible(visible) {
        this.isVisible = visible;
        if (this.mesh) {
            this.mesh.setEnabled(visible);
        }
    }

    /**
     * Dispose cursor
     */
    dispose() {
        if (this.palm) this.palm.dispose();
        this.fingers.forEach(f => f.mesh.dispose());
        if (this.thumb) this.thumb.dispose();
        if (this.mesh) this.mesh.dispose();
    }
}
