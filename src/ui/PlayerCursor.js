/**
 * PlayerCursor - Visible 3D cursor that follows mouse position
 *
 * Displays as a white glove hand with different gestures:
 * - pointing: Index finger extended (default)
 * - open: All fingers spread (hovering over draggable)
 * - grabbing: Fingers curled (dragging object)
 * - thumbsUp: Thumb up gesture (placement confirmed)
 */
export class PlayerCursor {
    constructor(scene, camera, team = 'red') {
        this.scene = scene;
        this.camera = camera;
        this.team = team;
        this.mesh = null;
        this.fingers = [];
        this.thumb = null;
        this.palm = null;

        // Current gesture state
        this.gesture = 'pointing'; // 'pointing', 'open', 'grabbing', 'thumbsUp'

        // Position tracking
        this.targetPosition = new BABYLON.Vector3(0, 0, 0);
        this.currentPosition = new BABYLON.Vector3(0, 0, 0);
        this.smoothSpeed = 0.3;

        // Visibility
        this.isVisible = true;

        // Team glow color
        this.glowColor = team === 'red'
            ? new BABYLON.Color3(1, 0.3, 0.3)
            : new BABYLON.Color3(0.3, 0.5, 1);

        this.create();
        this.setupMouseTracking();
    }

    /**
     * Create the glove hand mesh using primitives
     */
    create() {
        // Create root transform
        this.mesh = new BABYLON.TransformNode("playerCursor", this.scene);
        this.mesh.position.y = 0.5; // Slightly above ground

        // Create palm (flattened sphere)
        this.palm = BABYLON.MeshBuilder.CreateSphere(
            "cursorPalm",
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

        // Create material for glove (white with team glow)
        const gloveMaterial = new BABYLON.StandardMaterial("gloveMat", this.scene);
        gloveMaterial.diffuseColor = new BABYLON.Color3(0.95, 0.95, 0.95);
        gloveMaterial.emissiveColor = this.glowColor.scale(0.2);
        gloveMaterial.specularColor = new BABYLON.Color3(0.3, 0.3, 0.3);
        this.palm.material = gloveMaterial;

        // Create fingers (4 fingers)
        const fingerPositions = [
            { x: -0.35, z: 0.4 },  // Index
            { x: -0.12, z: 0.45 }, // Middle
            { x: 0.12, z: 0.45 },  // Ring
            { x: 0.35, z: 0.4 }    // Pinky
        ];

        const fingerLengths = [0.6, 0.7, 0.65, 0.5];

        fingerPositions.forEach((pos, i) => {
            const finger = BABYLON.MeshBuilder.CreateCapsule(
                `cursorFinger${i}`,
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
            finger.rotation.x = Math.PI / 2; // Point forward
            finger.material = gloveMaterial;

            this.fingers.push({
                mesh: finger,
                basePos: { x: pos.x, z: pos.z },
                length: fingerLengths[i],
                baseRotX: Math.PI / 2
            });
        });

        // Create thumb (angled capsule)
        this.thumb = BABYLON.MeshBuilder.CreateCapsule(
            "cursorThumb",
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
        this.thumb.rotation.z = -Math.PI / 4; // Angle outward
        this.thumb.material = gloveMaterial;

        // Set initial gesture
        this.setGesture('pointing');
    }

    /**
     * Setup mouse position tracking
     */
    setupMouseTracking() {
        this.scene.onPointerObservable.add((pointerInfo) => {
            if (pointerInfo.type === BABYLON.PointerEventTypes.POINTERMOVE) {
                this.updateTargetFromMouse(pointerInfo.event);
            }
        });

        // Update cursor position smoothly each frame
        this.scene.onBeforeRenderObservable.add(() => {
            this.update();
        });
    }

    /**
     * Update target position from mouse raycast
     */
    updateTargetFromMouse(event) {
        // Raycast to ground
        const pickResult = this.scene.pick(
            event.clientX,
            event.clientY,
            (mesh) => mesh.name === "ground"
        );

        if (pickResult.hit) {
            this.targetPosition.x = pickResult.pickedPoint.x;
            this.targetPosition.z = pickResult.pickedPoint.z;
        } else {
            // Fallback: raycast to ground plane
            const ray = this.scene.createPickingRay(
                event.clientX,
                event.clientY,
                BABYLON.Matrix.Identity(),
                this.camera
            );

            const t = -ray.origin.y / ray.direction.y;
            if (t > 0) {
                this.targetPosition.x = ray.origin.x + ray.direction.x * t;
                this.targetPosition.z = ray.origin.z + ray.direction.z * t;
            }
        }
    }

    /**
     * Update cursor position and orientation
     */
    update() {
        if (!this.mesh || !this.isVisible) return;

        // Smooth follow
        this.currentPosition.x += (this.targetPosition.x - this.currentPosition.x) * this.smoothSpeed;
        this.currentPosition.z += (this.targetPosition.z - this.currentPosition.z) * this.smoothSpeed;

        this.mesh.position.x = this.currentPosition.x;
        this.mesh.position.z = this.currentPosition.z;

        // Face camera direction (rotate to face forward from camera's perspective)
        const cameraDirection = this.camera.getForwardRay().direction;
        const angle = Math.atan2(cameraDirection.x, cameraDirection.z);
        this.mesh.rotation.y = angle + Math.PI; // Face away from camera
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
     * Pointing pose - index finger extended, others curled
     */
    setPosePointing() {
        this.fingers.forEach((finger, i) => {
            if (i === 0) {
                // Index finger - extended
                finger.mesh.rotation.x = Math.PI / 2;
                finger.mesh.position.z = finger.basePos.z + finger.length / 2;
                finger.mesh.position.y = 0.2;
            } else {
                // Other fingers - curled
                finger.mesh.rotation.x = Math.PI / 2 + 1.2;
                finger.mesh.position.z = finger.basePos.z;
                finger.mesh.position.y = 0;
            }
        });

        // Thumb - slightly curled
        this.thumb.rotation.x = Math.PI / 2 + 0.5;
        this.thumb.rotation.z = -Math.PI / 4;
    }

    /**
     * Open pose - all fingers spread
     */
    setPoseOpen() {
        this.fingers.forEach((finger, i) => {
            finger.mesh.rotation.x = Math.PI / 2;
            finger.mesh.position.z = finger.basePos.z + finger.length / 2;
            finger.mesh.position.y = 0.2;

            // Spread fingers slightly
            finger.mesh.rotation.z = (i - 1.5) * 0.1;
        });

        // Thumb - extended outward
        this.thumb.rotation.x = Math.PI / 2;
        this.thumb.rotation.z = -Math.PI / 3;
    }

    /**
     * Grabbing pose - all fingers curled
     */
    setPoseGrabbing() {
        this.fingers.forEach((finger) => {
            finger.mesh.rotation.x = Math.PI / 2 + 1.5;
            finger.mesh.position.z = finger.basePos.z - 0.1;
            finger.mesh.position.y = -0.1;
            finger.mesh.rotation.z = 0;
        });

        // Thumb - curled inward
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

        // Thumb - pointing up
        this.thumb.rotation.x = 0;
        this.thumb.rotation.z = 0;
        this.thumb.position.y = 0.5;
    }

    /**
     * Show thumbs up briefly then return to previous gesture
     */
    flashThumbsUp(duration = 500) {
        const previousGesture = this.gesture;
        this.setGesture('thumbsUp');

        setTimeout(() => {
            this.setGesture(previousGesture);
        }, duration);
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
     * Get current position
     */
    getPosition() {
        return this.currentPosition.clone();
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
