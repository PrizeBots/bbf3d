# Mobile Support Implementation Plan

## Todo List

- [x] Add mobile meta tags to `index.html`
- [x] Add mobile CSS rules to `index.html`
- [x] Add `isTouchDevice()` detection to UIManager
- [x] Create left/right arrow buttons in UIManager
- [x] Add `getPanDirection()` method to UIManager
- [x] Add `setUIManager()` method to CameraController
- [x] Update CameraController `update()` to check UI pan state
- [x] Wire up UIManager to CameraController in main.js
- [ ] Test on mobile device - buttons visible
- [ ] Test on mobile device - camera pans smoothly
- [ ] Test on mobile device - placement mode works
- [ ] Test on desktop - arrow buttons hidden
- [ ] Test on desktop - keyboard still works

---

## Overview
Add touch support for mobile devices while maintaining identical UI layout to desktop. The game should look and function the same on both platforms, built together as a unified codebase.

## Design Principles
- **Unified Layout**: Menu stays at top center, same as desktop
- **Same Codebase**: No separate mobile/desktop branches
- **Touch + Mouse**: Both input types work simultaneously
- **Minimal Changes**: Leverage BabylonJS built-in pointer handling

---

## 1. Touch Input System

### Current State
- Mouse-based input for targeting and placement
- Keyboard (A/D) for camera movement
- Click-to-select UI buttons

### Required Changes

#### A. Pointer Event Unification
BabylonJS already abstracts mouse/touch via pointer events. We just need to:
- Ensure all pointer handlers work with touch
- Add touch-specific camera panning (since no keyboard on mobile)

#### B. Touch Gestures
- **Tap**: Select/place objects (already works via pointer events)
- **Hold arrow buttons**: Pan camera left/right (replaces A/D keys)

#### C. On-Screen Camera Controls
- Left arrow button in bottom-left corner
- Right arrow button in bottom-right corner
- Hold to pan continuously (same behavior as A/D keys)
- Only visible on touch devices
- Semi-transparent so they don't obstruct gameplay

---

## 2. UI Layout (Unified)

### Same Layout for All Devices
```
┌────────────────────────────────────────────────┐
│            ┌─────────────────────┐             │
│  [Coins]   │ Egg │ Seed │Building│   [Debug]  │
│            └─────────────────────┘             │
│                    ┌───────┐                   │
│                    │Turret │ <- Submenu slides │
│                    │Armory │    down from      │
│                    └───────┘    Building btn   │
│                                                │
│                 GAME VIEWPORT                  │
│                                                │
│                                                │
│  ┌───┐                                 ┌───┐  │
│  │ ◄ │                                 │ ► │  │
│  └───┘                                 └───┘  │
│    ^-- Mobile only: touch to pan camera --^   │
└────────────────────────────────────────────────┘
```

### Scaling Strategy
- UI elements use relative sizing (works on any screen)
- BabylonJS GUI scales automatically with canvas
- Touch targets already meet 44px minimum (buttons are 60px)

---

## 3. Implementation Tasks

### Task 1: Add Mobile Meta Tags
Update `index.html` with viewport and mobile-specific tags.

### Task 2: Add On-Screen Arrow Buttons
Update `UIManager.js` to:
- Detect if device has touch capability
- Create left/right arrow buttons in bottom corners
- Buttons trigger camera pan while held (same as A/D keys)
- Semi-transparent design (alpha ~0.5)

### Task 3: Wire Arrow Buttons to Camera
Update `CameraController.js` to:
- Expose methods for left/right panning
- UIManager calls these methods while buttons are held

### Task 4: Prevent Mobile Browser Behaviors
Add CSS to prevent:
- Pull-to-refresh
- Pinch-to-zoom on page
- Text selection
- Context menu on long press

### Task 5: Test & Verify
- Confirm pointer events work for touch
- Verify UI buttons respond to tap
- Test placement mode with touch
- Check submenu works on touch
- Verify arrow buttons pan camera smoothly

---

## 4. File Changes

| File | Changes |
|------|---------|
| `index.html` | Add mobile meta tags, CSS rules |
| `src/ui/UIManager.js` | Add mobile arrow buttons |
| `src/controllers/CameraController.js` | Expose pan methods for UI buttons |

---

## 5. Code Changes

### index.html - Add to `<head>`
```html
<meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no, viewport-fit=cover">
<meta name="apple-mobile-web-app-capable" content="yes">
<meta name="mobile-web-app-capable" content="yes">
```

### index.html - Add to `<style>`
```css
html, body {
    overflow: hidden;
    width: 100%;
    height: 100%;
    margin: 0;
    padding: 0;
    touch-action: none;
    overscroll-behavior: none;
    user-select: none;
    -webkit-user-select: none;
    -webkit-touch-callout: none;
}
```

### UIManager.js - Add Mobile Arrow Buttons
```javascript
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

    // Left arrow button
    const leftBtn = BABYLON.GUI.Button.CreateSimpleButton("leftArrow", "◄");
    leftBtn.width = "80px";
    leftBtn.height = "80px";
    leftBtn.color = "white";
    leftBtn.background = "rgba(60, 60, 70, 0.5)";
    leftBtn.cornerRadius = 15;
    leftBtn.thickness = 2;
    leftBtn.fontSize = 32;
    leftBtn.horizontalAlignment = BABYLON.GUI.Control.HORIZONTAL_ALIGNMENT_LEFT;
    leftBtn.verticalAlignment = BABYLON.GUI.Control.VERTICAL_ALIGNMENT_BOTTOM;
    leftBtn.left = "20px";
    leftBtn.top = "-20px";
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
    rightBtn.width = "80px";
    rightBtn.height = "80px";
    rightBtn.color = "white";
    rightBtn.background = "rgba(60, 60, 70, 0.5)";
    rightBtn.cornerRadius = 15;
    rightBtn.thickness = 2;
    rightBtn.fontSize = 32;
    rightBtn.horizontalAlignment = BABYLON.GUI.Control.HORIZONTAL_ALIGNMENT_RIGHT;
    rightBtn.verticalAlignment = BABYLON.GUI.Control.VERTICAL_ALIGNMENT_BOTTOM;
    rightBtn.left = "-20px";
    rightBtn.top = "-20px";
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
 * Get current panning state (called by CameraController)
 */
getPanDirection() {
    if (this.panningLeft) return -1;
    if (this.panningRight) return 1;
    return 0;
}
```

### CameraController.js - Add UI Pan Support
```javascript
/**
 * Set reference to UIManager for mobile controls
 */
setUIManager(uiManager) {
    this.uiManager = uiManager;
}

/**
 * Update - check both keyboard and UI controls
 */
update() {
    let moved = false;

    // Keyboard controls
    if (this.keysPressed['a']) {
        this.camera.target.x -= this.cameraSpeed;
        moved = true;
    }
    if (this.keysPressed['d']) {
        this.camera.target.x += this.cameraSpeed;
        moved = true;
    }

    // Mobile UI controls
    if (this.uiManager) {
        const panDir = this.uiManager.getPanDirection();
        if (panDir !== 0) {
            this.camera.target.x += panDir * this.cameraSpeed;
            moved = true;
        }
    }

    if (moved && this.onCameraMoveCallback) {
        this.onCameraMoveCallback(this.camera.target.x);
    }
}
```

---

## 6. Testing Checklist

- [ ] Menu buttons respond to tap
- [ ] Building submenu opens/closes on tap
- [ ] Placement mode works with touch
- [ ] Camera pans with finger drag
- [ ] No unwanted zooming/scrolling
- [ ] Works in both portrait and landscape
- [ ] Performance acceptable on mobile

---

## Notes

- BabylonJS pointer events handle both mouse and touch automatically
- Existing UI should work without modification (GUI handles touch)
- Main addition is touch-based camera control
- Keep it simple - same experience on all devices
