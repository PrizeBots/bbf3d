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
        this.cameraFreezeCallback = null;
        this.isCameraFrozen = true; // Default: camera is frozen

        // Selection state
        this.selectedObjectType = null;
        this.selectedButton = null;
        this.buttonMap = {}; // Map of objectType -> button

        // Submenu state
        this.buildingSubmenu = null;
        this.isBuildingSubmenuOpen = false;

        this.initialize();
    }

    /**
     * Initialize UI system
     */
    initialize() {
        this.advancedTexture = BABYLON.GUI.AdvancedDynamicTexture.CreateFullscreenUI("UI");
        this.createMenuPanel();
        this.createButtons();
        this.createDebugPanel();
    }

    /**
     * Create main menu panel at top center
     */
    createMenuPanel() {
        // Create background container
        const container = new BABYLON.GUI.Rectangle();
        container.width = "480px";
        container.height = "120px";
        container.cornerRadius = 15;
        container.color = "white";
        container.thickness = 3;
        container.background = "rgba(20, 20, 30, 0.85)";
        container.horizontalAlignment = BABYLON.GUI.Control.HORIZONTAL_ALIGNMENT_CENTER;
        container.verticalAlignment = BABYLON.GUI.Control.VERTICAL_ALIGNMENT_TOP;
        container.top = "0px";
        this.advancedTexture.addControl(container);
        this.menuContainer = container;

        // Create vertical stack for coins + buttons
        const mainStack = new BABYLON.GUI.StackPanel();
        mainStack.isVertical = true;
        mainStack.spacing = 10;
        container.addControl(mainStack);

        // Create coins display at top
        const coinsContainer = new BABYLON.GUI.StackPanel();
        coinsContainer.height = "30px";
        coinsContainer.isVertical = false;
        coinsContainer.horizontalAlignment = BABYLON.GUI.Control.HORIZONTAL_ALIGNMENT_LEFT;
        coinsContainer.paddingLeft = "20px";
        mainStack.addControl(coinsContainer);

        // Coins label
        const coinsLabel = new BABYLON.GUI.TextBlock();
        coinsLabel.text = "Coins:";
        coinsLabel.width = "80px";
        coinsLabel.height = "30px";
        coinsLabel.color = "gold";
        coinsLabel.fontSize = 20;
        coinsLabel.fontWeight = "bold";
        coinsLabel.textHorizontalAlignment = BABYLON.GUI.Control.HORIZONTAL_ALIGNMENT_LEFT;
        coinsContainer.addControl(coinsLabel);

        // Coins counter
        this.coinsText = new BABYLON.GUI.TextBlock();
        this.coinsText.text = this.coins.toString();
        this.coinsText.width = "100px";
        this.coinsText.height = "30px";
        this.coinsText.color = "white";
        this.coinsText.fontSize = 20;
        this.coinsText.fontWeight = "bold";
        this.coinsText.textHorizontalAlignment = BABYLON.GUI.Control.HORIZONTAL_ALIGNMENT_LEFT;
        coinsContainer.addControl(this.coinsText);

        // Create horizontal stack for buttons
        this.menuPanel = new BABYLON.GUI.StackPanel();
        this.menuPanel.height = "70px";
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
     * Create a single button with click-to-select support
     */
    createButton(text, objectType) {
        const button = BABYLON.GUI.Button.CreateSimpleButton(`btn_${text}`, text);
        button.width = "130px";
        button.height = "60px";
        button.color = "white";
        button.background = "#3a3a4a";
        button.cornerRadius = 10;
        button.thickness = 2;
        button.fontSize = 18;
        button.fontWeight = "bold";
        button.paddingLeft = "8px";
        button.paddingRight = "8px";

        // Store button reference
        this.buttonMap[objectType] = button;

        // Hover effects
        button.onPointerEnterObservable.add(() => {
            if (this.selectedObjectType !== objectType) {
                button.background = "#4a4a5a";
            }
        });

        button.onPointerOutObservable.add(() => {
            if (this.selectedObjectType !== objectType) {
                button.background = "#3a3a4a";
            }
        });

        // Click to toggle selection
        button.onPointerClickObservable.add(() => {
            this.toggleSelection(objectType, button);
        });

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
        button.background = "#5a7a9a";
        button.thickness = 3;

        // Trigger select callback
        if (this.selectCallbacks[objectType]) {
            this.selectCallbacks[objectType]();
        }
    }

    /**
     * Clear current selection
     */
    clearSelection() {
        if (this.selectedButton) {
            this.selectedButton.background = "#3a3a4a";
            this.selectedButton.thickness = 2;
        }
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
        button.width = "130px";
        button.height = "60px";
        button.color = "white";
        button.background = "#3a3a4a";
        button.cornerRadius = 10;
        button.thickness = 2;
        button.fontSize = 18;
        button.fontWeight = "bold";
        button.paddingLeft = "8px";
        button.paddingRight = "8px";

        // Hover effects
        button.onPointerEnterObservable.add(() => {
            if (!this.isBuildingSubmenuOpen) {
                button.background = "#4a4a5a";
            }
        });

        button.onPointerOutObservable.add(() => {
            if (!this.isBuildingSubmenuOpen) {
                button.background = "#3a3a4a";
            }
        });

        // Click toggles submenu
        button.onPointerClickObservable.add(() => {
            this.toggleBuildingSubmenu();
            button.background = this.isBuildingSubmenuOpen ? "#5a7a9a" : "#3a3a4a";
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
        submenu.width = "130px"; // Match Building button width
        submenu.height = "0px"; // Start collapsed
        submenu.cornerRadius = 10;
        submenu.color = "white";
        submenu.thickness = 2;
        submenu.background = "rgba(30, 30, 45, 0.95)";
        submenu.horizontalAlignment = BABYLON.GUI.Control.HORIZONTAL_ALIGNMENT_CENTER;
        submenu.verticalAlignment = BABYLON.GUI.Control.VERTICAL_ALIGNMENT_TOP;
        // Position below main menu, aligned with Building button (rightmost)
        submenu.top = "120px";
        submenu.left = "138px"; // Offset to align with Building button
        submenu.isVisible = false;
        submenu.clipChildren = true; // Clip content during animation
        this.advancedTexture.addControl(submenu);
        this.buildingSubmenu = submenu;

        // Create vertical stack for building options
        const stack = new BABYLON.GUI.StackPanel();
        stack.isVertical = true;
        stack.spacing = 5;
        stack.paddingTop = "5px";
        stack.paddingBottom = "5px";
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

        this.submenuFullHeight = 120; // Height when fully expanded
    }

    /**
     * Create a building type button for the submenu
     */
    createBuildingTypeButton(text, buildingType) {
        const button = BABYLON.GUI.Button.CreateSimpleButton(`btn_${buildingType}`, text);
        button.width = "110px";
        button.height = "50px";
        button.color = "white";
        button.background = "#4a5a6a";
        button.cornerRadius = 8;
        button.thickness = 2;
        button.fontSize = 16;
        button.fontWeight = "bold";

        // Store button reference
        this.buttonMap[buildingType] = button;

        // Hover effects
        button.onPointerEnterObservable.add(() => {
            if (this.selectedObjectType !== buildingType) {
                button.background = "#5a6a7a";
            }
        });

        button.onPointerOutObservable.add(() => {
            if (this.selectedObjectType !== buildingType) {
                button.background = "#4a5a6a";
            }
        });

        // Click to select building type
        button.onPointerClickObservable.add(() => {
            this.toggleSelection(buildingType, button);
            // Close submenu after selecting (but placement mode stays active)
            this.closeBuildingSubmenu();
        });

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

        if (this.buildingButton) {
            this.buildingButton.background = "#3a3a4a";
        }

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
     * Called when user clicks button to enter placement mode
     */
    registerSelectCallback(objectType, callback) {
        this.selectCallbacks[objectType] = callback;
    }

    /**
     * Create debug panel in top right corner
     */
    createDebugPanel() {
        // Create background panel
        const panel = new BABYLON.GUI.Rectangle();
        panel.width = "250px";
        panel.height = "150px";
        panel.cornerRadius = 10;
        panel.color = "white";
        panel.thickness = 2;
        panel.background = "rgba(0, 0, 0, 0.7)";
        panel.horizontalAlignment = BABYLON.GUI.Control.HORIZONTAL_ALIGNMENT_RIGHT;
        panel.verticalAlignment = BABYLON.GUI.Control.VERTICAL_ALIGNMENT_TOP;
        panel.top = "0px";
        panel.left = "0px";
        this.advancedTexture.addControl(panel);
        this.debugPanel = panel;

        // Create stack panel for contents
        const stack = new BABYLON.GUI.StackPanel();
        stack.isVertical = true;
        stack.spacing = 10;
        panel.addControl(stack);

        // Title
        const title = new BABYLON.GUI.TextBlock();
        title.text = "DEBUG PANEL";
        title.height = "30px";
        title.color = "yellow";
        title.fontSize = 18;
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
    }

    /**
     * Create a checkbox with label
     */
    createCheckbox(labelText, initialValue, onChangeCallback) {
        // Container
        const container = new BABYLON.GUI.StackPanel();
        container.height = "40px";
        container.isVertical = false;
        container.horizontalAlignment = BABYLON.GUI.Control.HORIZONTAL_ALIGNMENT_LEFT;
        container.paddingLeft = "20px";

        // Checkbox
        const checkbox = new BABYLON.GUI.Checkbox();
        checkbox.width = "20px";
        checkbox.height = "20px";
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
        label.width = "150px";
        label.height = "20px";
        label.color = "white";
        label.fontSize = 14;
        label.textHorizontalAlignment = BABYLON.GUI.Control.HORIZONTAL_ALIGNMENT_LEFT;
        label.paddingLeft = "10px";
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
        const originalFontSize = 20;
        const scaledFontSize = 28;

        this.coinsText.fontSize = scaledFontSize;
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
     * Dispose UI and clean up
     */
    dispose() {
        if (this.advancedTexture) {
            this.advancedTexture.dispose();
        }
    }
}