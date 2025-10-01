/**
 * CameraController - Manages camera setup and controls
 */
class CameraController {
    constructor(scene, canvas) {
        this.scene = scene;
        this.canvas = canvas;
        this.camera = null;
        this.keysPressed = {};
        this.cameraSpeed = 0.3;
        this.onCameraMoveCallback = null;

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

        // Disable default camera controls
        this.camera.attachControl(this.canvas, false);
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
}