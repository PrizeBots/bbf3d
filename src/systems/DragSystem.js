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
        this.confirmRing = null;
        this.currentHoverTarget = null;

        // Callbacks for cursor gestures
        this.onDragStartCallback = null;
        this.onDragEndCallback = null;
        this.onHoverCallback = null;
        this.currentHoverObject = null;

        // Callback for detecting drop targets (task assignment)
        this.getAllTaskTargets = null; // Function to get all valid drop targets
        this.onTaskAssigned = null; // Callback when a bubby is dropped on a target

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

        // Trigger drag start callback
        if (this.onDragStartCallback) {
            this.onDragStartCallback(object);
        }
    }

    /**
     * Handle pointer move - drag object or check for hover
     */
    onPointerMove(pointerInfo) {
        // If not dragging, check for hover over draggable objects
        if (!this.isDragging) {
            this.checkHover(pointerInfo);
            return;
        }

        if (!this.draggedObject) return;

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

            // Check for hover over valid drop targets
            this.checkDropTargetHover(newPos);
        }
    }

    /**
     * Check if dragging over a valid drop target
     */
    checkDropTargetHover(dragPosition) {
        if (!this.getAllTaskTargets) {
            this.hideConfirmRing();
            return;
        }

        // Only show confirm ring if dragged object can be assigned tasks
        if (!this.draggedObject || !this.draggedObject.assignTask) {
            this.hideConfirmRing();
            return;
        }

        const targets = this.getAllTaskTargets();
        const pickRadius = 4.0;
        let foundTarget = null;

        for (const targetInfo of targets) {
            const target = targetInfo.target;

            // Get target position
            let targetPos;
            if (target.getPosition) {
                targetPos = target.getPosition();
            } else if (target.mesh && target.mesh.position) {
                targetPos = target.mesh.position;
            } else if (target.rootNode && target.rootNode.position) {
                targetPos = target.rootNode.position;
            } else {
                continue;
            }

            // Calculate 2D distance
            const dx = dragPosition.x - targetPos.x;
            const dz = dragPosition.z - targetPos.z;
            const distance = Math.sqrt(dx * dx + dz * dz);

            if (distance <= pickRadius) {
                foundTarget = { target, targetPos, taskType: targetInfo.taskType };
                break;
            }
        }

        if (foundTarget) {
            if (this.currentHoverTarget !== foundTarget.target) {
                this.currentHoverTarget = foundTarget.target;
                this.showConfirmRing(foundTarget.targetPos, foundTarget.taskType);
            }
        } else {
            if (this.currentHoverTarget !== null) {
                this.currentHoverTarget = null;
                this.hideConfirmRing();
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
            // Get drop position before dropping
            const dropPosition = this.draggedObject.getPosition().clone();
            dropPosition.y = 0; // Ground level

            // Check if dropped on a task target
            const taskTarget = this.findNearbyTaskTarget(dropPosition);

            // Drop the object - it will fall with physics
            if (this.draggedObject.endDrag) {
                this.draggedObject.endDrag();
            }

            // If dropped on a task target and object can be assigned tasks
            if (taskTarget && this.draggedObject.assignTask) {
                this.draggedObject.assignTask(taskTarget.target, taskTarget.taskType);
                // Don't resume AI - the task assignment will handle state
            } else {
                // Resume object AI/physics if it has a resume method
                if (this.draggedObject.resumeAI) {
                    this.draggedObject.resumeAI();
                }
            }

            // Trigger task assigned callback
            if (taskTarget && this.onTaskAssigned) {
                this.onTaskAssigned(this.draggedObject, taskTarget);
            }
        }

        this.isDragging = false;
        this.draggedObject = null;
        this.dragPlane = null;
        this.currentHoverTarget = null;
        this.removeDragIndicator();
        this.hideConfirmRing();

        // Trigger drag end callback
        if (this.onDragEndCallback) {
            this.onDragEndCallback();
        }
    }

    /**
     * Find nearby task target at drop position
     */
    findNearbyTaskTarget(position) {
        if (!this.getAllTaskTargets) return null;

        const targets = this.getAllTaskTargets();
        const pickRadius = 4.0; // Distance to consider as "dropped on"

        for (const targetInfo of targets) {
            const target = targetInfo.target;
            const taskType = targetInfo.taskType;

            // Get target position
            let targetPos;
            if (target.getPosition) {
                targetPos = target.getPosition();
            } else if (target.mesh && target.mesh.position) {
                targetPos = target.mesh.position;
            } else if (target.rootNode && target.rootNode.position) {
                targetPos = target.rootNode.position;
            } else {
                continue;
            }

            // Calculate 2D distance (ignore Y)
            const dx = position.x - targetPos.x;
            const dz = position.z - targetPos.z;
            const distance = Math.sqrt(dx * dx + dz * dz);

            if (distance <= pickRadius) {
                return { target, taskType };
            }
        }

        return null;
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
     * Show confirm ring around a target
     */
    showConfirmRing(position, taskType) {
        // Remove existing ring
        this.hideConfirmRing();

        // Determine ring color based on task type
        let ringColor;
        switch (taskType) {
            case 'attack':
            case 'attack_building':
                ringColor = new BABYLON.Color3(1, 0.2, 0.2); // Red for attack
                break;
            case 'soldier':
                ringColor = new BABYLON.Color3(1, 0.8, 0.2); // Gold for soldier
                break;
            case 'harvest':
                ringColor = new BABYLON.Color3(0.2, 1, 0.2); // Green for harvest
                break;
            default:
                ringColor = new BABYLON.Color3(0.2, 0.8, 1); // Cyan default
        }

        // Create outer ring (torus)
        this.confirmRing = BABYLON.MeshBuilder.CreateTorus(
            "confirmRing",
            { diameter: 8, thickness: 0.3, tessellation: 32 },
            this.scene
        );
        this.confirmRing.position = new BABYLON.Vector3(position.x, 0.15, position.z);

        const ringMaterial = new BABYLON.StandardMaterial("confirmRingMat", this.scene);
        ringMaterial.diffuseColor = ringColor;
        ringMaterial.emissiveColor = ringColor.scale(0.7);
        ringMaterial.alpha = 0.8;
        this.confirmRing.material = ringMaterial;

        // Animate the ring (pulsing scale)
        this.confirmRing.scaling.setAll(0.8);
        const animation = new BABYLON.Animation(
            "ringPulse",
            "scaling",
            30,
            BABYLON.Animation.ANIMATIONTYPE_VECTOR3,
            BABYLON.Animation.ANIMATIONLOOPMODE_CYCLE
        );
        animation.setKeys([
            { frame: 0, value: new BABYLON.Vector3(0.8, 1, 0.8) },
            { frame: 15, value: new BABYLON.Vector3(1.0, 1, 1.0) },
            { frame: 30, value: new BABYLON.Vector3(0.8, 1, 0.8) }
        ]);
        this.confirmRing.animations = [animation];
        this.scene.beginAnimation(this.confirmRing, 0, 30, true);
    }

    /**
     * Hide the confirm ring
     */
    hideConfirmRing() {
        if (this.confirmRing) {
            this.scene.stopAnimation(this.confirmRing);
            this.confirmRing.dispose();
            this.confirmRing = null;
        }
    }

    /**
     * Check for hovering over draggable objects
     */
    checkHover(pointerInfo) {
        const pickResult = this.scene.pick(
            pointerInfo.event.clientX,
            pointerInfo.event.clientY
        );

        let hoverObject = null;

        if (pickResult.hit && pickResult.pickedMesh) {
            const draggableObjects = this.getAllDraggableObjects();

            for (const obj of draggableObjects) {
                if (this.isObjectMesh(obj, pickResult.pickedMesh)) {
                    if (obj.isDraggable && obj.isDraggable()) {
                        hoverObject = obj;
                        break;
                    }
                }
            }
        }

        // Trigger callback on hover state change
        if (hoverObject !== this.currentHoverObject) {
            this.currentHoverObject = hoverObject;
            if (this.onHoverCallback) {
                this.onHoverCallback(hoverObject !== null);
            }
        }
    }

    /**
     * Check if currently dragging
     */
    isDraggingActive() {
        return this.isDragging;
    }

    /**
     * Set callback for drag start
     */
    setOnDragStartCallback(callback) {
        this.onDragStartCallback = callback;
    }

    /**
     * Set callback for drag end
     */
    setOnDragEndCallback(callback) {
        this.onDragEndCallback = callback;
    }

    /**
     * Set callback for hover state changes
     */
    setOnHoverCallback(callback) {
        this.onHoverCallback = callback;
    }

    /**
     * Set function to get all valid task targets for drop detection
     * Should return array of { target, taskType } objects
     */
    setGetAllTaskTargets(callback) {
        this.getAllTaskTargets = callback;
    }

    /**
     * Set callback for when a task is assigned via drag-drop
     */
    setOnTaskAssigned(callback) {
        this.onTaskAssigned = callback;
    }

    /**
     * Dispose drag system
     */
    dispose() {
        this.stopDragging();
    }
}
