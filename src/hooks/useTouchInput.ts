// src/hooks/useTouchInput.ts
import { useState, useCallback, useEffect, RefObject } from "react";
import { ITouchState } from "../game/types";
import { initialTouchState } from "../game/state";
import { GAME_WIDTH, GAME_VIEW_HEIGHT, GAME_HEIGHT } from "../game/config";

type UseTouchStateResult = {
  touchState: ITouchState;
  enableTouchTracking: (value: boolean) => void;
};

// Helper function to check if an element or its ancestor is a button
function isEventTargetButton(target: EventTarget | null): boolean {
  if (!(target instanceof Element)) {
    return false;
  }
  // Check for button or any element with pointer-events: auto (like toolbar buttons)
  // or specific classes if needed. Let's stick to buttons for now.
  return target.closest("button") !== null;
}

/**
 * Hook to manage touch input state for the game canvas.
 * Attaches listeners to the container element.
 * @param containerRef - Ref object pointing to the Container DIV holding the Konva Stage.
 * @returns The current ITouchState.
 */
export function useTouchInput(
  containerRef: RefObject<HTMLDivElement | null> // Changed from CanvasElement to DivElement
): UseTouchStateResult {
  const [touchState, setTouchState] = useState<ITouchState>(initialTouchState);
  const [enabled, setEnabled] = useState(false);

  const enableTouchTracking = useCallback((value: boolean) => {
    if (!value) {
      setTouchState(initialTouchState);
    }
    setEnabled(value);
  }, []);

  const getTouchPosition = useCallback(
    (
      touch: Touch,
      container: HTMLDivElement // Changed from CanvasElement
    ): { x: number; y: number } | null => {
      const rect = container.getBoundingClientRect();
      // Konva stage internal size is fixed (GAME_WIDTH, GAME_HEIGHT)
      // We need to map client coordinates to the stage's coordinate system.
      // This assumes the stage is scaled via CSS using 'object-fit: contain'
      // within the container which uses flexbox centering.
      const stageWidth = GAME_WIDTH;
      const stageHeight = GAME_HEIGHT;
      const containerWidth = rect.width;
      const containerHeight = rect.height;

      const stageAspectRatio = stageWidth / stageHeight;
      const containerAspectRatio = containerWidth / containerHeight;

      let displayedWidth, displayedHeight, displayedX, displayedY;

      if (containerAspectRatio > stageAspectRatio) {
        // Container is wider than stage aspect ratio (letterboxed top/bottom)
        displayedHeight = containerHeight;
        displayedWidth = displayedHeight * stageAspectRatio;
        displayedX = rect.left + (containerWidth - displayedWidth) / 2;
        displayedY = rect.top;
      } else {
        // Container is taller than stage aspect ratio (pillarboxed left/right)
        displayedWidth = containerWidth;
        displayedHeight = displayedWidth / stageAspectRatio;
        displayedX = rect.left;
        displayedY = rect.top + (containerHeight - displayedHeight) / 2;
      }

      // Check if touch is outside the displayed stage area
      if (
        touch.clientX < displayedX ||
        touch.clientX > displayedX + displayedWidth ||
        touch.clientY < displayedY ||
        touch.clientY > displayedY + displayedHeight
      ) {
        // console.log("Touch outside displayed stage", {clientX: touch.clientX, clientY: touch.clientY, displayedX, displayedY, displayedWidth, displayedHeight});
        return null; // Touch is outside the effective stage bounds
      }

      // Calculate coordinates relative to the displayed stage top-left
      const relativeX = touch.clientX - displayedX;
      const relativeY = touch.clientY - displayedY;

      // Scale coordinates to the stage's internal resolution
      const scaleX = stageWidth / displayedWidth;
      const scaleY = stageHeight / displayedHeight;
      const x = relativeX * scaleX;
      const y = relativeY * scaleY;

      // Ignore touches outside the logical game area (Konva stage coords)
      // This might be redundant due to the check above, but acts as a safeguard.
      if (x < 0 || x > GAME_WIDTH || y < 0 || y > GAME_HEIGHT) {
        console.warn(
          "Calculated touch position outside stage bounds, should be clipped earlier.",
          { x, y }
        );
        return null;
      }

      return { x, y };
    },
    []
  );

  const handleTouchStart = useCallback(
    (event: TouchEvent) => {
      if (!containerRef.current) return;
      const container = containerRef.current;

      // *** Check if the touch started on a button ***
      if (isEventTargetButton(event.target)) {
        // console.log("Touch started on a button, ignoring for game controls."); // Debug
        return; // Do not interfere with button clicks
      }

      // *** If not on a button, proceed with game control logic ***
      event.preventDefault(); // Prevent default actions like scrolling ONLY for game controls
      const touches = event.changedTouches;

      setTouchState((prevState) => {
        const newState = { ...prevState }; // Shallow copy previous state

        for (let i = 0; i < touches.length; i++) {
          const touch = touches[i];
          const pos = getTouchPosition(touch, container);
          if (!pos) continue; // Ignore touch if outside effective stage bounds

          // Movement touch (left side, below HUD)
          if (
            pos.x < GAME_WIDTH / 2 &&
            pos.y < GAME_VIEW_HEIGHT &&
            !newState.move.active
          ) {
            newState.move = {
              active: true,
              id: touch.identifier,
              startX: pos.x,
              startY: pos.y,
              currentX: pos.x,
              currentY: pos.y,
            };
          }
          // Shooting touch (right side, below HUD)
          else if (
            pos.x >= GAME_WIDTH / 2 &&
            pos.y < GAME_VIEW_HEIGHT &&
            !newState.shoot.active
          ) {
            newState.shoot = {
              active: true,
              id: touch.identifier,
              x: pos.x,
              y: pos.y,
            };
          }
        }
        return newState; // Return the potentially updated state
      });
    },
    [containerRef, getTouchPosition]
  );

  const handleTouchMove = useCallback(
    (event: TouchEvent) => {
      if (!containerRef.current) return;
      const container = containerRef.current;
      const touches = event.changedTouches;

      let preventDefaultCalled = false; // Track if preventDefault was called for this event

      setTouchState((prevState) => {
        let stateChanged = false;
        let nextMoveState = prevState.move;
        let nextShootState = prevState.shoot;

        for (let i = 0; i < touches.length; i++) {
          const touch = touches[i];
          const touchId = touch.identifier;

          // Check if this touch corresponds to an active game control
          const isMoveTouch =
            prevState.move.active && prevState.move.id === touchId;
          const isShootTouch =
            prevState.shoot.active && prevState.shoot.id === touchId;

          if (isMoveTouch || isShootTouch) {
            // Only prevent default if we are actually handling this touch for game control
            if (!preventDefaultCalled) {
              event.preventDefault();
              preventDefaultCalled = true;
            }

            const pos = getTouchPosition(touch, container);
            const touchIsOffStage = pos === null;

            if (isMoveTouch) {
              if (touchIsOffStage) {
                nextMoveState = { ...initialTouchState.move };
              } else {
                nextMoveState = {
                  ...prevState.move,
                  currentX: pos.x,
                  currentY: pos.y,
                };
              }
              stateChanged = true;
            } else if (isShootTouch) {
              if (touchIsOffStage || (pos && pos.y >= GAME_VIEW_HEIGHT)) {
                nextShootState = { ...initialTouchState.shoot };
              } else {
                nextShootState = { ...prevState.shoot, x: pos.x, y: pos.y };
              }
              stateChanged = true;
            }
          }
        }

        // Only return a new state object if something actually changed
        return stateChanged
          ? { ...prevState, move: nextMoveState, shoot: nextShootState }
          : prevState;
      });
    },
    [containerRef, getTouchPosition]
  );

  const handleTouchEnd = useCallback(
    (event: TouchEvent) => {
      if (!containerRef.current) return;

      let preventDefaultCalled = false;

      // Need to determine if the ending touch was a game touch *before* preventDefault
      const touches = event.changedTouches;
      let nextState = touchState; // Start with current state

      for (let i = 0; i < touches.length; i++) {
        const touch = touches[i];
        const touchId = touch.identifier;

        const isMoveTouch =
          nextState.move.active && nextState.move.id === touchId;
        const isShootTouch =
          nextState.shoot.active && nextState.shoot.id === touchId;

        if (isMoveTouch || isShootTouch) {
          if (!preventDefaultCalled) {
            event.preventDefault(); // Prevent default for the ended game touch
            preventDefaultCalled = true;
          }
          // Update the state locally to reset the ended touch
          nextState = {
            ...nextState,
            move: isMoveTouch ? { ...initialTouchState.move } : nextState.move,
            shoot: isShootTouch
              ? { ...initialTouchState.shoot }
              : nextState.shoot,
          };
        }
      }

      // Apply the accumulated state changes
      if (nextState !== touchState) {
        setTouchState(nextState);
      }
    },
    [containerRef, touchState] // Depend on touchState to check active touches
  );

  const containerElement = containerRef?.current;
  useEffect(() => {
    const currentElement = containerElement; // Capture ref value
    if (!currentElement || !enabled) {
      return;
    }
    const options = { passive: false };
    currentElement.addEventListener("touchstart", handleTouchStart, options);
    currentElement.addEventListener("touchmove", handleTouchMove, options);
    currentElement.addEventListener("touchend", handleTouchEnd, options);
    currentElement.addEventListener("touchcancel", handleTouchEnd, options);

    // Cleanup function
    return () => {
      currentElement.removeEventListener("touchstart", handleTouchStart);
      currentElement.removeEventListener("touchmove", handleTouchMove);
      currentElement.removeEventListener("touchend", handleTouchEnd);
      currentElement.removeEventListener("touchcancel", handleTouchEnd);
    };
  }, [
    containerElement,
    handleTouchStart,
    handleTouchMove,
    handleTouchEnd,
    enabled,
  ]);

  return {
    touchState,
    enableTouchTracking,
  };
}
