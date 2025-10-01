/**
 * TargetingSystem - Handles drop targeting with visual guides
 */
class TargetingSystem {
    constructor(scene, camera, arena) {
        this.scene = scene;
        this.camera = camera;
        this.arena = arena;
        this.isActive = false;
        this.targetPosition = new BABYLON.Vector3(0, 0, 0);

        // Visual elements
        this.verticalLine = null;
        this.horizontalLine = null;
        this.dropIndicator = null;

        // Mouse tracking
        this.mouseY = 0;
        this.arenaWidth = arena.getDimensions().width;
        this.arenaDepth = arena.getDimensions().depth;

        this.setupMouseTracking();
    }

    /**
     * Setup mouse position tracking
     */
    setupMouseTracking() {
        this.scene.onPointerObservable.add((pointerInfo) => {
            if (pointerInfo.type === BABYLON.PointerEventTypes.POINTERMOVE) {
                this.mouseY = pointerInfo.event.clientY;
                if (this.isActive) {
                    this.updateTargetFromMouse();
                }
            }
        });
    }

    /**
     * Activate targeting mode
     */
    activate(cameraTargetX) {
        this.isActive = true;
        this.targetPosition.x = cameraTargetX;
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
        this.removeVisuals();
    }

    /**
     * Create visual guide lines
     */
    createVisuals() {
        // Vertical line from top to drop point
        this.verticalLine = BABYLON.MeshBuilder.CreateLines(
            "verticalGuideLine",
            {
                points: [
                    new BABYLON.Vector3(this.targetPosition.x, 30, this.targetPosition.z),
                    new BABYLON.Vector3(this.targetPosition.x, 0, this.targetPosition.z)
                ]
            },
            this.scene
        );
        this.verticalLine.color = new BABYLON.Color3(1, 1, 0); // Yellow
        this.verticalLine.alpha = 0.7;

        // Horizontal line along depth (Z-axis)
        const halfDepth = this.arenaDepth / 2;
        this.horizontalLine = BABYLON.MeshBuilder.CreateLines(
            "horizontalGuideLine",
            {
                points: [
                    new BABYLON.Vector3(this.targetPosition.x, 0, -halfDepth),
                    new BABYLON.Vector3(this.targetPosition.x, 0, halfDepth)
                ]
            },
            this.scene
        );
        this.horizontalLine.color = new BABYLON.Color3(1, 1, 1); // White
        this.horizontalLine.alpha = 0.3;

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

        // Update vertical line position
        if (this.verticalLine) {
            this.verticalLine.dispose();
            this.verticalLine = BABYLON.MeshBuilder.CreateLines(
                "verticalGuideLine",
                {
                    points: [
                        new BABYLON.Vector3(this.targetPosition.x, 30, this.targetPosition.z),
                        new BABYLON.Vector3(this.targetPosition.x, 0, this.targetPosition.z)
                    ]
                },
                this.scene
            );
            this.verticalLine.color = new BABYLON.Color3(1, 1, 0);
            this.verticalLine.alpha = 0.7;
        }

        // Update horizontal line position (along depth/Z-axis)
        if (this.horizontalLine) {
            this.horizontalLine.dispose();
            const halfDepth = this.arenaDepth / 2;
            this.horizontalLine = BABYLON.MeshBuilder.CreateLines(
                "horizontalGuideLine",
                {
                    points: [
                        new BABYLON.Vector3(this.targetPosition.x, 0, -halfDepth),
                        new BABYLON.Vector3(this.targetPosition.x, 0, halfDepth)
                    ]
                },
                this.scene
            );
            this.horizontalLine.color = new BABYLON.Color3(1, 1, 1);
            this.horizontalLine.alpha = 0.3;
        }

        // Update drop indicator position
        if (this.dropIndicator) {
            this.dropIndicator.position.x = this.targetPosition.x;
            this.dropIndicator.position.z = this.targetPosition.z;
        }
    }

    /**
     * Update target position from mouse Y coordinate (adjusts depth/Z)
     */
    updateTargetFromMouse() {
        // Get canvas dimensions
        const canvas = this.scene.getEngine().getRenderingCanvas();
        const canvasHeight = canvas.height;

        // Keep X at camera target (moves with A/D keys)
        this.targetPosition.x = this.camera.target.x;

        // Normalize mouse Y to -1 to 1 range (inverted: top = forward)
        const normalizedY = -((this.mouseY / canvasHeight) * 2 - 1);

        // Map to arena depth range
        const maxDepth = this.arenaDepth / 2 - 3; // Leave some margin
        this.targetPosition.z = normalizedY * maxDepth;

        // Clamp to arena bounds
        this.targetPosition.z = Math.max(-maxDepth, Math.min(maxDepth, this.targetPosition.z));

        this.updateVisuals();
    }

    /**
     * Update when camera moves (A/D keys)
     */
    updateCameraPosition(cameraTargetX) {
        if (this.isActive) {
            // Update X to follow camera, keep Z at current depth
            this.targetPosition.x = cameraTargetX;
            this.updateVisuals();
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
     * Remove all visual elements
     */
    removeVisuals() {
        if (this.verticalLine) {
            this.verticalLine.dispose();
            this.verticalLine = null;
        }
        if (this.horizontalLine) {
            this.horizontalLine.dispose();
            this.horizontalLine = null;
        }
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