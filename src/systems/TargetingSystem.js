/**
 * TargetingSystem - Handles drop targeting with visual guides
 *
 * Click-to-place mode: cursor follows mouse exactly, click to place
 */
export class TargetingSystem {
    constructor(scene, camera, arena) {
        this.scene = scene;
        this.camera = camera;
        this.arena = arena;
        this.isActive = false;
        this.targetPosition = new BABYLON.Vector3(0, 0, 0);
        this.onPlaceCallback = null;

        // Visual elements
        this.dropIndicator = null;

        // Ground plane for raycasting
        this.groundPlane = null;

        // Arena dimensions
        this.arenaWidth = arena.getDimensions().width;
        this.arenaDepth = arena.getDimensions().depth;
        this.maxX = this.arenaWidth / 2 - 2;
        this.maxZ = this.arenaDepth / 2 - 2;

        this.setupMouseTracking();
    }

    /**
     * Setup mouse position tracking and click handling
     */
    setupMouseTracking() {
        this.scene.onPointerObservable.add((pointerInfo) => {
            if (!this.isActive) return;

            if (pointerInfo.type === BABYLON.PointerEventTypes.POINTERMOVE) {
                this.updateTargetFromRaycast(pointerInfo.event);
            } else if (pointerInfo.type === BABYLON.PointerEventTypes.POINTERDOWN) {
                // Check if click is on UI (ignore if so)
                if (pointerInfo.pickInfo && pointerInfo.pickInfo.hit) {
                    // Click on game area - place the object
                    this.handlePlacement();
                } else {
                    // Clicked on empty space (but still valid ground position from raycast)
                    this.handlePlacement();
                }
            }
        });
    }

    /**
     * Update target position from mouse raycast to ground
     */
    updateTargetFromRaycast(event) {
        // Create a picking ray from mouse position
        const pickResult = this.scene.pick(
            event.clientX,
            event.clientY,
            (mesh) => mesh.name === "ground" // Only pick the ground
        );

        if (pickResult.hit) {
            // Got a hit on ground - use that position
            this.targetPosition.x = pickResult.pickedPoint.x;
            this.targetPosition.z = pickResult.pickedPoint.z;
        } else {
            // No ground hit - use a ground plane raycast
            const ray = this.scene.createPickingRay(
                event.clientX,
                event.clientY,
                BABYLON.Matrix.Identity(),
                this.camera
            );

            // Calculate intersection with ground plane (y = 0)
            const groundY = 0;
            const t = -ray.origin.y / ray.direction.y;

            if (t > 0) {
                this.targetPosition.x = ray.origin.x + ray.direction.x * t;
                this.targetPosition.z = ray.origin.z + ray.direction.z * t;
            }
        }

        // Clamp to arena bounds
        this.targetPosition.x = Math.max(-this.maxX, Math.min(this.maxX, this.targetPosition.x));
        this.targetPosition.z = Math.max(-this.maxZ, Math.min(this.maxZ, this.targetPosition.z));
        this.targetPosition.y = 0;

        this.updateVisuals();
    }

    /**
     * Handle placement click
     */
    handlePlacement() {
        if (this.onPlaceCallback) {
            this.onPlaceCallback(this.targetPosition.clone());
        }
    }

    /**
     * Activate targeting mode
     */
    activate(onPlaceCallback) {
        this.isActive = true;
        this.onPlaceCallback = onPlaceCallback;

        // Initialize position at center
        this.targetPosition.x = 0;
        this.targetPosition.y = 0;
        this.targetPosition.z = 0;

        this.createVisuals();
        this.updateVisuals();
    }

    /**
     * Deactivate targeting mode
     */
    deactivate() {
        this.isActive = false;
        this.onPlaceCallback = null;
        this.removeVisuals();
    }

    /**
     * Create visual indicator for placement
     */
    createVisuals() {
        // Drop point indicator (circle on ground)
        this.dropIndicator = BABYLON.MeshBuilder.CreateDisc(
            "dropIndicator",
            { radius: 1.5, tessellation: 32 },
            this.scene
        );
        this.dropIndicator.rotation.x = Math.PI / 2; // Lay flat on ground
        this.dropIndicator.position.y = 0.1; // Slightly above ground

        const indicatorMaterial = new BABYLON.StandardMaterial("indicatorMat", this.scene);
        indicatorMaterial.diffuseColor = new BABYLON.Color3(1, 1, 0); // Yellow
        indicatorMaterial.emissiveColor = new BABYLON.Color3(0.5, 0.5, 0);
        indicatorMaterial.alpha = 0.6;
        this.dropIndicator.material = indicatorMaterial;
    }

    /**
     * Update visuals based on target position
     */
    updateVisuals() {
        if (!this.isActive) return;

        // Update drop indicator position
        if (this.dropIndicator) {
            this.dropIndicator.position.x = this.targetPosition.x;
            this.dropIndicator.position.z = this.targetPosition.z;
        }
    }

    /**
     * Get current target position
     */
    getTargetPosition() {
        return this.targetPosition.clone();
    }

    /**
     * Check if targeting is active
     */
    isTargeting() {
        return this.isActive;
    }

    /**
     * Update camera position (legacy - no longer needed as cursor follows mouse directly)
     */
    updateCameraPosition(x) {
        // No-op: cursor now follows mouse via raycasting, not camera position
    }

    /**
     * Remove visual elements
     */
    removeVisuals() {
        if (this.dropIndicator) {
            this.dropIndicator.dispose();
            this.dropIndicator = null;
        }
    }

    /**
     * Dispose targeting system
     */
    dispose() {
        this.removeVisuals();
    }
}
