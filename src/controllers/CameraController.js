/**
 * CameraController - Manages camera setup and controls
 */
export class CameraController {
    constructor(scene, canvas) {
        this.scene = scene;
        this.canvas = canvas;
        this.camera = null;
        this.keysPressed = {};
        this.cameraSpeed = 0.3;
        this.onCameraMoveCallback = null;
        this.isFrozen = true; // Camera starts frozen

        this.setupCamera();
        this.setupControls();
    }

    /**
     * Initialize and configure the camera
     */
    setupCamera() {
        this.camera = new BABYLON.ArcRotateCamera(
            "camera",
            -Math.PI / 2, // Alpha (side view)
            Math.PI / 2.8, // Beta (tilted side view)
            65, // Radius
            new BABYLON.Vector3(0, 5, 0), // Target center of arena
            this.scene
        );

        // Set min/max beta to prevent seeing below ground
        this.camera.lowerBetaLimit = Math.PI / 4;
        this.camera.upperBetaLimit = Math.PI / 2;

        // Camera starts frozen, so don't attach controls
        // They will be attached when unfrozen
    }

    /**
     * Setup keyboard controls for camera movement
     */
    setupControls() {
        // Handle keyboard input
        this.scene.onKeyboardObservable.add((kbInfo) => {
            const key = kbInfo.event.key.toLowerCase();
            if (kbInfo.type === BABYLON.KeyboardEventTypes.KEYDOWN) {
                this.keysPressed[key] = true;
            } else if (kbInfo.type === BABYLON.KeyboardEventTypes.KEYUP) {
                this.keysPressed[key] = false;
            }
        });

        // Smooth camera movement in render loop
        this.scene.registerBeforeRender(() => {
            this.update();
        });
    }

    /**
     * Update camera position based on input
     */
    update() {
        let moved = false;
        if (this.keysPressed['a']) {
            this.camera.target.x -= this.cameraSpeed;
            moved = true;
        }
        if (this.keysPressed['d']) {
            this.camera.target.x += this.cameraSpeed;
            moved = true;
        }

        // Notify callback if camera moved
        if (moved && this.onCameraMoveCallback) {
            this.onCameraMoveCallback(this.camera.target.x);
        }
    }

    /**
     * Get current camera target position
     */
    getTargetX() {
        return this.camera.target.x;
    }

    /**
     * Get the camera instance
     */
    getCamera() {
        return this.camera;
    }

    /**
     * Set callback for when camera moves
     */
    setOnCameraMoveCallback(callback) {
        this.onCameraMoveCallback = callback;
    }

    /**
     * Freeze camera (disable mouse controls)
     */
    freezeCamera() {
        this.isFrozen = true;
        if (this.camera) {
            this.camera.detachControl();
        }
    }

    /**
     * Unfreeze camera (enable mouse controls)
     */
    unfreezeCamera() {
        this.isFrozen = false;
        if (this.camera) {
            this.camera.attachControl(this.canvas, false);
        }
    }

    /**
     * Set camera freeze state
     */
    setCameraFrozen(frozen) {
        if (frozen) {
            this.freezeCamera();
        } else {
            this.unfreezeCamera();
        }
    }

    /**
     * Check if camera is frozen
     */
    isCameraFrozen() {
        return this.isFrozen;
    }
}