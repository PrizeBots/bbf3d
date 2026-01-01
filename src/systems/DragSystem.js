import { GameConstants } from '../config/GameConstants.js';

/**
 * DragSystem - Handles mouse dragging and moving of draggable objects
 */
export class DragSystem {
    constructor(scene, camera, arena, getAllDraggableObjects) {
        this.scene = scene;
        this.camera = camera;
        this.arena = arena;
        this.getAllDraggableObjects = getAllDraggableObjects;

        this.isDragging = false;
        this.draggedObject = null;
        this.dragPlane = null;
        this.dragOffset = new BABYLON.Vector3(0, 0, 0);

        // Visual feedback
        this.dragIndicator = null;

        // Arena bounds
        const dimensions = arena.getDimensions();
        this.arenaWidth = dimensions.width;
        this.arenaDepth = dimensions.depth;
        this.maxX = (this.arenaWidth / 2) - 2;
        this.maxZ = (this.arenaDepth / 2) - 2;

        this.setupMouseTracking();
    }

    /**
     * Setup mouse event tracking
     */
    setupMouseTracking() {
        this.scene.onPointerObservable.add((pointerInfo) => {
            switch (pointerInfo.type) {
                case BABYLON.PointerEventTypes.POINTERDOWN:
                    this.onPointerDown(pointerInfo);
                    break;
                case BABYLON.PointerEventTypes.POINTERMOVE:
                    this.onPointerMove(pointerInfo);
                    break;
                case BABYLON.PointerEventTypes.POINTERUP:
                    this.onPointerUp(pointerInfo);
                    break;
            }
        });
    }

    /**
     * Handle pointer down - pick object
     */
    onPointerDown(pointerInfo) {
        if (this.isDragging) return;

        const pickResult = this.scene.pick(
            pointerInfo.event.clientX,
            pointerInfo.event.clientY
        );

        if (pickResult.hit && pickResult.pickedMesh) {
            // Find the spawnable object that owns this mesh
            const draggableObjects = this.getAllDraggableObjects();

            for (const obj of draggableObjects) {
                if (this.isObjectMesh(obj, pickResult.pickedMesh)) {
                    // Check if object is draggable
                    if (obj.isDraggable && obj.isDraggable()) {
                        this.startDragging(obj, pickResult.pickedPoint);
                        break;
                    }
                }
            }
        }
    }

    /**
     * Check if a mesh belongs to an object
     */
    isObjectMesh(object, mesh) {
        if (!object.mesh) return false;

        // Check direct mesh match
        if (object.mesh === mesh) return true;

        // Check if mesh is a child of the object's mesh
        let parent = mesh.parent;
        while (parent) {
            if (parent === object.mesh) return true;
            parent = parent.parent;
        }

        return false;
    }

    /**
     * Start dragging an object
     */
    startDragging(object, pickPoint) {
        this.isDragging = true;
        this.draggedObject = object;

        // Lift height for dragging
        const liftHeight = GameConstants.PHYSICS.DRAG_LIFT_HEIGHT;

        // Create a drag plane at the lift height
        this.dragPlane = BABYLON.Plane.FromPositionAndNormal(
            new BABYLON.Vector3(0, liftHeight, 0),
            new BABYLON.Vector3(0, 1, 0)
        );

        // Calculate offset from pick point to object center
        const objectPos = object.getPosition();
        this.dragOffset.x = objectPos.x - pickPoint.x;
        this.dragOffset.z = objectPos.z - pickPoint.z;

        // Lift the object up
        if (object.startDrag) {
            object.startDrag(liftHeight);
        }

        // Create visual feedback
        this.createDragIndicator(objectPos);

        // Pause object AI/physics if it has an update method
        if (object.pauseAI) {
            object.pauseAI();
        }
    }

    /**
     * Handle pointer move - drag object
     */
    onPointerMove(pointerInfo) {
        if (!this.isDragging || !this.draggedObject) return;

        // Create a ray from camera through mouse position
        const ray = this.scene.createPickingRay(
            pointerInfo.event.clientX,
            pointerInfo.event.clientY,
            BABYLON.Matrix.Identity(),
            this.camera
        );

        // Find intersection with drag plane (at lift height)
        const distance = ray.intersectsPlane(this.dragPlane);

        if (distance !== null) {
            const pickPoint = ray.direction.scale(distance).add(ray.origin);

            // Apply offset and constrain to arena bounds
            let newX = pickPoint.x + this.dragOffset.x;
            let newZ = pickPoint.z + this.dragOffset.z;

            // Clamp to arena bounds
            newX = Math.max(-this.maxX, Math.min(this.maxX, newX));
            newZ = Math.max(-this.maxZ, Math.min(this.maxZ, newZ));

            // Update object position (keep it at lift height)
            const liftHeight = GameConstants.PHYSICS.DRAG_LIFT_HEIGHT;
            const newPos = new BABYLON.Vector3(newX, liftHeight, newZ);
            this.draggedObject.setPosition(newPos);

            // Update visual indicator on ground
            if (this.dragIndicator) {
                this.dragIndicator.position.x = newX;
                this.dragIndicator.position.z = newZ;
            }
        }
    }

    /**
     * Handle pointer up - drop object
     */
    onPointerUp(pointerInfo) {
        if (!this.isDragging) return;

        this.stopDragging();
    }

    /**
     * Stop dragging and clean up
     */
    stopDragging() {
        if (this.draggedObject) {
            // Drop the object - it will fall with physics
            if (this.draggedObject.endDrag) {
                this.draggedObject.endDrag();
            }

            // Resume object AI/physics if it has a resume method
            if (this.draggedObject.resumeAI) {
                this.draggedObject.resumeAI();
            }
        }

        this.isDragging = false;
        this.draggedObject = null;
        this.dragPlane = null;
        this.removeDragIndicator();
    }

    /**
     * Create visual indicator for dragging
     */
    createDragIndicator(position) {
        this.dragIndicator = BABYLON.MeshBuilder.CreateDisc(
            "dragIndicator",
            { radius: 2, tessellation: 32 },
            this.scene
        );
        this.dragIndicator.rotation.x = Math.PI / 2; // Lay flat
        this.dragIndicator.position = new BABYLON.Vector3(
            position.x,
            0.05,
            position.z
        );

        const material = new BABYLON.StandardMaterial("dragIndicatorMat", this.scene);
        material.diffuseColor = new BABYLON.Color3(0.3, 1.0, 0.3); // Green
        material.emissiveColor = new BABYLON.Color3(0.1, 0.4, 0.1);
        material.alpha = 0.5;
        this.dragIndicator.material = material;
    }

    /**
     * Remove drag indicator
     */
    removeDragIndicator() {
        if (this.dragIndicator) {
            this.dragIndicator.dispose();
            this.dragIndicator = null;
        }
    }

    /**
     * Check if currently dragging
     */
    isDraggingActive() {
        return this.isDragging;
    }

    /**
     * Dispose drag system
     */
    dispose() {
        this.stopDragging();
    }
}
