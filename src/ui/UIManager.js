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

        // UI scaling - recalculate on resize
        this.uiScale = this.calculateUIScale();

        // Color scheme for consistent styling
        this.colors = {
            panelBg: "rgba(15, 20, 35, 0.92)",
            panelBorder: "rgba(100, 140, 200, 0.6)",
            buttonBg: "linear-gradient(180deg, #3a4a6a 0%, #2a3a5a 100%)",
            buttonBgFlat: "#3a4a6a",
            buttonHover: "#4a5a7a",
            buttonActive: "#5a7a9a",
            buttonDisabled: "#2a2a3a",
            accent: "#4a9eff",
            gold: "#ffd700",
            textPrimary: "#ffffff",
            textSecondary: "#a0b0c0",
            success: "#4a8a4a",
            danger: "#8a4a4a"
        };

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
        const dpr = window.devicePixelRatio || 1;

        // Account for device pixel ratio for sharper text
        let scale = 1.0;

        if (minDimension < 400) {
            scale = 0.65;
        } else if (minDimension < 500) {
            scale = 0.75;
        } else if (minDimension < 700) {
            scale = 0.85;
        } else if (minDimension < 900) {
            scale = 0.92;
        } else if (minDimension < 1200) {
            scale = 1.0;
        } else {
            scale = 1.1; // Larger screens get bigger UI
        }

        return scale;
    }

    /**
     * Get scaled size as string with px
     */
    scaled(baseSize) {
        return Math.round(baseSize * this.uiScale) + "px";
    }

    /**
     * Get scaled number (without px suffix)
     */
    scaledNum(baseSize) {
        return Math.round(baseSize * this.uiScale);
    }

    /**
     * Initialize UI system
     */
    initialize() {
        this.advancedTexture = BABYLON.GUI.AdvancedDynamicTexture.CreateFullscreenUI("UI");
        this.advancedTexture.idealWidth = 1920; // Reference width for scaling
        this.advancedTexture.renderAtIdealSize = true;

        this.createMenuPanel();
        this.createButtons();
        this.createDebugPanel();
        this.createMobileControls();
        this.setupMobileDragRelease();
        this.setupKeyboardShortcuts();
        this.setupResizeHandler();
    }

    /**
     * Setup window resize handler to recalculate UI scale
     */
    setupResizeHandler() {
        this.resizeHandler = () => {
            this.uiScale = this.calculateUIScale();
            // Note: For a full resize, we'd need to rebuild the UI
            // For now, just update the scale factor
        };
        window.addEventListener('resize', this.resizeHandler);
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
        // Create outer glow/shadow container
        const glowContainer = new BABYLON.GUI.Rectangle();
        glowContainer.width = this.scaled(520);
        glowContainer.height = this.scaled(130);
        glowContainer.cornerRadius = this.scaledNum(20);
        glowContainer.color = "transparent";
        glowContainer.thickness = 0;
        glowContainer.background = "transparent";
        glowContainer.horizontalAlignment = BABYLON.GUI.Control.HORIZONTAL_ALIGNMENT_CENTER;
        glowContainer.verticalAlignment = BABYLON.GUI.Control.VERTICAL_ALIGNMENT_TOP;
        glowContainer.top = this.scaled(8);
        glowContainer.shadowColor = "rgba(0, 0, 0, 0.5)";
        glowContainer.shadowBlur = 20;
        glowContainer.shadowOffsetY = 5;
        this.advancedTexture.addControl(glowContainer);

        // Create main background container
        const container = new BABYLON.GUI.Rectangle();
        container.width = "100%";
        container.height = "100%";
        container.cornerRadius = this.scaledNum(18);
        container.color = this.colors.panelBorder;
        container.thickness = this.scaledNum(2);
        container.background = this.colors.panelBg;
        glowContainer.addControl(container);
        this.menuContainer = container;

        // Create vertical stack for coins + buttons
        const mainStack = new BABYLON.GUI.StackPanel();
        mainStack.isVertical = true;
        mainStack.spacing = this.scaledNum(8);
        mainStack.paddingTop = this.scaled(10);
        mainStack.paddingBottom = this.scaled(10);
        container.addControl(mainStack);

        // Create coins display at top - centered with icon
        const coinsContainer = new BABYLON.GUI.StackPanel();
        coinsContainer.height = this.scaled(32);
        coinsContainer.isVertical = false;
        coinsContainer.horizontalAlignment = BABYLON.GUI.Control.HORIZONTAL_ALIGNMENT_CENTER;
        mainStack.addControl(coinsContainer);

        // Coin icon (gold circle)
        const coinIcon = new BABYLON.GUI.Ellipse();
        coinIcon.width = this.scaled(24);
        coinIcon.height = this.scaled(24);
        coinIcon.color = "#b8860b";
        coinIcon.thickness = this.scaledNum(2);
        coinIcon.background = this.colors.gold;
        coinsContainer.addControl(coinIcon);

        // Coin symbol inside
        const coinSymbol = new BABYLON.GUI.TextBlock();
        coinSymbol.text = "$";
        coinSymbol.color = "#8b6914";
        coinSymbol.fontSize = this.scaledNum(14);
        coinSymbol.fontWeight = "bold";
        coinIcon.addControl(coinSymbol);

        // Coins counter
        this.coinsText = new BABYLON.GUI.TextBlock();
        this.coinsText.text = this.coins.toString();
        this.coinsText.width = this.scaled(80);
        this.coinsText.height = this.scaled(28);
        this.coinsText.color = this.colors.gold;
        this.coinsText.fontSize = this.scaledNum(22);
        this.coinsText.fontWeight = "bold";
        this.coinsText.fontFamily = "Arial, sans-serif";
        this.coinsText.textHorizontalAlignment = BABYLON.GUI.Control.HORIZONTAL_ALIGNMENT_LEFT;
        this.coinsText.paddingLeft = this.scaled(8);
        coinsContainer.addControl(this.coinsText);

        // Store base font size for animations
        this.baseCoinFontSize = this.scaledNum(22);

        // Create horizontal stack for buttons
        this.menuPanel = new BABYLON.GUI.StackPanel();
        this.menuPanel.height = this.scaled(60);
        this.menuPanel.isVertical = false;
        this.menuPanel.spacing = this.scaledNum(8);
        this.menuPanel.horizontalAlignment = BABYLON.GUI.Control.HORIZONTAL_ALIGNMENT_CENTER;
        mainStack.addControl(this.menuPanel);
    }

    /**
     * Create spawn buttons
     */
    createButtons() {
        // Button configurations with icons and colors
        const buttonConfigs = [
            { text: "Egg", type: "egg", icon: "🥚", color: "#5a6a8a" },
            { text: "Seed", type: "seed", icon: "🌱", color: "#4a7a5a" }
        ];

        buttonConfigs.forEach(config => {
            const button = this.createSpawnButton(config.text, config.type, config.icon, config.color);
            this.menuPanel.addControl(button);
        });

        // Create Building button with submenu toggle behavior
        const buildingButton = this.createBuildingMenuButton();
        this.menuPanel.addControl(buildingButton);

        // Create the building submenu (hidden initially)
        this.createBuildingSubmenu();
    }

    /**
     * Create a spawn button with icon and modern styling
     */
    createSpawnButton(text, objectType, icon, baseColor) {
        // Create button container
        const button = new BABYLON.GUI.Rectangle(`btn_${objectType}`);
        button.width = this.scaled(115);
        button.height = this.scaled(52);
        button.cornerRadius = this.scaledNum(12);
        button.color = "rgba(255, 255, 255, 0.3)";
        button.thickness = this.scaledNum(2);
        button.background = baseColor;
        button.shadowColor = "rgba(0, 0, 0, 0.3)";
        button.shadowBlur = 8;
        button.shadowOffsetY = 3;

        // Content stack
        const stack = new BABYLON.GUI.StackPanel();
        stack.isVertical = false;
        stack.spacing = this.scaledNum(6);
        button.addControl(stack);

        // Icon
        const iconText = new BABYLON.GUI.TextBlock();
        iconText.text = icon;
        iconText.width = this.scaled(28);
        iconText.fontSize = this.scaledNum(20);
        stack.addControl(iconText);

        // Label
        const label = new BABYLON.GUI.TextBlock();
        label.text = text;
        label.width = this.scaled(55);
        label.color = this.colors.textPrimary;
        label.fontSize = this.scaledNum(16);
        label.fontWeight = "bold";
        label.fontFamily = "Arial, sans-serif";
        label.textHorizontalAlignment = BABYLON.GUI.Control.HORIZONTAL_ALIGNMENT_LEFT;
        stack.addControl(label);

        // Store button reference and base color
        this.buttonMap[objectType] = button;
        button.baseColor = baseColor;

        // Hover effects
        button.onPointerEnterObservable.add(() => {
            button.background = this.lightenColor(baseColor, 20);
            button.thickness = this.scaledNum(3);
        });
        button.onPointerOutObservable.add(() => {
            button.background = baseColor;
            button.thickness = this.scaledNum(2);
        });

        if (this.isTouchDevice()) {
            // Mobile: drag-to-place
            button.onPointerDownObservable.add(() => {
                this.isDragging = true;
                this.dragObjectType = objectType;
                button.background = this.lightenColor(baseColor, 30);
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
     * Lighten a hex color by a percentage
     */
    lightenColor(color, percent) {
        const num = parseInt(color.replace('#', ''), 16);
        const amt = Math.round(2.55 * percent);
        const R = Math.min(255, (num >> 16) + amt);
        const G = Math.min(255, ((num >> 8) & 0x00FF) + amt);
        const B = Math.min(255, (num & 0x0000FF) + amt);
        return `#${(0x1000000 + R * 0x10000 + G * 0x100 + B).toString(16).slice(1)}`;
    }

    /**
     * Create a single button with click-to-select (desktop) or drag-to-place (mobile)
     * @deprecated Use createSpawnButton instead
     */
    createButton(text, objectType) {
        return this.createSpawnButton(text, objectType, "", "#3a3a4a");
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
        const baseColor = "#6a5a7a";

        // Create button container
        const button = new BABYLON.GUI.Rectangle("btn_Building");
        button.width = this.scaled(115);
        button.height = this.scaled(52);
        button.cornerRadius = this.scaledNum(12);
        button.color = "rgba(255, 255, 255, 0.3)";
        button.thickness = this.scaledNum(2);
        button.background = baseColor;
        button.shadowColor = "rgba(0, 0, 0, 0.3)";
        button.shadowBlur = 8;
        button.shadowOffsetY = 3;

        // Content stack
        const stack = new BABYLON.GUI.StackPanel();
        stack.isVertical = false;
        stack.spacing = this.scaledNum(6);
        button.addControl(stack);

        // Icon
        const iconText = new BABYLON.GUI.TextBlock();
        iconText.text = "🏗️";
        iconText.width = this.scaled(28);
        iconText.fontSize = this.scaledNum(20);
        stack.addControl(iconText);

        // Label with arrow
        const label = new BABYLON.GUI.TextBlock();
        label.text = "Build ▼";
        label.width = this.scaled(65);
        label.color = this.colors.textPrimary;
        label.fontSize = this.scaledNum(15);
        label.fontWeight = "bold";
        label.fontFamily = "Arial, sans-serif";
        label.textHorizontalAlignment = BABYLON.GUI.Control.HORIZONTAL_ALIGNMENT_LEFT;
        stack.addControl(label);
        this.buildingButtonLabel = label;

        // Store base color
        button.baseColor = baseColor;

        // Hover effects
        button.onPointerEnterObservable.add(() => {
            button.background = this.lightenColor(baseColor, 20);
            button.thickness = this.scaledNum(3);
        });
        button.onPointerOutObservable.add(() => {
            if (!this.isBuildingSubmenuOpen) {
                button.background = baseColor;
                button.thickness = this.scaledNum(2);
            }
        });

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
        submenu.width = this.scaled(280);
        submenu.height = "0px"; // Start collapsed
        submenu.cornerRadius = this.scaledNum(16);
        submenu.color = this.colors.panelBorder;
        submenu.thickness = this.scaledNum(2);
        submenu.background = this.colors.panelBg;
        submenu.horizontalAlignment = BABYLON.GUI.Control.HORIZONTAL_ALIGNMENT_CENTER;
        submenu.verticalAlignment = BABYLON.GUI.Control.VERTICAL_ALIGNMENT_TOP;
        submenu.top = this.scaled(145);
        submenu.left = this.scaled(50);
        submenu.isVisible = false;
        submenu.clipChildren = true;
        submenu.shadowColor = "rgba(0, 0, 0, 0.5)";
        submenu.shadowBlur = 15;
        submenu.shadowOffsetY = 5;
        this.advancedTexture.addControl(submenu);
        this.buildingSubmenu = submenu;

        // Create vertical stack for building options
        const stack = new BABYLON.GUI.StackPanel();
        stack.isVertical = true;
        stack.spacing = this.scaledNum(8);
        stack.paddingTop = this.scaled(12);
        stack.paddingBottom = this.scaled(12);
        stack.paddingLeft = this.scaled(12);
        stack.paddingRight = this.scaled(12);
        submenu.addControl(stack);
        this.buildingSubmenuStack = stack;

        // Building type buttons with costs
        const buildingTypes = [
            {
                text: "Turret",
                type: "turret",
                icon: "🗼",
                color: "#7a5a5a",
                wood: GameConstants.TURRET.WOOD_COST,
                stone: GameConstants.TURRET.STONE_COST
            },
            {
                text: "Armory",
                type: "armory",
                icon: "⚔️",
                color: "#5a5a7a",
                wood: 5, // Armory cost
                stone: 8
            },
            {
                text: "Factory",
                type: "factory",
                icon: "🏭",
                color: "#5a7a6a",
                wood: GameConstants.FACTORY.WOOD_COST,
                stone: GameConstants.FACTORY.STONE_COST
            }
        ];

        buildingTypes.forEach(config => {
            const btn = this.createBuildingTypeButton(config);
            stack.addControl(btn);
        });

        this.submenuFullHeight = this.scaledNum(220);
    }

    /**
     * Create a building type button for the submenu with cost display
     */
    createBuildingTypeButton(config) {
        const { text, type, icon, color, wood, stone } = config;

        // Button container
        const button = new BABYLON.GUI.Rectangle(`btn_${type}`);
        button.width = this.scaled(250);
        button.height = this.scaled(55);
        button.cornerRadius = this.scaledNum(10);
        button.color = "rgba(255, 255, 255, 0.2)";
        button.thickness = this.scaledNum(2);
        button.background = color;
        button.shadowColor = "rgba(0, 0, 0, 0.2)";
        button.shadowBlur = 5;
        button.shadowOffsetY = 2;

        // Main content grid
        const mainStack = new BABYLON.GUI.StackPanel();
        mainStack.isVertical = false;
        button.addControl(mainStack);

        // Icon
        const iconText = new BABYLON.GUI.TextBlock();
        iconText.text = icon;
        iconText.width = this.scaled(40);
        iconText.fontSize = this.scaledNum(22);
        mainStack.addControl(iconText);

        // Name and cost stack
        const infoStack = new BABYLON.GUI.StackPanel();
        infoStack.isVertical = true;
        infoStack.width = this.scaled(190);
        infoStack.spacing = this.scaledNum(2);
        mainStack.addControl(infoStack);

        // Name
        const nameText = new BABYLON.GUI.TextBlock();
        nameText.text = text;
        nameText.height = this.scaled(24);
        nameText.color = this.colors.textPrimary;
        nameText.fontSize = this.scaledNum(16);
        nameText.fontWeight = "bold";
        nameText.fontFamily = "Arial, sans-serif";
        nameText.textHorizontalAlignment = BABYLON.GUI.Control.HORIZONTAL_ALIGNMENT_LEFT;
        infoStack.addControl(nameText);

        // Cost display
        const costStack = new BABYLON.GUI.StackPanel();
        costStack.isVertical = false;
        costStack.height = this.scaled(20);
        costStack.horizontalAlignment = BABYLON.GUI.Control.HORIZONTAL_ALIGNMENT_LEFT;
        infoStack.addControl(costStack);

        // Wood cost
        const woodText = new BABYLON.GUI.TextBlock();
        woodText.text = `🪵 ${wood}`;
        woodText.width = this.scaled(55);
        woodText.color = "#c4a574";
        woodText.fontSize = this.scaledNum(13);
        woodText.textHorizontalAlignment = BABYLON.GUI.Control.HORIZONTAL_ALIGNMENT_LEFT;
        costStack.addControl(woodText);

        // Stone cost
        const stoneText = new BABYLON.GUI.TextBlock();
        stoneText.text = `🪨 ${stone}`;
        stoneText.width = this.scaled(55);
        stoneText.color = "#a0a0a0";
        stoneText.fontSize = this.scaledNum(13);
        stoneText.textHorizontalAlignment = BABYLON.GUI.Control.HORIZONTAL_ALIGNMENT_LEFT;
        costStack.addControl(stoneText);

        // Store button reference
        this.buttonMap[type] = button;
        button.baseColor = color;

        // Hover effects
        button.onPointerEnterObservable.add(() => {
            button.background = this.lightenColor(color, 15);
            button.thickness = this.scaledNum(3);
        });
        button.onPointerOutObservable.add(() => {
            button.background = color;
            button.thickness = this.scaledNum(2);
        });

        if (this.isTouchDevice()) {
            // Mobile: drag-to-place
            button.onPointerDownObservable.add(() => {
                this.isDragging = true;
                this.dragObjectType = type;
                this.closeBuildingSubmenu();
                if (this.dragStartCallbacks[type]) {
                    this.dragStartCallbacks[type]();
                }
            });
        } else {
            // Desktop: click to select building type
            button.onPointerClickObservable.add(() => {
                this.toggleSelection(type, button);
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

        // Update arrow indicator
        if (this.buildingButtonLabel) {
            this.buildingButtonLabel.text = "Build ▲";
        }

        // Highlight building button
        if (this.buildingButton) {
            this.buildingButton.background = this.lightenColor(this.buildingButton.baseColor, 25);
        }

        // Animate height expansion
        const animationDuration = 180; // ms
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

        // Update arrow indicator
        if (this.buildingButtonLabel) {
            this.buildingButtonLabel.text = "Build ▼";
        }

        // Reset building button color
        if (this.buildingButton) {
            this.buildingButton.background = this.buildingButton.baseColor;
            this.buildingButton.thickness = this.scaledNum(2);
        }

        // Animate height collapse
        const animationDuration = 120; // ms
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
        // Create background panel with modern styling
        const panel = new BABYLON.GUI.Rectangle();
        panel.width = this.scaled(220);
        panel.height = this.scaled(180);
        panel.cornerRadius = this.scaledNum(16);
        panel.color = "rgba(255, 100, 100, 0.4)";
        panel.thickness = this.scaledNum(2);
        panel.background = "rgba(30, 20, 25, 0.92)";
        panel.horizontalAlignment = BABYLON.GUI.Control.HORIZONTAL_ALIGNMENT_RIGHT;
        panel.verticalAlignment = BABYLON.GUI.Control.VERTICAL_ALIGNMENT_TOP;
        panel.top = this.scaled(8);
        panel.left = this.scaled(-8);
        panel.shadowColor = "rgba(0, 0, 0, 0.4)";
        panel.shadowBlur = 12;
        panel.shadowOffsetY = 4;
        this.advancedTexture.addControl(panel);
        this.debugPanel = panel;

        // Hide debug panel by default
        this.debugPanel.isVisible = false;

        // Create stack panel for contents
        const stack = new BABYLON.GUI.StackPanel();
        stack.isVertical = true;
        stack.spacing = this.scaledNum(8);
        stack.paddingTop = this.scaled(12);
        stack.paddingBottom = this.scaled(12);
        panel.addControl(stack);

        // Title with icon
        const titleContainer = new BABYLON.GUI.StackPanel();
        titleContainer.isVertical = false;
        titleContainer.height = this.scaled(28);
        stack.addControl(titleContainer);

        const titleIcon = new BABYLON.GUI.TextBlock();
        titleIcon.text = "🔧";
        titleIcon.width = this.scaled(24);
        titleIcon.fontSize = this.scaledNum(14);
        titleContainer.addControl(titleIcon);

        const title = new BABYLON.GUI.TextBlock();
        title.text = "DEBUG (F1)";
        title.width = this.scaled(120);
        title.color = "#ff8888";
        title.fontSize = this.scaledNum(14);
        title.fontWeight = "bold";
        title.fontFamily = "Arial, sans-serif";
        title.textHorizontalAlignment = BABYLON.GUI.Control.HORIZONTAL_ALIGNMENT_LEFT;
        titleContainer.addControl(title);

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
        const dropBubbyBtn = this.createDebugButton("🐣 Drop Bubby", () => {
            if (this.onDropBubbyCallback) {
                this.onDropBubbyCallback();
            }
        });
        stack.addControl(dropBubbyBtn);

        // Drop Soldier button (bubby with sword)
        const dropSoldierBtn = this.createDebugButton("⚔️ Drop Soldier", () => {
            if (this.onDropSoldierCallback) {
                this.onDropSoldierCallback();
            }
        });
        stack.addControl(dropSoldierBtn);

        // Give Resources button (+100 wood, +100 stone)
        const giveResourcesBtn = this.createDebugButton("📦 +100 Resources", () => {
            if (this.onGiveResourcesCallback) {
                this.onGiveResourcesCallback();
            }
        });
        stack.addControl(giveResourcesBtn);
    }

    /**
     * Create a debug button with modern styling
     */
    createDebugButton(labelText, onClickCallback) {
        const button = new BABYLON.GUI.Rectangle("debugBtn_" + labelText);
        button.width = this.scaled(180);
        button.height = this.scaled(32);
        button.cornerRadius = this.scaledNum(8);
        button.color = "rgba(255, 255, 255, 0.2)";
        button.thickness = this.scaledNum(1);
        button.background = "#4a4a5a";

        const label = new BABYLON.GUI.TextBlock();
        label.text = labelText;
        label.color = this.colors.textPrimary;
        label.fontSize = this.scaledNum(13);
        label.fontFamily = "Arial, sans-serif";
        button.addControl(label);

        button.onPointerClickObservable.add(() => {
            if (onClickCallback) {
                onClickCallback();
            }
        });
        button.onPointerEnterObservable.add(() => {
            button.background = "#5a5a7a";
            button.thickness = this.scaledNum(2);
        });
        button.onPointerOutObservable.add(() => {
            button.background = "#4a4a5a";
            button.thickness = this.scaledNum(1);
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
     * Set callback for Give Resources debug button
     */
    setOnGiveResourcesCallback(callback) {
        this.onGiveResourcesCallback = callback;
    }

    /**
     * Create a checkbox with label
     */
    createCheckbox(labelText, initialValue, onChangeCallback) {
        // Container
        const container = new BABYLON.GUI.StackPanel();
        container.height = this.scaled(32);
        container.isVertical = false;
        container.horizontalAlignment = BABYLON.GUI.Control.HORIZONTAL_ALIGNMENT_LEFT;
        container.paddingLeft = this.scaled(18);

        // Checkbox
        const checkbox = new BABYLON.GUI.Checkbox();
        checkbox.width = this.scaled(20);
        checkbox.height = this.scaled(20);
        checkbox.isChecked = initialValue;
        checkbox.color = this.colors.accent;
        checkbox.background = "#2a2a3a";
        checkbox.checkSizeRatio = 0.7;
        checkbox.onIsCheckedChangedObservable.add((value) => {
            if (onChangeCallback) {
                onChangeCallback(value);
            }
        });
        container.addControl(checkbox);

        // Label
        const label = new BABYLON.GUI.TextBlock();
        label.text = labelText;
        label.width = this.scaled(130);
        label.height = this.scaled(20);
        label.color = this.colors.textSecondary;
        label.fontSize = this.scaledNum(13);
        label.fontFamily = "Arial, sans-serif";
        label.textHorizontalAlignment = BABYLON.GUI.Control.HORIZONTAL_ALIGNMENT_LEFT;
        label.paddingLeft = this.scaled(10);
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

        // Arrow button size - larger touch targets for mobile
        const btnSize = this.scaledNum(80);
        const margin = this.scaledNum(20);

        // Create left arrow button with modern styling
        const leftBtn = this.createMobileArrowButton("←", true);
        leftBtn.width = btnSize + "px";
        leftBtn.height = btnSize + "px";
        leftBtn.horizontalAlignment = BABYLON.GUI.Control.HORIZONTAL_ALIGNMENT_LEFT;
        leftBtn.verticalAlignment = BABYLON.GUI.Control.VERTICAL_ALIGNMENT_BOTTOM;
        leftBtn.left = margin + "px";
        leftBtn.top = -margin + "px";
        this.advancedTexture.addControl(leftBtn);
        this.leftArrowBtn = leftBtn;

        // Hold to pan left
        leftBtn.onPointerDownObservable.add(() => {
            this.panningLeft = true;
            leftBtn.background = "rgba(74, 158, 255, 0.5)";
        });
        leftBtn.onPointerUpObservable.add(() => {
            this.panningLeft = false;
            leftBtn.background = "rgba(40, 45, 60, 0.7)";
        });
        leftBtn.onPointerOutObservable.add(() => {
            this.panningLeft = false;
            leftBtn.background = "rgba(40, 45, 60, 0.7)";
        });

        // Create right arrow button with modern styling
        const rightBtn = this.createMobileArrowButton("→", false);
        rightBtn.width = btnSize + "px";
        rightBtn.height = btnSize + "px";
        rightBtn.horizontalAlignment = BABYLON.GUI.Control.HORIZONTAL_ALIGNMENT_RIGHT;
        rightBtn.verticalAlignment = BABYLON.GUI.Control.VERTICAL_ALIGNMENT_BOTTOM;
        rightBtn.left = -margin + "px";
        rightBtn.top = -margin + "px";
        this.advancedTexture.addControl(rightBtn);
        this.rightArrowBtn = rightBtn;

        // Hold to pan right
        rightBtn.onPointerDownObservable.add(() => {
            this.panningRight = true;
            rightBtn.background = "rgba(74, 158, 255, 0.5)";
        });
        rightBtn.onPointerUpObservable.add(() => {
            this.panningRight = false;
            rightBtn.background = "rgba(40, 45, 60, 0.7)";
        });
        rightBtn.onPointerOutObservable.add(() => {
            this.panningRight = false;
            rightBtn.background = "rgba(40, 45, 60, 0.7)";
        });
    }

    /**
     * Create a modern mobile arrow button
     */
    createMobileArrowButton(arrow, isLeft) {
        // Outer container with glow
        const button = new BABYLON.GUI.Rectangle();
        button.cornerRadius = this.scaledNum(20);
        button.color = "rgba(100, 140, 200, 0.5)";
        button.thickness = this.scaledNum(3);
        button.background = "rgba(40, 45, 60, 0.7)";
        button.shadowColor = "rgba(0, 0, 0, 0.4)";
        button.shadowBlur = 10;
        button.shadowOffsetY = 3;

        // Arrow text
        const arrowText = new BABYLON.GUI.TextBlock();
        arrowText.text = arrow;
        arrowText.color = this.colors.textPrimary;
        arrowText.fontSize = this.scaledNum(32);
        arrowText.fontWeight = "bold";
        button.addControl(arrowText);

        return button;
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

        // Create a plane mesh for the billboard
        this.billboardPlane = BABYLON.MeshBuilder.CreatePlane(
            "hqBillboard",
            { width: 14, height: 10 },
            this.scene
        );

        // Position above the castle
        this.billboardPlane.position = new BABYLON.Vector3(
            castlePos.x,
            castlePos.y + 18,
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
        const s = this.calculateBillboardScale();

        // Create background container with modern styling
        const background = new BABYLON.GUI.Rectangle("billboardBg");
        background.width = "96%";
        background.height = "94%";
        background.cornerRadius = Math.round(40 * s);
        background.color = "rgba(100, 140, 200, 0.6)";
        background.thickness = Math.round(4 * s);
        background.background = "rgba(15, 20, 35, 0.95)";
        this.billboardTexture.addControl(background);

        // Create stack for content
        const stack = new BABYLON.GUI.StackPanel();
        stack.isVertical = true;
        stack.spacing = Math.round(20 * s);
        stack.paddingTop = Math.round(30 * s) + "px";
        background.addControl(stack);

        // Title with icon
        const titleRow = new BABYLON.GUI.StackPanel();
        titleRow.isVertical = false;
        titleRow.height = Math.round(80 * s) + "px";
        stack.addControl(titleRow);

        const titleIcon = new BABYLON.GUI.TextBlock();
        titleIcon.text = "🏰";
        titleIcon.width = Math.round(80 * s) + "px";
        titleIcon.fontSize = Math.round(52 * s);
        titleRow.addControl(titleIcon);

        const title = new BABYLON.GUI.TextBlock();
        title.text = "Headquarters";
        title.width = Math.round(400 * s) + "px";
        title.color = "#ffd700";
        title.fontSize = Math.round(56 * s);
        title.fontWeight = "bold";
        title.fontFamily = "Arial, sans-serif";
        title.textHorizontalAlignment = BABYLON.GUI.Control.HORIZONTAL_ALIGNMENT_LEFT;
        titleRow.addControl(title);

        // Divider line
        const divider = new BABYLON.GUI.Rectangle();
        divider.width = "80%";
        divider.height = Math.round(3 * s) + "px";
        divider.background = "rgba(100, 140, 200, 0.4)";
        divider.thickness = 0;
        stack.addControl(divider);

        // Resource inventory row with icons
        const resourceRow = new BABYLON.GUI.StackPanel();
        resourceRow.isVertical = false;
        resourceRow.height = Math.round(70 * s) + "px";
        resourceRow.spacing = Math.round(40 * s);
        stack.addControl(resourceRow);

        // Fruit count with icon
        this.fruitInventoryText = this.createResourceDisplay("🍎", castle.getFruitCount(), "#ff6b6b", s);
        resourceRow.addControl(this.fruitInventoryText);

        // Wood count with icon
        this.hqWoodText = this.createResourceDisplay("🪵", castle.getWoodCount(), "#c4a574", s);
        resourceRow.addControl(this.hqWoodText);

        // Stone count with icon
        this.hqStoneText = this.createResourceDisplay("🪨", castle.getStoneCount(), "#a0a0a0", s);
        resourceRow.addControl(this.hqStoneText);

        // Sell Fruit button with modern styling
        const sellButton = this.createBillboardButton(
            "💰 Sell Fruit (+1 coin)",
            castle.getFruitCount() > 0 ? "#4a8a5a" : "#3a3a4a",
            Math.round(650 * s),
            Math.round(100 * s),
            s
        );
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
        const closeButton = this.createBillboardButton(
            "✕ Close",
            "#5a5a6a",
            Math.round(250 * s),
            Math.round(70 * s),
            s
        );
        stack.addControl(closeButton);

        closeButton.onPointerClickObservable.add(() => {
            this.closeBillboard();
        });

        // Store modal state
        this.isModalOpen = true;
    }

    /**
     * Create a resource display element with icon and value
     */
    createResourceDisplay(icon, value, color, scale) {
        const container = new BABYLON.GUI.StackPanel();
        container.isVertical = false;
        container.width = Math.round(180 * scale) + "px";

        const iconText = new BABYLON.GUI.TextBlock();
        iconText.text = icon;
        iconText.width = Math.round(50 * scale) + "px";
        iconText.fontSize = Math.round(36 * scale);
        container.addControl(iconText);

        const valueText = new BABYLON.GUI.TextBlock();
        valueText.text = value.toString();
        valueText.width = Math.round(100 * scale) + "px";
        valueText.color = color;
        valueText.fontSize = Math.round(42 * scale);
        valueText.fontWeight = "bold";
        valueText.fontFamily = "Arial, sans-serif";
        valueText.textHorizontalAlignment = BABYLON.GUI.Control.HORIZONTAL_ALIGNMENT_LEFT;
        container.addControl(valueText);

        // Store value text reference for updates
        container.valueText = valueText;

        return container;
    }

    /**
     * Create a styled billboard button
     */
    createBillboardButton(text, bgColor, width, height, scale) {
        const button = new BABYLON.GUI.Rectangle();
        button.width = width + "px";
        button.height = height + "px";
        button.cornerRadius = Math.round(18 * scale);
        button.color = "rgba(255, 255, 255, 0.3)";
        button.thickness = Math.round(3 * scale);
        button.background = bgColor;

        const label = new BABYLON.GUI.TextBlock();
        label.text = text;
        label.color = "#ffffff";
        label.fontSize = Math.round(38 * scale);
        label.fontWeight = "bold";
        label.fontFamily = "Arial, sans-serif";
        button.addControl(label);

        // Store base color for hover effects
        button.baseColor = bgColor;

        button.onPointerEnterObservable.add(() => {
            if (button.baseColor !== "#3a3a4a") { // Only highlight if not disabled
                button.background = this.lightenColor(button.baseColor, 20);
                button.thickness = Math.round(4 * scale);
            }
        });
        button.onPointerOutObservable.add(() => {
            button.background = button.baseColor;
            button.thickness = Math.round(3 * scale);
        });

        return button;
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
            return 1.5; // Mobile - larger text
        } else if (minDimension < 800) {
            return 1.25; // Tablet
        } else if (minDimension < 1200) {
            return 1.0; // Small desktop
        }
        return 0.95; // Large desktop
    }

    /**
     * Update resource inventory display in billboard (fruit, wood, stone)
     */
    updateFruitInventoryDisplay(castle) {
        if (this.fruitInventoryText && this.fruitInventoryText.valueText) {
            this.fruitInventoryText.valueText.text = castle.getFruitCount().toString();
        }
        if (this.hqWoodText && this.hqWoodText.valueText) {
            this.hqWoodText.valueText.text = castle.getWoodCount().toString();
        }
        if (this.hqStoneText && this.hqStoneText.valueText) {
            this.hqStoneText.valueText.text = castle.getStoneCount().toString();
        }
        if (this.sellButton) {
            const hasFruit = castle.getFruitCount() > 0;
            this.sellButton.background = hasFruit ? "#4a8a5a" : "#3a3a4a";
            this.sellButton.baseColor = hasFruit ? "#4a8a5a" : "#3a3a4a";
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
            { width: 16, height: 14 },
            this.scene
        );

        // Position above the armory
        this.billboardPlane.position = new BABYLON.Vector3(
            armoryPos.x,
            armoryPos.y + 14,
            armoryPos.z
        );

        // Billboard mode - always face camera
        this.billboardPlane.billboardMode = BABYLON.Mesh.BILLBOARDMODE_ALL;

        // Create texture for the billboard GUI
        this.billboardTexture = BABYLON.GUI.AdvancedDynamicTexture.CreateForMesh(
            this.billboardPlane,
            1024,
            896,
            false
        );

        // Setup click-off-to-close behavior
        this.setupBillboardClickOff();

        // Calculate billboard font scale based on display
        const s = this.calculateBillboardScale();

        // Create background container with modern styling
        const background = new BABYLON.GUI.Rectangle("billboardBg");
        background.width = "96%";
        background.height = "96%";
        background.cornerRadius = Math.round(40 * s);
        background.color = "rgba(180, 140, 100, 0.6)";
        background.thickness = Math.round(4 * s);
        background.background = "rgba(25, 20, 15, 0.95)";
        this.billboardTexture.addControl(background);

        // Create stack for content
        const stack = new BABYLON.GUI.StackPanel();
        stack.isVertical = true;
        stack.spacing = Math.round(16 * s);
        stack.paddingTop = Math.round(25 * s) + "px";
        background.addControl(stack);

        // Title with icon
        const titleRow = new BABYLON.GUI.StackPanel();
        titleRow.isVertical = false;
        titleRow.height = Math.round(70 * s) + "px";
        stack.addControl(titleRow);

        const titleIcon = new BABYLON.GUI.TextBlock();
        titleIcon.text = "⚔️";
        titleIcon.width = Math.round(70 * s) + "px";
        titleIcon.fontSize = Math.round(46 * s);
        titleRow.addControl(titleIcon);

        const title = new BABYLON.GUI.TextBlock();
        title.text = "Armory";
        title.width = Math.round(300 * s) + "px";
        title.color = "#ffd700";
        title.fontSize = Math.round(52 * s);
        title.fontWeight = "bold";
        title.fontFamily = "Arial, sans-serif";
        title.textHorizontalAlignment = BABYLON.GUI.Control.HORIZONTAL_ALIGNMENT_LEFT;
        titleRow.addControl(title);

        // Divider
        const divider = new BABYLON.GUI.Rectangle();
        divider.width = "85%";
        divider.height = Math.round(3 * s) + "px";
        divider.background = "rgba(180, 140, 100, 0.4)";
        divider.thickness = 0;
        stack.addControl(divider);

        // Equipment inventory row with icons
        const equipRow = new BABYLON.GUI.StackPanel();
        equipRow.isVertical = false;
        equipRow.height = Math.round(55 * s) + "px";
        equipRow.spacing = Math.round(30 * s);
        stack.addControl(equipRow);

        this.armorySwordDisplay = this.createResourceDisplay("🗡️", armory.getSwordCount(), "#7a9aff", s);
        equipRow.addControl(this.armorySwordDisplay);

        this.armoryArmorDisplay = this.createResourceDisplay("🛡️", armory.getArmorCount(), "#8a7a6a", s);
        equipRow.addControl(this.armoryArmorDisplay);

        this.armoryHelmetDisplay = this.createResourceDisplay("⛑️", armory.getHelmetCount(), "#6a8a7a", s);
        equipRow.addControl(this.armoryHelmetDisplay);

        // Resource display
        const resourceRow = new BABYLON.GUI.StackPanel();
        resourceRow.isVertical = false;
        resourceRow.height = Math.round(50 * s) + "px";
        resourceRow.spacing = Math.round(35 * s);
        stack.addControl(resourceRow);

        this.armoryWoodDisplay = this.createResourceDisplay("🪵", castle.getWoodCount(), "#c4a574", s);
        resourceRow.addControl(this.armoryWoodDisplay);

        this.armoryStoneDisplay = this.createResourceDisplay("🪨", castle.getStoneCount(), "#a0a0a0", s);
        resourceRow.addControl(this.armoryStoneDisplay);

        // Craft buttons
        const swordCost = armory.getSwordCost();
        const canCraft = armory.canCraftSword();

        this.craftSwordButton = this.createBillboardButton(
            `🗡️ Sword (${swordCost.wood}🪵 ${swordCost.stone}🪨)`,
            canCraft ? "#5a7a9a" : "#3a3a4a",
            Math.round(680 * s),
            Math.round(80 * s),
            s
        );
        stack.addControl(this.craftSwordButton);

        this.currentArmory = armory;
        this.currentCastle = castle;
        this.onCraftSwordCallback = onCraftSword;

        this.craftSwordButton.onPointerClickObservable.add(() => {
            if (armory.canCraftSword()) {
                if (armory.craftSword()) {
                    this.updateArmoryDisplay(armory, castle);
                    if (onCraftSword) onCraftSword(armory);
                }
            }
        });

        // Craft Armor button
        const armorCost = armory.getArmorCost();
        const canCraftArmor = armory.canCraftArmor();

        this.craftArmorButton = this.createBillboardButton(
            `🛡️ Armor (${armorCost.wood}🪵 ${armorCost.stone}🪨)`,
            canCraftArmor ? "#7a6a5a" : "#3a3a4a",
            Math.round(680 * s),
            Math.round(80 * s),
            s
        );
        stack.addControl(this.craftArmorButton);

        this.craftArmorButton.onPointerClickObservable.add(() => {
            if (armory.canCraftArmor()) {
                if (armory.craftArmor()) {
                    this.updateArmoryDisplay(armory, castle);
                }
            }
        });

        // Craft Helmet button
        const helmetCost = armory.getHelmetCost();
        const canCraftHelmet = armory.canCraftHelmet();

        this.craftHelmetButton = this.createBillboardButton(
            `⛑️ Helmet (${helmetCost.wood}🪵 ${helmetCost.stone}🪨)`,
            canCraftHelmet ? "#5a7a6a" : "#3a3a4a",
            Math.round(680 * s),
            Math.round(80 * s),
            s
        );
        stack.addControl(this.craftHelmetButton);

        this.craftHelmetButton.onPointerClickObservable.add(() => {
            if (armory.canCraftHelmet()) {
                if (armory.craftHelmet()) {
                    this.updateArmoryDisplay(armory, castle);
                }
            }
        });

        // Close button
        const closeButton = this.createBillboardButton("✕ Close", "#5a5a6a", Math.round(220 * s), Math.round(60 * s), s);
        stack.addControl(closeButton);

        closeButton.onPointerClickObservable.add(() => {
            this.closeBillboard();
        });

        // Store modal state
        this.isModalOpen = true;
    }

    /**
     * Update armory display (sword count, armor count, helmet count, resources, button states)
     */
    updateArmoryDisplay(armory, castle) {
        if (this.armorySwordDisplay && this.armorySwordDisplay.valueText) {
            this.armorySwordDisplay.valueText.text = armory.getSwordCount().toString();
        }
        if (this.armoryArmorDisplay && this.armoryArmorDisplay.valueText) {
            this.armoryArmorDisplay.valueText.text = armory.getArmorCount().toString();
        }
        if (this.armoryHelmetDisplay && this.armoryHelmetDisplay.valueText) {
            this.armoryHelmetDisplay.valueText.text = armory.getHelmetCount().toString();
        }
        if (this.armoryWoodDisplay && this.armoryWoodDisplay.valueText) {
            this.armoryWoodDisplay.valueText.text = castle.getWoodCount().toString();
        }
        if (this.armoryStoneDisplay && this.armoryStoneDisplay.valueText) {
            this.armoryStoneDisplay.valueText.text = castle.getStoneCount().toString();
        }
        if (this.craftSwordButton) {
            const can = armory.canCraftSword();
            this.craftSwordButton.background = can ? "#5a7a9a" : "#3a3a4a";
            this.craftSwordButton.baseColor = can ? "#5a7a9a" : "#3a3a4a";
        }
        if (this.craftArmorButton) {
            const can = armory.canCraftArmor();
            this.craftArmorButton.background = can ? "#7a6a5a" : "#3a3a4a";
            this.craftArmorButton.baseColor = can ? "#7a6a5a" : "#3a3a4a";
        }
        if (this.craftHelmetButton) {
            const can = armory.canCraftHelmet();
            this.craftHelmetButton.background = can ? "#5a7a6a" : "#3a3a4a";
            this.craftHelmetButton.baseColor = can ? "#5a7a6a" : "#3a3a4a";
        }
    }

    // ==========================================
    // FACTORY MENU
    // ==========================================

    /**
     * Show Factory build menu as a 3D billboard above the factory
     */
    showFactoryBuildMenu(factory, castle, onQueueTank) {
        // Close any existing billboard
        this.closeBillboard();

        const factoryPos = factory.getPosition();

        // Create a plane mesh for the billboard
        this.billboardPlane = BABYLON.MeshBuilder.CreatePlane(
            "factoryBillboard",
            { width: 14, height: 11 },
            this.scene
        );

        // Position above the factory
        this.billboardPlane.position = new BABYLON.Vector3(
            factoryPos.x,
            factoryPos.y + 14,
            factoryPos.z
        );

        // Billboard mode - always face camera
        this.billboardPlane.billboardMode = BABYLON.Mesh.BILLBOARDMODE_ALL;

        // Create texture for the billboard GUI
        this.billboardTexture = BABYLON.GUI.AdvancedDynamicTexture.CreateForMesh(
            this.billboardPlane,
            1024,
            800,
            false
        );

        // Setup click-off-to-close behavior
        this.setupBillboardClickOff();

        // Calculate billboard font scale based on display
        const s = this.calculateBillboardScale();

        // Create background container with modern styling
        const background = new BABYLON.GUI.Rectangle("billboardBg");
        background.width = "96%";
        background.height = "94%";
        background.cornerRadius = Math.round(40 * s);
        background.color = "rgba(100, 160, 140, 0.6)";
        background.thickness = Math.round(4 * s);
        background.background = "rgba(20, 25, 30, 0.95)";
        this.billboardTexture.addControl(background);

        // Create stack for content
        const stack = new BABYLON.GUI.StackPanel();
        stack.isVertical = true;
        stack.spacing = Math.round(22 * s);
        stack.paddingTop = Math.round(30 * s) + "px";
        background.addControl(stack);

        // Title with icon
        const titleRow = new BABYLON.GUI.StackPanel();
        titleRow.isVertical = false;
        titleRow.height = Math.round(75 * s) + "px";
        stack.addControl(titleRow);

        const titleIcon = new BABYLON.GUI.TextBlock();
        titleIcon.text = "🏭";
        titleIcon.width = Math.round(75 * s) + "px";
        titleIcon.fontSize = Math.round(50 * s);
        titleRow.addControl(titleIcon);

        const title = new BABYLON.GUI.TextBlock();
        title.text = "Factory";
        title.width = Math.round(300 * s) + "px";
        title.color = "#ffd700";
        title.fontSize = Math.round(54 * s);
        title.fontWeight = "bold";
        title.fontFamily = "Arial, sans-serif";
        title.textHorizontalAlignment = BABYLON.GUI.Control.HORIZONTAL_ALIGNMENT_LEFT;
        titleRow.addControl(title);

        // Divider
        const divider = new BABYLON.GUI.Rectangle();
        divider.width = "80%";
        divider.height = Math.round(3 * s) + "px";
        divider.background = "rgba(100, 160, 140, 0.4)";
        divider.thickness = 0;
        stack.addControl(divider);

        // Production status with progress indicator
        const statusContainer = new BABYLON.GUI.Rectangle();
        statusContainer.width = Math.round(700 * s) + "px";
        statusContainer.height = Math.round(70 * s) + "px";
        statusContainer.cornerRadius = Math.round(12 * s);
        statusContainer.color = "transparent";
        statusContainer.thickness = 0;
        statusContainer.background = "rgba(60, 80, 70, 0.5)";
        stack.addControl(statusContainer);

        this.factoryQueueText = new BABYLON.GUI.TextBlock();
        const isProducing = factory.isProducing();
        this.factoryQueueText.text = isProducing ?
            `⚙️ Producing... ${Math.round(factory.getProductionProgress() * 100)}%` :
            `📦 Queue: ${factory.getQueueLength()} tanks`;
        this.factoryQueueText.color = isProducing ? "#7aff7a" : "#a0b0c0";
        this.factoryQueueText.fontSize = Math.round(38 * s);
        this.factoryQueueText.fontFamily = "Arial, sans-serif";
        statusContainer.addControl(this.factoryQueueText);

        // Resource display
        const resourceRow = new BABYLON.GUI.StackPanel();
        resourceRow.isVertical = false;
        resourceRow.height = Math.round(60 * s) + "px";
        resourceRow.spacing = Math.round(40 * s);
        stack.addControl(resourceRow);

        this.factoryWoodDisplay = this.createResourceDisplay("🪵", castle.getWoodCount(), "#c4a574", s);
        resourceRow.addControl(this.factoryWoodDisplay);

        this.factoryStoneDisplay = this.createResourceDisplay("🪨", castle.getStoneCount(), "#a0a0a0", s);
        resourceRow.addControl(this.factoryStoneDisplay);

        // Build Tank button
        const tankCost = { wood: GameConstants.TANK.WOOD_COST, stone: GameConstants.TANK.STONE_COST };
        const canBuild = castle.getWoodCount() >= tankCost.wood && castle.getStoneCount() >= tankCost.stone;

        this.buildTankButton = this.createBillboardButton(
            `🚀 Build Tank (${tankCost.wood}🪵 ${tankCost.stone}🪨)`,
            canBuild ? "#4a8a6a" : "#3a3a4a",
            Math.round(700 * s),
            Math.round(100 * s),
            s
        );
        stack.addControl(this.buildTankButton);

        this.currentFactory = factory;
        this.currentFactoryCastle = castle;

        this.buildTankButton.onPointerClickObservable.add(() => {
            if (castle.getWoodCount() >= tankCost.wood && castle.getStoneCount() >= tankCost.stone) {
                castle.useWood(tankCost.wood);
                castle.useStone(tankCost.stone);
                factory.queueTank();
                this.updateFactoryDisplay(factory, castle);
                if (onQueueTank) onQueueTank(factory);
            }
        });

        // Close button
        const closeButton = this.createBillboardButton("✕ Close", "#5a5a6a", Math.round(220 * s), Math.round(65 * s), s);
        stack.addControl(closeButton);

        closeButton.onPointerClickObservable.add(() => {
            this.closeBillboard();
        });

        // Store modal state
        this.isModalOpen = true;
    }

    /**
     * Update factory display (queue status, resources, button states)
     */
    updateFactoryDisplay(factory, castle) {
        if (this.factoryQueueText) {
            const isProducing = factory.isProducing();
            this.factoryQueueText.text = isProducing ?
                `⚙️ Producing... ${Math.round(factory.getProductionProgress() * 100)}%` :
                `📦 Queue: ${factory.getQueueLength()} tanks`;
            this.factoryQueueText.color = isProducing ? "#7aff7a" : "#a0b0c0";
        }
        if (this.factoryWoodDisplay && this.factoryWoodDisplay.valueText) {
            this.factoryWoodDisplay.valueText.text = castle.getWoodCount().toString();
        }
        if (this.factoryStoneDisplay && this.factoryStoneDisplay.valueText) {
            this.factoryStoneDisplay.valueText.text = castle.getStoneCount().toString();
        }
        if (this.buildTankButton) {
            const tankCost = { wood: GameConstants.TANK.WOOD_COST, stone: GameConstants.TANK.STONE_COST };
            const canBuild = castle.getWoodCount() >= tankCost.wood && castle.getStoneCount() >= tankCost.stone;
            this.buildTankButton.background = canBuild ? "#4a8a6a" : "#3a3a4a";
            this.buildTankButton.baseColor = canBuild ? "#4a8a6a" : "#3a3a4a";
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
        if (this.resizeHandler) {
            window.removeEventListener('resize', this.resizeHandler);
        }
        if (this.advancedTexture) {
            this.advancedTexture.dispose();
        }
    }
}