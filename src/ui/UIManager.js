/**
 * UIManager - Manages all UI elements and interactions
 */
class UIManager {
    constructor(scene, canvas) {
        this.scene = scene;
        this.canvas = canvas;
        this.advancedTexture = null;
        this.menuPanel = null;
        this.spawnCallbacks = {};
        this.holdStartCallbacks = {};
        this.holdEndCallbacks = {};

        this.initialize();
    }

    /**
     * Initialize UI system
     */
    initialize() {
        this.advancedTexture = BABYLON.GUI.AdvancedDynamicTexture.CreateFullscreenUI("UI");
        this.createMenuPanel();
        this.createButtons();
    }

    /**
     * Create main menu panel at top center
     */
    createMenuPanel() {
        this.menuPanel = new BABYLON.GUI.StackPanel();
        this.menuPanel.width = "400px";
        this.menuPanel.height = "80px";
        this.menuPanel.isVertical = false;
        this.menuPanel.horizontalAlignment = BABYLON.GUI.Control.HORIZONTAL_ALIGNMENT_CENTER;
        this.menuPanel.verticalAlignment = BABYLON.GUI.Control.VERTICAL_ALIGNMENT_TOP;
        this.menuPanel.top = "20px";
        this.advancedTexture.addControl(this.menuPanel);
    }

    /**
     * Create spawn buttons
     */
    createButtons() {
        const buttonConfigs = [
            { text: "Egg", type: "egg" },
            { text: "Seed", type: "seed" },
            { text: "Building", type: "building" }
        ];

        buttonConfigs.forEach(config => {
            const button = this.createButton(config.text, config.type);
            this.menuPanel.addControl(button);
        });
    }

    /**
     * Create a single button with hold/release support
     */
    createButton(text, objectType) {
        const button = BABYLON.GUI.Button.CreateSimpleButton(`btn_${text}`, text);
        button.width = "120px";
        button.height = "60px";
        button.color = "white";
        button.background = "#444444";
        button.cornerRadius = 10;
        button.thickness = 2;
        button.paddingLeft = "5px";
        button.paddingRight = "5px";

        let isHolding = false;

        // Hover effects
        button.onPointerEnterObservable.add(() => {
            if (!isHolding) {
                button.background = "#666666";
            }
        });

        button.onPointerOutObservable.add(() => {
            if (!isHolding) {
                button.background = "#444444";
            }
        });

        // Button press (hold start)
        button.onPointerDownObservable.add(() => {
            isHolding = true;
            button.background = "#888888";
            this.handleHoldStart(objectType);
        });

        // Button release (hold end)
        button.onPointerUpObservable.add(() => {
            if (isHolding) {
                isHolding = false;
                button.background = "#444444";
                this.handleHoldEnd(objectType);
            }
        });

        return button;
    }

    /**
     * Handle button hold start
     */
    handleHoldStart(objectType) {
        if (this.holdStartCallbacks[objectType]) {
            this.holdStartCallbacks[objectType]();
        }
    }

    /**
     * Handle button hold end (release and spawn)
     */
    handleHoldEnd(objectType) {
        if (this.holdEndCallbacks[objectType]) {
            this.holdEndCallbacks[objectType]();
        }
    }

    /**
     * Register hold start callback for a specific object type
     */
    registerHoldStartCallback(objectType, callback) {
        this.holdStartCallbacks[objectType] = callback;
    }

    /**
     * Register hold end callback for a specific object type
     */
    registerHoldEndCallback(objectType, callback) {
        this.holdEndCallbacks[objectType] = callback;
    }

    /**
     * Register spawn callback for a specific object type (deprecated, use hold callbacks)
     */
    registerSpawnCallback(objectType, callback) {
        this.spawnCallbacks[objectType] = callback;
    }

    /**
     * Get screen center X position
     */
    getScreenCenterX() {
        return this.canvas.width / 2;
    }

    /**
     * Dispose UI and clean up
     */
    dispose() {
        if (this.advancedTexture) {
            this.advancedTexture.dispose();
        }
    }
}