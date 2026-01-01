import { GameConstants } from '../config/GameConstants.js';

/**
 * UIManager - Manages all UI elements and interactions
 *
 * Uses click-to-select mode: click button to enter placement mode,
 * click again or press ESC to cancel
 */
export class UIManager {
    constructor(scene, canvas) {
        this.scene = scene;
        this.canvas = canvas;
        this.advancedTexture = null;
        this.menuPanel = null;
        this.menuContainer = null;
        this.debugPanel = null;
        this.coinsText = null;
        this.coins = GameConstants.ECONOMY.STARTING_COINS; // Starting coins
        this.selectCallbacks = {};
        this.dragStartCallbacks = {};
        this.dragEndCallbacks = {};
        this.cameraFreezeCallback = null;
        this.isCameraFrozen = true; // Default: camera is frozen

        // Selection state
        this.selectedObjectType = null;
        this.selectedButton = null;
        this.buttonMap = {}; // Map of objectType -> button

        // Drag state for mobile
        this.isDragging = false;
        this.dragObjectType = null;

        // Submenu state
        this.buildingSubmenu = null;
        this.isBuildingSubmenuOpen = false;

        // Mobile camera panning state
        this.panningLeft = false;
        this.panningRight = false;

        // UI scaling
        this.uiScale = this.calculateUIScale();

        this.initialize();
    }

    /**
     * Calculate UI scale based on screen size
     * Returns a scale factor (1.0 = desktop, smaller = mobile)
     */
    calculateUIScale() {
        const width = window.innerWidth;
        const height = window.innerHeight;
        const minDimension = Math.min(width, height);

        // Scale based on smallest dimension
        if (minDimension < 400) {
            return 0.6; // Very small mobile
        } else if (minDimension < 500) {
            return 0.7; // Small mobile
        } else if (minDimension < 700) {
            return 0.8; // Mobile/tablet
        } else if (minDimension < 900) {
            return 0.9; // Large tablet
        }
        return 1.0; // Desktop
    }

    /**
     * Get scaled size as string with px
     */
    scaled(baseSize) {
        return Math.round(baseSize * this.uiScale) + "px";
    }

    /**
     * Initialize UI system
     */
    initialize() {
        this.advancedTexture = BABYLON.GUI.AdvancedDynamicTexture.CreateFullscreenUI("UI");
        this.createMenuPanel();
        this.createButtons();
        this.createDebugPanel();
        this.createMobileControls();
        this.setupMobileDragRelease();
        this.setupKeyboardShortcuts();
    }

    /**
     * Setup global pointer release handler for mobile drag-to-place
     */
    setupMobileDragRelease() {
        if (!this.isTouchDevice()) return;

        // Listen for pointer up anywhere on the screen
        this.scene.onPointerObservable.add((pointerInfo) => {
            if (pointerInfo.type === BABYLON.PointerEventTypes.POINTERUP) {
                if (this.isDragging && this.dragObjectType) {
                    // Trigger drag end callback
                    if (this.dragEndCallbacks[this.dragObjectType]) {
                        this.dragEndCallbacks[this.dragObjectType]();
                    }

                    // Reset drag state
                    this.isDragging = false;
                    this.dragObjectType = null;
                }
            }
        });
    }

    /**
     * Create main menu panel at top center
     */
    createMenuPanel() {
        // Create background container
        const container = new BABYLON.GUI.Rectangle();
        container.width = this.scaled(420);
        container.height = this.scaled(100);
        container.cornerRadius = Math.round(12 * this.uiScale);
        container.color = "white";
        container.thickness = Math.round(2 * this.uiScale);
        container.background = "rgba(20, 20, 30, 0.85)";
        container.horizontalAlignment = BABYLON.GUI.Control.HORIZONTAL_ALIGNMENT_CENTER;
        container.verticalAlignment = BABYLON.GUI.Control.VERTICAL_ALIGNMENT_TOP;
        container.top = "0px";
        this.advancedTexture.addControl(container);
        this.menuContainer = container;

        // Create vertical stack for coins + buttons
        const mainStack = new BABYLON.GUI.StackPanel();
        mainStack.isVertical = true;
        mainStack.spacing = Math.round(5 * this.uiScale);
        container.addControl(mainStack);

        // Create coins display at top
        const coinsContainer = new BABYLON.GUI.StackPanel();
        coinsContainer.height = this.scaled(24);
        coinsContainer.isVertical = false;
        coinsContainer.horizontalAlignment = BABYLON.GUI.Control.HORIZONTAL_ALIGNMENT_LEFT;
        coinsContainer.paddingLeft = this.scaled(15);
        mainStack.addControl(coinsContainer);

        // Coins label
        const coinsLabel = new BABYLON.GUI.TextBlock();
        coinsLabel.text = "Coins:";
        coinsLabel.width = this.scaled(55);
        coinsLabel.height = this.scaled(24);
        coinsLabel.color = "gold";
        coinsLabel.fontSize = Math.round(16 * this.uiScale);
        coinsLabel.fontWeight = "bold";
        coinsLabel.textHorizontalAlignment = BABYLON.GUI.Control.HORIZONTAL_ALIGNMENT_LEFT;
        coinsContainer.addControl(coinsLabel);

        // Coins counter
        this.coinsText = new BABYLON.GUI.TextBlock();
        this.coinsText.text = this.coins.toString();
        this.coinsText.width = this.scaled(80);
        this.coinsText.height = this.scaled(24);
        this.coinsText.color = "white";
        this.coinsText.fontSize = Math.round(16 * this.uiScale);
        this.coinsText.fontWeight = "bold";
        this.coinsText.textHorizontalAlignment = BABYLON.GUI.Control.HORIZONTAL_ALIGNMENT_LEFT;
        coinsContainer.addControl(this.coinsText);

        // Store base font size for animations
        this.baseCoinFontSize = Math.round(16 * this.uiScale);

        // Create horizontal stack for buttons
        this.menuPanel = new BABYLON.GUI.StackPanel();
        this.menuPanel.height = this.scaled(55);
        this.menuPanel.isVertical = false;
        this.menuPanel.horizontalAlignment = BABYLON.GUI.Control.HORIZONTAL_ALIGNMENT_CENTER;
        mainStack.addControl(this.menuPanel);
    }

    /**
     * Create spawn buttons
     */
    createButtons() {
        const buttonConfigs = [
            { text: "Egg", type: "egg" },
            { text: "Seed", type: "seed" }
        ];

        buttonConfigs.forEach(config => {
            const button = this.createButton(config.text, config.type);
            this.menuPanel.addControl(button);
        });

        // Create Building button with submenu toggle behavior
        const buildingButton = this.createBuildingMenuButton();
        this.menuPanel.addControl(buildingButton);

        // Create the building submenu (hidden initially)
        this.createBuildingSubmenu();
    }

    /**
     * Create a single button with click-to-select (desktop) or drag-to-place (mobile)
     */
    createButton(text, objectType) {
        const button = BABYLON.GUI.Button.CreateSimpleButton(`btn_${text}`, text);
        button.width = this.scaled(110);
        button.height = this.scaled(48);
        button.color = "white";
        button.background = "#3a3a4a";
        button.cornerRadius = Math.round(8 * this.uiScale);
        button.thickness = Math.round(2 * this.uiScale);
        button.fontSize = Math.round(15 * this.uiScale);
        button.fontWeight = "bold";
        button.paddingLeft = this.scaled(5);
        button.paddingRight = this.scaled(5);

        // Store button reference
        this.buttonMap[objectType] = button;

        if (this.isTouchDevice()) {
            // Mobile: drag-to-place
            button.onPointerDownObservable.add(() => {
                this.isDragging = true;
                this.dragObjectType = objectType;
                if (this.dragStartCallbacks[objectType]) {
                    this.dragStartCallbacks[objectType]();
                }
            });
        } else {
            // Desktop: click to toggle selection
            button.onPointerClickObservable.add(() => {
                this.toggleSelection(objectType, button);
            });
        }

        return button;
    }

    /**
     * Toggle selection of an object type
     */
    toggleSelection(objectType, button) {
        // If already selected, deselect
        if (this.selectedObjectType === objectType) {
            this.clearSelection();
            return;
        }

        // Clear any previous selection
        this.clearSelection();

        // Select this object type
        this.selectedObjectType = objectType;
        this.selectedButton = button;

        // Trigger select callback
        if (this.selectCallbacks[objectType]) {
            this.selectCallbacks[objectType]();
        }
    }

    /**
     * Clear current selection
     */
    clearSelection() {
        this.selectedObjectType = null;
        this.selectedButton = null;

        // Close building submenu if open
        if (this.isBuildingSubmenuOpen) {
            this.closeBuildingSubmenu();
        }
    }

    /**
     * Called when placement is complete - clears selection
     */
    onPlacementComplete() {
        this.clearSelection();
    }

    /**
     * Get currently selected object type
     */
    getSelectedObjectType() {
        return this.selectedObjectType;
    }

    /**
     * Create Building menu button (toggles submenu instead of hold behavior)
     */
    createBuildingMenuButton() {
        const button = BABYLON.GUI.Button.CreateSimpleButton("btn_Building", "Building");
        button.width = this.scaled(110);
        button.height = this.scaled(48);
        button.color = "white";
        button.background = "#3a3a4a";
        button.cornerRadius = Math.round(8 * this.uiScale);
        button.thickness = Math.round(2 * this.uiScale);
        button.fontSize = Math.round(15 * this.uiScale);
        button.fontWeight = "bold";
        button.paddingLeft = this.scaled(5);
        button.paddingRight = this.scaled(5);

        // Click toggles submenu
        button.onPointerClickObservable.add(() => {
            this.toggleBuildingSubmenu();
        });

        this.buildingButton = button;
        return button;
    }

    /**
     * Create building submenu panel
     */
    createBuildingSubmenu() {
        // Create submenu container - positioned to slide out from Building button
        const submenu = new BABYLON.GUI.Rectangle();
        submenu.width = this.scaled(110); // Match Building button width
        submenu.height = "0px"; // Start collapsed
        submenu.cornerRadius = Math.round(8 * this.uiScale);
        submenu.color = "white";
        submenu.thickness = Math.round(2 * this.uiScale);
        submenu.background = "rgba(30, 30, 45, 0.95)";
        submenu.horizontalAlignment = BABYLON.GUI.Control.HORIZONTAL_ALIGNMENT_CENTER;
        submenu.verticalAlignment = BABYLON.GUI.Control.VERTICAL_ALIGNMENT_TOP;
        // Position below main menu, aligned with Building button (rightmost)
        submenu.top = this.scaled(100);
        submenu.left = this.scaled(115); // Offset to align with Building button
        submenu.isVisible = false;
        submenu.clipChildren = true; // Clip content during animation
        this.advancedTexture.addControl(submenu);
        this.buildingSubmenu = submenu;

        // Create vertical stack for building options
        const stack = new BABYLON.GUI.StackPanel();
        stack.isVertical = true;
        stack.spacing = Math.round(4 * this.uiScale);
        stack.paddingTop = this.scaled(4);
        stack.paddingBottom = this.scaled(4);
        submenu.addControl(stack);
        this.buildingSubmenuStack = stack;

        // Building type buttons
        const buildingTypes = [
            { text: "Turret", type: "turret" },
            { text: "Armory", type: "armory" }
        ];

        buildingTypes.forEach(config => {
            const btn = this.createBuildingTypeButton(config.text, config.type);
            stack.addControl(btn);
        });

        this.submenuFullHeight = Math.round(100 * this.uiScale); // Height when fully expanded
    }

    /**
     * Create a building type button for the submenu
     */
    createBuildingTypeButton(text, buildingType) {
        const button = BABYLON.GUI.Button.CreateSimpleButton(`btn_${buildingType}`, text);
        button.width = this.scaled(95);
        button.height = this.scaled(40);
        button.color = "white";
        button.background = "#4a5a6a";
        button.cornerRadius = Math.round(6 * this.uiScale);
        button.thickness = Math.round(2 * this.uiScale);
        button.fontSize = Math.round(14 * this.uiScale);
        button.fontWeight = "bold";

        // Store button reference
        this.buttonMap[buildingType] = button;

        if (this.isTouchDevice()) {
            // Mobile: drag-to-place
            button.onPointerDownObservable.add(() => {
                this.isDragging = true;
                this.dragObjectType = buildingType;
                this.closeBuildingSubmenu();
                if (this.dragStartCallbacks[buildingType]) {
                    this.dragStartCallbacks[buildingType]();
                }
            });
        } else {
            // Desktop: click to select building type
            button.onPointerClickObservable.add(() => {
                this.toggleSelection(buildingType, button);
                // Close submenu after selecting (but placement mode stays active)
                this.closeBuildingSubmenu();
            });
        }

        return button;
    }

    /**
     * Toggle building submenu visibility
     */
    toggleBuildingSubmenu() {
        if (this.isBuildingSubmenuOpen) {
            this.closeBuildingSubmenu();
        } else {
            this.openBuildingSubmenu();
        }
    }

    /**
     * Open building submenu with vertical slide animation
     */
    openBuildingSubmenu() {
        if (!this.buildingSubmenu) return;

        this.isBuildingSubmenuOpen = true;
        this.buildingSubmenu.isVisible = true;
        this.buildingSubmenu.height = "0px";

        // Animate height expansion
        const animationDuration = 150; // ms
        const startTime = Date.now();
        const targetHeight = this.submenuFullHeight;

        const animate = () => {
            const elapsed = Date.now() - startTime;
            const progress = Math.min(elapsed / animationDuration, 1);

            // Ease out cubic
            const eased = 1 - Math.pow(1 - progress, 3);

            this.buildingSubmenu.height = (targetHeight * eased) + "px";

            if (progress < 1) {
                requestAnimationFrame(animate);
            }
        };

        requestAnimationFrame(animate);
    }

    /**
     * Close building submenu with vertical slide animation
     */
    closeBuildingSubmenu() {
        if (!this.buildingSubmenu) return;

        this.isBuildingSubmenuOpen = false;

        // Animate height collapse
        const animationDuration = 100; // ms
        const startTime = Date.now();
        const startHeight = this.submenuFullHeight;

        const animate = () => {
            const elapsed = Date.now() - startTime;
            const progress = Math.min(elapsed / animationDuration, 1);

            // Ease in cubic
            const eased = Math.pow(progress, 3);

            this.buildingSubmenu.height = (startHeight * (1 - eased)) + "px";

            if (progress < 1) {
                requestAnimationFrame(animate);
            } else {
                this.buildingSubmenu.isVisible = false;
            }
        };

        requestAnimationFrame(animate);
    }

    /**
     * Register select callback for a specific object type
     * Called when user clicks button to enter placement mode (desktop)
     */
    registerSelectCallback(objectType, callback) {
        this.selectCallbacks[objectType] = callback;
    }

    /**
     * Register drag start callback for mobile drag-to-place
     */
    registerDragStartCallback(objectType, callback) {
        this.dragStartCallbacks[objectType] = callback;
    }

    /**
     * Register drag end callback for mobile drag-to-place
     */
    registerDragEndCallback(objectType, callback) {
        this.dragEndCallbacks[objectType] = callback;
    }

    /**
     * Create debug panel in top right corner
     */
    createDebugPanel() {
        // Create background panel
        const panel = new BABYLON.GUI.Rectangle();
        panel.width = this.scaled(200);
        panel.height = this.scaled(140);
        panel.cornerRadius = Math.round(8 * this.uiScale);
        panel.color = "white";
        panel.thickness = Math.round(2 * this.uiScale);
        panel.background = "rgba(0, 0, 0, 0.7)";
        panel.horizontalAlignment = BABYLON.GUI.Control.HORIZONTAL_ALIGNMENT_RIGHT;
        panel.verticalAlignment = BABYLON.GUI.Control.VERTICAL_ALIGNMENT_TOP;
        panel.top = "0px";
        panel.left = "0px";
        this.advancedTexture.addControl(panel);
        this.debugPanel = panel;

        // Hide debug panel by default
        this.debugPanel.isVisible = false;

        // Create stack panel for contents
        const stack = new BABYLON.GUI.StackPanel();
        stack.isVertical = true;
        stack.spacing = Math.round(6 * this.uiScale);
        panel.addControl(stack);

        // Title
        const title = new BABYLON.GUI.TextBlock();
        title.text = "DEBUG";
        title.height = this.scaled(24);
        title.color = "yellow";
        title.fontSize = Math.round(14 * this.uiScale);
        title.fontWeight = "bold";
        stack.addControl(title);

        // Camera freeze toggle
        const cameraFreezeContainer = this.createCheckbox(
            "Freeze Camera",
            this.isCameraFrozen,
            (isChecked) => {
                this.isCameraFrozen = isChecked;
                if (this.cameraFreezeCallback) {
                    this.cameraFreezeCallback(isChecked);
                }
            }
        );
        stack.addControl(cameraFreezeContainer);

        // Drop Bubby button
        const dropBubbyBtn = this.createDebugButton("Drop Bubby", () => {
            if (this.onDropBubbyCallback) {
                this.onDropBubbyCallback();
            }
        });
        stack.addControl(dropBubbyBtn);

        // Drop Soldier button (bubby with sword)
        const dropSoldierBtn = this.createDebugButton("Drop Soldier", () => {
            if (this.onDropSoldierCallback) {
                this.onDropSoldierCallback();
            }
        });
        stack.addControl(dropSoldierBtn);
    }

    /**
     * Create a debug button
     */
    createDebugButton(labelText, onClickCallback) {
        const button = BABYLON.GUI.Button.CreateSimpleButton("debugBtn_" + labelText, labelText);
        button.width = this.scaled(160);
        button.height = this.scaled(28);
        button.color = "white";
        button.background = "#444444";
        button.cornerRadius = Math.round(4 * this.uiScale);
        button.fontSize = Math.round(12 * this.uiScale);
        button.onPointerClickObservable.add(() => {
            if (onClickCallback) {
                onClickCallback();
            }
        });
        button.onPointerEnterObservable.add(() => {
            button.background = "#666666";
        });
        button.onPointerOutObservable.add(() => {
            button.background = "#444444";
        });
        return button;
    }

    /**
     * Set callback for Drop Bubby debug button
     */
    setOnDropBubbyCallback(callback) {
        this.onDropBubbyCallback = callback;
    }

    /**
     * Set callback for Drop Soldier debug button
     */
    setOnDropSoldierCallback(callback) {
        this.onDropSoldierCallback = callback;
    }

    /**
     * Create a checkbox with label
     */
    createCheckbox(labelText, initialValue, onChangeCallback) {
        // Container
        const container = new BABYLON.GUI.StackPanel();
        container.height = this.scaled(30);
        container.isVertical = false;
        container.horizontalAlignment = BABYLON.GUI.Control.HORIZONTAL_ALIGNMENT_LEFT;
        container.paddingLeft = this.scaled(15);

        // Checkbox
        const checkbox = new BABYLON.GUI.Checkbox();
        checkbox.width = this.scaled(18);
        checkbox.height = this.scaled(18);
        checkbox.isChecked = initialValue;
        checkbox.color = "white";
        checkbox.background = "#333333";
        checkbox.onIsCheckedChangedObservable.add((value) => {
            if (onChangeCallback) {
                onChangeCallback(value);
            }
        });
        container.addControl(checkbox);

        // Label
        const label = new BABYLON.GUI.TextBlock();
        label.text = labelText;
        label.width = this.scaled(120);
        label.height = this.scaled(18);
        label.color = "white";
        label.fontSize = Math.round(12 * this.uiScale);
        label.textHorizontalAlignment = BABYLON.GUI.Control.HORIZONTAL_ALIGNMENT_LEFT;
        label.paddingLeft = this.scaled(8);
        container.addControl(label);

        return container;
    }

    /**
     * Register camera freeze callback
     */
    registerCameraFreezeCallback(callback) {
        this.cameraFreezeCallback = callback;
        // Call immediately with current state
        if (callback) {
            callback(this.isCameraFrozen);
        }
    }

    /**
     * Get current coins
     */
    getCoins() {
        return this.coins;
    }

    /**
     * Set coins amount
     */
    setCoins(amount) {
        this.coins = Math.max(0, amount); // Can't go below 0
        if (this.coinsText) {
            this.coinsText.text = this.coins.toString();
        }
    }

    /**
     * Add coins with animation effect
     */
    addCoins(amount) {
        this.setCoins(this.coins + amount);
        this.animateCoinIncrement();
    }

    /**
     * Animate coin counter when coins are added
     */
    animateCoinIncrement() {
        if (!this.coinsText) {
            return;
        }

        // Scale up and back animation
        const originalFontSize = this.baseCoinFontSize;
        const animatedFontSize = Math.round(this.baseCoinFontSize * 1.4);

        this.coinsText.fontSize = animatedFontSize;
        this.coinsText.color = "yellow";

        // Reset after short delay
        setTimeout(() => {
            if (this.coinsText) {
                this.coinsText.fontSize = originalFontSize;
                this.coinsText.color = "white";
            }
        }, 200);
    }

    /**
     * Subtract coins (returns true if successful, false if not enough coins)
     */
    subtractCoins(amount) {
        if (this.coins >= amount) {
            this.setCoins(this.coins - amount);
            return true;
        }
        return false;
    }

    /**
     * Get screen center X position
     */
    getScreenCenterX() {
        return this.canvas.width / 2;
    }

    /**
     * Get coin counter screen position for animation target
     */
    getCoinCounterScreenPosition() {
        // Coin counter is in the top-center menu
        // Return approximate position of the coins text
        return {
            x: this.canvas.width / 2 + 40, // Slightly right of center
            y: 50 // Near top
        };
    }

    /**
     * Check if device supports touch
     */
    isTouchDevice() {
        return 'ontouchstart' in window || navigator.maxTouchPoints > 0;
    }

    /**
     * Create mobile camera control buttons (only on touch devices)
     */
    createMobileControls() {
        if (!this.isTouchDevice()) return;

        // Arrow button size - keep reasonable for touch targets
        const btnSize = this.scaled(70);
        const margin = this.scaled(15);
        const fontSize = Math.round(28 * this.uiScale);

        // Left arrow button
        const leftBtn = BABYLON.GUI.Button.CreateSimpleButton("leftArrow", "◄");
        leftBtn.width = btnSize;
        leftBtn.height = btnSize;
        leftBtn.color = "white";
        leftBtn.background = "rgba(60, 60, 70, 0.5)";
        leftBtn.cornerRadius = Math.round(12 * this.uiScale);
        leftBtn.thickness = Math.round(2 * this.uiScale);
        leftBtn.fontSize = fontSize;
        leftBtn.horizontalAlignment = BABYLON.GUI.Control.HORIZONTAL_ALIGNMENT_LEFT;
        leftBtn.verticalAlignment = BABYLON.GUI.Control.VERTICAL_ALIGNMENT_BOTTOM;
        leftBtn.left = margin;
        leftBtn.top = "-" + margin;
        this.advancedTexture.addControl(leftBtn);

        // Hold to pan left
        leftBtn.onPointerDownObservable.add(() => {
            this.panningLeft = true;
        });
        leftBtn.onPointerUpObservable.add(() => {
            this.panningLeft = false;
        });
        leftBtn.onPointerOutObservable.add(() => {
            this.panningLeft = false;
        });

        // Right arrow button
        const rightBtn = BABYLON.GUI.Button.CreateSimpleButton("rightArrow", "►");
        rightBtn.width = btnSize;
        rightBtn.height = btnSize;
        rightBtn.color = "white";
        rightBtn.background = "rgba(60, 60, 70, 0.5)";
        rightBtn.cornerRadius = Math.round(12 * this.uiScale);
        rightBtn.thickness = Math.round(2 * this.uiScale);
        rightBtn.fontSize = fontSize;
        rightBtn.horizontalAlignment = BABYLON.GUI.Control.HORIZONTAL_ALIGNMENT_RIGHT;
        rightBtn.verticalAlignment = BABYLON.GUI.Control.VERTICAL_ALIGNMENT_BOTTOM;
        rightBtn.left = "-" + margin;
        rightBtn.top = "-" + margin;
        this.advancedTexture.addControl(rightBtn);

        // Hold to pan right
        rightBtn.onPointerDownObservable.add(() => {
            this.panningRight = true;
        });
        rightBtn.onPointerUpObservable.add(() => {
            this.panningRight = false;
        });
        rightBtn.onPointerOutObservable.add(() => {
            this.panningRight = false;
        });
    }

    /**
     * Get current panning direction (called by CameraController)
     * Returns -1 for left, 1 for right, 0 for none
     */
    getPanDirection() {
        if (this.panningLeft) return -1;
        if (this.panningRight) return 1;
        return 0;
    }

    /**
     * Setup keyboard shortcuts
     */
    setupKeyboardShortcuts() {
        this.keydownHandler = (event) => {
            if (event.key === 'F1') {
                event.preventDefault(); // Prevent browser help
                this.toggleDebugPanel();
            }
        };
        window.addEventListener('keydown', this.keydownHandler);
    }

    /**
     * Toggle debug panel visibility
     */
    toggleDebugPanel() {
        if (this.debugPanel) {
            this.debugPanel.isVisible = !this.debugPanel.isVisible;
        }
    }

    // ==========================================
    // BILLBOARD MENU SYSTEM
    // ==========================================

    /**
     * Show HQ build menu as a 3D billboard above the castle
     */
    showHQBuildMenu(castle, onSellFruit) {
        // Close any existing billboard
        this.closeBillboard();

        const castlePos = castle.getPosition();

        // Create a plane mesh for the billboard (larger size)
        this.billboardPlane = BABYLON.MeshBuilder.CreatePlane(
            "hqBillboard",
            { width: 12, height: 8 },
            this.scene
        );

        // Position above the castle
        this.billboardPlane.position = new BABYLON.Vector3(
            castlePos.x,
            castlePos.y + 18, // Above the castle
            castlePos.z
        );

        // Billboard mode - always face camera
        this.billboardPlane.billboardMode = BABYLON.Mesh.BILLBOARDMODE_ALL;

        // Create texture for the billboard GUI (higher resolution)
        this.billboardTexture = BABYLON.GUI.AdvancedDynamicTexture.CreateForMesh(
            this.billboardPlane,
            1024,
            768,
            false
        );

        // Setup click-off-to-close behavior
        this.setupBillboardClickOff();

        // Calculate billboard font scale based on display
        const billboardScale = this.calculateBillboardScale();

        // Create background container
        const background = new BABYLON.GUI.Rectangle("billboardBg");
        background.width = "100%";
        background.height = "100%";
        background.cornerRadius = 30;
        background.color = "white";
        background.thickness = 6;
        background.background = "rgba(30, 30, 45, 0.95)";
        this.billboardTexture.addControl(background);

        // Create stack for content
        const stack = new BABYLON.GUI.StackPanel();
        stack.isVertical = true;
        stack.spacing = Math.round(25 * billboardScale);
        background.addControl(stack);

        // Title
        const title = new BABYLON.GUI.TextBlock();
        title.text = "HQ Menu";
        title.height = Math.round(100 * billboardScale) + "px";
        title.color = "gold";
        title.fontSize = Math.round(72 * billboardScale);
        title.fontWeight = "bold";
        stack.addControl(title);

        // Resource inventory row
        const resourceRow = new BABYLON.GUI.StackPanel();
        resourceRow.isVertical = false;
        resourceRow.height = Math.round(70 * billboardScale) + "px";
        resourceRow.spacing = Math.round(30 * billboardScale);
        stack.addControl(resourceRow);

        // Fruit count
        this.fruitInventoryText = new BABYLON.GUI.TextBlock();
        this.fruitInventoryText.text = `Fruit: ${castle.getFruitCount()}`;
        this.fruitInventoryText.width = Math.round(200 * billboardScale) + "px";
        this.fruitInventoryText.color = "#ff6b6b";
        this.fruitInventoryText.fontSize = Math.round(44 * billboardScale);
        resourceRow.addControl(this.fruitInventoryText);

        // Wood count
        this.hqWoodText = new BABYLON.GUI.TextBlock();
        this.hqWoodText.text = `Wood: ${castle.getWoodCount()}`;
        this.hqWoodText.width = Math.round(200 * billboardScale) + "px";
        this.hqWoodText.color = "#8B4513";
        this.hqWoodText.fontSize = Math.round(44 * billboardScale);
        resourceRow.addControl(this.hqWoodText);

        // Stone count
        this.hqStoneText = new BABYLON.GUI.TextBlock();
        this.hqStoneText.text = `Stone: ${castle.getStoneCount()}`;
        this.hqStoneText.width = Math.round(200 * billboardScale) + "px";
        this.hqStoneText.color = "#808080";
        this.hqStoneText.fontSize = Math.round(44 * billboardScale);
        resourceRow.addControl(this.hqStoneText);

        // Sell Fruit button
        const sellButton = BABYLON.GUI.Button.CreateSimpleButton("sellFruitBtn", "Sell Fruit (+1 coin)");
        sellButton.width = Math.round(700 * billboardScale) + "px";
        sellButton.height = Math.round(120 * billboardScale) + "px";
        sellButton.color = "white";
        sellButton.background = castle.getFruitCount() > 0 ? "#4a7a4a" : "#555555";
        sellButton.cornerRadius = Math.round(20 * billboardScale);
        sellButton.thickness = Math.round(4 * billboardScale);
        sellButton.fontSize = Math.round(48 * billboardScale);
        sellButton.fontWeight = "bold";
        stack.addControl(sellButton);

        // Store reference for updating
        this.sellButton = sellButton;
        this.currentCastle = castle;
        this.onSellFruitCallback = onSellFruit;

        sellButton.onPointerClickObservable.add(() => {
            if (castle.getFruitCount() > 0 && onSellFruit) {
                onSellFruit(castle);
                this.updateFruitInventoryDisplay(castle);
            }
        });

        // Close button
        const closeButton = BABYLON.GUI.Button.CreateSimpleButton("closeBtn", "Close");
        closeButton.width = Math.round(300 * billboardScale) + "px";
        closeButton.height = Math.round(90 * billboardScale) + "px";
        closeButton.color = "white";
        closeButton.background = "#5a5a6a";
        closeButton.cornerRadius = Math.round(15 * billboardScale);
        closeButton.thickness = Math.round(4 * billboardScale);
        closeButton.fontSize = Math.round(44 * billboardScale);
        stack.addControl(closeButton);

        closeButton.onPointerClickObservable.add(() => {
            this.closeBillboard();
        });

        // Store modal state
        this.isModalOpen = true;
    }

    /**
     * Calculate billboard scale based on display size
     * Ensures readable text on all devices
     */
    calculateBillboardScale() {
        const width = window.innerWidth;
        const height = window.innerHeight;
        const minDimension = Math.min(width, height);

        // Scale up for smaller screens (mobile needs bigger UI in 3D space)
        if (minDimension < 500) {
            return 1.4; // Mobile - larger text
        } else if (minDimension < 800) {
            return 1.2; // Tablet
        } else if (minDimension < 1200) {
            return 1.0; // Small desktop
        }
        return 0.9; // Large desktop
    }

    /**
     * Update resource inventory display in billboard (fruit, wood, stone)
     */
    updateFruitInventoryDisplay(castle) {
        if (this.fruitInventoryText) {
            this.fruitInventoryText.text = `Fruit: ${castle.getFruitCount()}`;
        }
        if (this.hqWoodText) {
            this.hqWoodText.text = `Wood: ${castle.getWoodCount()}`;
        }
        if (this.hqStoneText) {
            this.hqStoneText.text = `Stone: ${castle.getStoneCount()}`;
        }
        if (this.sellButton) {
            this.sellButton.background = castle.getFruitCount() > 0 ? "#4a7a4a" : "#555555";
        }
    }

    /**
     * Notify that resources were deposited - updates billboard if open for that castle
     */
    onResourceDeposited(castle) {
        if (this.isModalOpen && this.currentCastle === castle) {
            this.updateFruitInventoryDisplay(castle);
        }
    }

    /**
     * Setup click-off-to-close behavior for billboard
     */
    setupBillboardClickOff() {
        // Small delay to prevent immediate close from the same click that opened it
        setTimeout(() => {
            this.billboardClickObserver = this.scene.onPointerObservable.add((pointerInfo) => {
                if (pointerInfo.type === BABYLON.PointerEventTypes.POINTERDOWN) {
                    // Check if click was on the billboard plane
                    const pickResult = this.scene.pick(
                        pointerInfo.event.clientX,
                        pointerInfo.event.clientY
                    );

                    // If clicked on something that's not the billboard, close it
                    if (!pickResult.hit || pickResult.pickedMesh !== this.billboardPlane) {
                        this.closeBillboard();
                    }
                }
            });
        }, 100);
    }

    /**
     * Close any open billboard menu
     */
    closeBillboard() {
        // Remove click observer
        if (this.billboardClickObserver) {
            this.scene.onPointerObservable.remove(this.billboardClickObserver);
            this.billboardClickObserver = null;
        }
        if (this.billboardTexture) {
            this.billboardTexture.dispose();
            this.billboardTexture = null;
        }
        if (this.billboardPlane) {
            this.billboardPlane.dispose();
            this.billboardPlane = null;
        }
        this.fruitInventoryText = null;
        this.sellButton = null;
        this.currentCastle = null;
        this.onSellFruitCallback = null;
        this.isModalOpen = false;
    }

    /**
     * Close any open modal (alias for closeBillboard for compatibility)
     */
    closeModal() {
        this.closeBillboard();
    }

    /**
     * Check if a modal is currently open
     */
    isModalVisible() {
        return this.isModalOpen || false;
    }

    // ==========================================
    // ARMORY MENU
    // ==========================================

    /**
     * Show Armory build menu as a 3D billboard above the armory
     */
    showArmoryBuildMenu(armory, castle, onCraftSword) {
        // Close any existing billboard
        this.closeBillboard();

        const armoryPos = armory.getPosition();

        // Create a plane mesh for the billboard
        this.billboardPlane = BABYLON.MeshBuilder.CreatePlane(
            "armoryBillboard",
            { width: 14, height: 10 },
            this.scene
        );

        // Position above the armory
        this.billboardPlane.position = new BABYLON.Vector3(
            armoryPos.x,
            armoryPos.y + 12,
            armoryPos.z
        );

        // Billboard mode - always face camera
        this.billboardPlane.billboardMode = BABYLON.Mesh.BILLBOARDMODE_ALL;

        // Create texture for the billboard GUI
        this.billboardTexture = BABYLON.GUI.AdvancedDynamicTexture.CreateForMesh(
            this.billboardPlane,
            1024,
            768,
            false
        );

        // Setup click-off-to-close behavior
        this.setupBillboardClickOff();

        // Calculate billboard font scale based on display
        const billboardScale = this.calculateBillboardScale();

        // Create background container
        const background = new BABYLON.GUI.Rectangle("billboardBg");
        background.width = "100%";
        background.height = "100%";
        background.cornerRadius = 30;
        background.color = "white";
        background.thickness = 6;
        background.background = "rgba(40, 30, 20, 0.95)";
        this.billboardTexture.addControl(background);

        // Create stack for content
        const stack = new BABYLON.GUI.StackPanel();
        stack.isVertical = true;
        stack.spacing = Math.round(20 * billboardScale);
        background.addControl(stack);

        // Title
        const title = new BABYLON.GUI.TextBlock();
        title.text = "Armory";
        title.height = Math.round(90 * billboardScale) + "px";
        title.color = "#FFD700";
        title.fontSize = Math.round(68 * billboardScale);
        title.fontWeight = "bold";
        stack.addControl(title);

        // Equipment inventory display
        this.armorySwordText = new BABYLON.GUI.TextBlock();
        this.armorySwordText.text = `Swords: ${armory.getSwordCount()}  Armor: ${armory.getArmorCount()}`;
        this.armorySwordText.height = Math.round(70 * billboardScale) + "px";
        this.armorySwordText.color = "#C0C0C0";
        this.armorySwordText.fontSize = Math.round(52 * billboardScale);
        stack.addControl(this.armorySwordText);

        // Resource display
        const resourceRow = new BABYLON.GUI.StackPanel();
        resourceRow.isVertical = false;
        resourceRow.height = Math.round(60 * billboardScale) + "px";
        resourceRow.horizontalAlignment = BABYLON.GUI.Control.HORIZONTAL_ALIGNMENT_CENTER;
        stack.addControl(resourceRow);

        const woodText = new BABYLON.GUI.TextBlock();
        woodText.text = `Wood: ${castle.getWoodCount()}`;
        woodText.width = Math.round(250 * billboardScale) + "px";
        woodText.color = "#8B4513";
        woodText.fontSize = Math.round(44 * billboardScale);
        resourceRow.addControl(woodText);
        this.armoryWoodText = woodText;

        const stoneText = new BABYLON.GUI.TextBlock();
        stoneText.text = `Stone: ${castle.getStoneCount()}`;
        stoneText.width = Math.round(250 * billboardScale) + "px";
        stoneText.color = "#808080";
        stoneText.fontSize = Math.round(44 * billboardScale);
        resourceRow.addControl(stoneText);
        this.armoryStoneText = stoneText;

        // Craft Sword button
        const swordCost = armory.getSwordCost();
        const canCraft = castle.getWoodCount() >= swordCost.wood && castle.getStoneCount() >= swordCost.stone;

        const craftButton = BABYLON.GUI.Button.CreateSimpleButton(
            "craftSwordBtn",
            `Craft Sword (${swordCost.wood} wood, ${swordCost.stone} stone)`
        );
        craftButton.width = Math.round(750 * billboardScale) + "px";
        craftButton.height = Math.round(110 * billboardScale) + "px";
        craftButton.color = "white";
        craftButton.background = canCraft ? "#4a6a8a" : "#555555";
        craftButton.cornerRadius = Math.round(20 * billboardScale);
        craftButton.thickness = Math.round(4 * billboardScale);
        craftButton.fontSize = Math.round(42 * billboardScale);
        craftButton.fontWeight = "bold";
        stack.addControl(craftButton);

        this.craftSwordButton = craftButton;
        this.currentArmory = armory;
        this.currentCastle = castle;
        this.onCraftSwordCallback = onCraftSword;

        craftButton.onPointerClickObservable.add(() => {
            if (armory.canCraftSword()) {
                if (armory.craftSword()) {
                    this.updateArmoryDisplay(armory, castle);
                    if (onCraftSword) {
                        onCraftSword(armory);
                    }
                }
            }
        });

        // Craft Armor button
        const armorCost = armory.getArmorCost();
        const canCraftArmor = castle.getWoodCount() >= armorCost.wood && castle.getStoneCount() >= armorCost.stone;

        const craftArmorButton = BABYLON.GUI.Button.CreateSimpleButton(
            "craftArmorBtn",
            `Craft Armor (${armorCost.wood} wood, ${armorCost.stone} stone)`
        );
        craftArmorButton.width = Math.round(750 * billboardScale) + "px";
        craftArmorButton.height = Math.round(110 * billboardScale) + "px";
        craftArmorButton.color = "white";
        craftArmorButton.background = canCraftArmor ? "#6a5a4a" : "#555555";
        craftArmorButton.cornerRadius = Math.round(20 * billboardScale);
        craftArmorButton.thickness = Math.round(4 * billboardScale);
        craftArmorButton.fontSize = Math.round(42 * billboardScale);
        craftArmorButton.fontWeight = "bold";
        stack.addControl(craftArmorButton);

        this.craftArmorButton = craftArmorButton;

        craftArmorButton.onPointerClickObservable.add(() => {
            if (armory.canCraftArmor()) {
                if (armory.craftArmor()) {
                    this.updateArmoryDisplay(armory, castle);
                }
            }
        });

        // Close button
        const closeButton = BABYLON.GUI.Button.CreateSimpleButton("closeBtn", "Close");
        closeButton.width = Math.round(280 * billboardScale) + "px";
        closeButton.height = Math.round(80 * billboardScale) + "px";
        closeButton.color = "white";
        closeButton.background = "#5a5a6a";
        closeButton.cornerRadius = Math.round(15 * billboardScale);
        closeButton.thickness = Math.round(4 * billboardScale);
        closeButton.fontSize = Math.round(40 * billboardScale);
        stack.addControl(closeButton);

        closeButton.onPointerClickObservable.add(() => {
            this.closeBillboard();
        });

        // Store modal state
        this.isModalOpen = true;
    }

    /**
     * Update armory display (sword count, armor count, resources, button states)
     */
    updateArmoryDisplay(armory, castle) {
        if (this.armorySwordText) {
            this.armorySwordText.text = `Swords: ${armory.getSwordCount()}  Armor: ${armory.getArmorCount()}`;
        }
        if (this.armoryWoodText) {
            this.armoryWoodText.text = `Wood: ${castle.getWoodCount()}`;
        }
        if (this.armoryStoneText) {
            this.armoryStoneText.text = `Stone: ${castle.getStoneCount()}`;
        }
        if (this.craftSwordButton) {
            const canCraft = armory.canCraftSword();
            this.craftSwordButton.background = canCraft ? "#4a6a8a" : "#555555";
        }
        if (this.craftArmorButton) {
            const canCraftArmor = armory.canCraftArmor();
            this.craftArmorButton.background = canCraftArmor ? "#6a5a4a" : "#555555";
        }
    }

    /**
     * Dispose UI and clean up
     */
    dispose() {
        this.closeModal();
        if (this.keydownHandler) {
            window.removeEventListener('keydown', this.keydownHandler);
        }
        if (this.advancedTexture) {
            this.advancedTexture.dispose();
        }
    }
}