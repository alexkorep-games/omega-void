// src/hooks/useTouchInput.ts
import { useState, useCallback, useEffect, RefObject } from "react";
import { ITouchState } from "../game/types";
import { initialTouchState } from "../game/state";
import { GAME_WIDTH, GAME_VIEW_HEIGHT, GAME_HEIGHT } from "../game/config";

type UseTouchStateResult = {
  touchState: ITouchState;
  resetTouchState: () => void;
};

/**
 * Hook to manage touch input state for the game canvas.
 * @param containerRef - Ref object pointing to the Container DIV holding the Konva Stage.
 * @returns The current ITouchState.
 */
export function useTouchInput(
  containerRef: RefObject<HTMLDivElement | null> // Changed from CanvasElement to DivElement
): UseTouchStateResult {
  const [touchState, setTouchState] = useState<ITouchState>(initialTouchState);

  const resetTouchState = useCallback(() => {
    // console.log("Resetting touch state..."); // Less noisy
    setTouchState(initialTouchState);
  }, []);

  const getTouchPosition = useCallback(
    (
      touch: Touch,
      container: HTMLDivElement // Changed from CanvasElement
    ): { x: number; y: number } | null => {
      const rect = container.getBoundingClientRect();
      // Konva stage internal size is fixed (GAME_WIDTH, GAME_HEIGHT)
      // We need to map client coordinates to the stage's coordinate system.
      // This assumes the stage is scaled via CSS using 'object-fit: contain'.
      // Calculate the actual displayed size and position respecting aspect ratio.
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

      // Original calculation (assumed canvas matched container, incorrect for scaled stages)
      // const scaleX = GAME_WIDTH / rect.width;
      // const scaleY = GAME_HEIGHT / rect.height;
      // const x = (touch.clientX - rect.left) * scaleX;
      // const y = (touch.clientY - rect.top) * scaleY;

      // Ignore touches outside the game area (Konva stage coords)
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
      event.preventDefault(); // Prevent default actions like scrolling
      const container = containerRef.current;
      const touches = event.changedTouches;

      setTouchState((prevState) => {
        const newState = { ...prevState }; // Shallow copy previous state

        for (let i = 0; i < touches.length; i++) {
          const touch = touches[i];
          const pos = getTouchPosition(touch, container);
          if (!pos) continue; // Ignore touch if outside canvas bounds

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
      event.preventDefault();
      const container = containerRef.current;
      const touches = event.changedTouches;

      setTouchState((prevState) => {
        // Create a modifiable copy only if necessary
        let stateChanged = false;
        let nextMoveState = prevState.move;
        let nextShootState = prevState.shoot;

        for (let i = 0; i < touches.length; i++) {
          const touch = touches[i];
          // Calculate position *relative to the container div*
          const pos = getTouchPosition(touch, container);
          // If touch moves off the effective stage area, getTouchPosition returns null
          const touchIsOffStage = pos === null;

          // Update movement touch position
          if (prevState.move.active && touch.identifier === prevState.move.id) {
            if (touchIsOffStage) {
              // If finger slides off stage, treat it as ending the move touch
              nextMoveState = { ...initialTouchState.move };
              console.log("Move touch ended (finger off stage)");
            } else {
              nextMoveState = {
                ...prevState.move,
                currentX: pos.x,
                currentY: pos.y,
              };
            }
            stateChanged = true;
          }
          // Update shooting touch position (only if still in game view)
          else if (
            prevState.shoot.active &&
            touch.identifier === prevState.shoot.id
          ) {
            if (touchIsOffStage || pos.y >= GAME_VIEW_HEIGHT) {
              // If finger slides off stage OR into HUD area, deactivate shooting
              nextShootState = { ...initialTouchState.shoot };
              console.log("Shoot touch ended (finger off stage or in HUD)");
            } else {
              nextShootState = { ...prevState.shoot, x: pos.x, y: pos.y };
            }
            stateChanged = true;
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
      event.preventDefault();
      const touches = event.changedTouches;

      setTouchState((prevState) => {
        let stateChanged = false;
        let nextMoveState = prevState.move;
        let nextShootState = prevState.shoot;

        for (let i = 0; i < touches.length; i++) {
          const touch = touches[i];
          if (prevState.move.active && touch.identifier === prevState.move.id) {
            nextMoveState = { ...initialTouchState.move }; // Reset move state
            stateChanged = true;
            console.log("Move touch ended (touchend)");
          }
          if (
            prevState.shoot.active &&
            touch.identifier === prevState.shoot.id
          ) {
            nextShootState = { ...initialTouchState.shoot }; // Reset shoot state
            stateChanged = true;
            console.log("Shoot touch ended (touchend)");
          }
        }
        return stateChanged
          ? { ...prevState, move: nextMoveState, shoot: nextShootState }
          : prevState;
      });
    },
    [containerRef]
  ); // No dependency on getTouchPosition here

  const containerElement = containerRef?.current;
  useEffect(() => {
    if (containerElement) {
      // Use passive: false to allow preventDefault()
      const options = { passive: false };
      containerElement.addEventListener(
        "touchstart",
        handleTouchStart,
        options
      );
      containerElement.addEventListener("touchmove", handleTouchMove, options);
      containerElement.addEventListener("touchend", handleTouchEnd, options);
      containerElement.addEventListener("touchcancel", handleTouchEnd, options); // Treat cancel same as end

      // Cleanup function
      return () => {
        containerElement.removeEventListener("touchstart", handleTouchStart);
        containerElement.removeEventListener("touchmove", handleTouchMove);
        containerElement.removeEventListener("touchend", handleTouchEnd);
        containerElement.removeEventListener("touchcancel", handleTouchEnd);
      };
    }
  }, [handleTouchStart, handleTouchMove, handleTouchEnd, containerElement]);

  return {
    touchState,
    resetTouchState,
  };
}
