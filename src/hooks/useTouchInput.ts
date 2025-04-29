// src/hooks/useTouchInput.ts
import { useState, useCallback, useEffect, RefObject } from "react";
import { ITouchState } from "../game/types";
import { initialTouchState } from "../game/state";
import { GAME_WIDTH, GAME_VIEW_HEIGHT } from "../game/config";

type UseTouchStateResult = {
  touchState: ITouchState;
  resetTouchState: () => void;
};

/**
 * Hook to manage touch input state for the game canvas.
 * @param canvasRef - Ref object pointing to the HTMLCanvasElement.
 * @returns The current ITouchState.
 */
export function useTouchInput(
  canvasRef: RefObject<HTMLCanvasElement | null>
): UseTouchStateResult {
  const [touchState, setTouchState] = useState<ITouchState>(initialTouchState);

  const resetTouchState = useCallback(() => {
    console.log("Resetting touch state...");
    setTouchState(initialTouchState);
  }, []);

  const getTouchPosition = useCallback(
    (
      touch: Touch,
      canvas: HTMLCanvasElement
    ): { x: number; y: number } | null => {
      const rect = canvas.getBoundingClientRect();
      // Important: Calculate coordinates relative to the canvas rendering size,
      // not the potentially scaled display size.
      const scaleX = canvas.width / rect.width;
      const scaleY = canvas.height / rect.height;
      const x = (touch.clientX - rect.left) * scaleX;
      const y = (touch.clientY - rect.top) * scaleY;

      // Ignore touches outside the game area (or handle differently if needed)
      // if (x < 0 || x > GAME_WIDTH || y < 0 || y > GAME_HEIGHT) {
      //     return null;
      // }
      return { x, y };
    },
    []
  );

  const handleTouchStart = useCallback(
    (event: TouchEvent) => {
      if (!canvasRef.current) return;
      event.preventDefault(); // Prevent default actions like scrolling
      const canvas = canvasRef.current;
      const touches = event.changedTouches;

      setTouchState((prevState) => {
        const newState = { ...prevState }; // Shallow copy previous state

        for (let i = 0; i < touches.length; i++) {
          const touch = touches[i];
          const pos = getTouchPosition(touch, canvas);
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
    [canvasRef, getTouchPosition]
  );

  const handleTouchMove = useCallback(
    (event: TouchEvent) => {
      if (!canvasRef.current) return;
      event.preventDefault();
      const canvas = canvasRef.current;
      const touches = event.changedTouches;

      setTouchState((prevState) => {
        // Create a modifiable copy only if necessary
        let stateChanged = false;
        let nextMoveState = prevState.move;
        let nextShootState = prevState.shoot;

        for (let i = 0; i < touches.length; i++) {
          const touch = touches[i];
          const pos = getTouchPosition(touch, canvas);
          if (!pos) continue; // Skip if touch moved off canvas

          // Update movement touch position
          if (prevState.move.active && touch.identifier === prevState.move.id) {
            nextMoveState = {
              ...prevState.move,
              currentX: pos.x,
              currentY: pos.y,
            };
            stateChanged = true;
          }
          // Update shooting touch position (only if still in game view)
          else if (
            prevState.shoot.active &&
            touch.identifier === prevState.shoot.id
          ) {
            if (pos.y < GAME_VIEW_HEIGHT) {
              nextShootState = { ...prevState.shoot, x: pos.x, y: pos.y };
              stateChanged = true;
            }
            // Optional: Handle finger sliding into HUD (e.g., deactivate shooting)
            // else if (prevState.shoot.active && touch.identifier === prevState.shoot.id) {
            //     nextShootState = { ...initialTouchState.shoot }; // Deactivate shooting
            //     stateChanged = true;
            // }
          }
        }

        // Only return a new state object if something actually changed
        return stateChanged
          ? { ...prevState, move: nextMoveState, shoot: nextShootState }
          : prevState;
      });
    },
    [canvasRef, getTouchPosition]
  );

  const handleTouchEnd = useCallback(
    (event: TouchEvent) => {
      if (!canvasRef.current) return;
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
          }
          if (
            prevState.shoot.active &&
            touch.identifier === prevState.shoot.id
          ) {
            nextShootState = { ...initialTouchState.shoot }; // Reset shoot state
            stateChanged = true;
          }
        }
        return stateChanged
          ? { ...prevState, move: nextMoveState, shoot: nextShootState }
          : prevState;
      });
    },
    [canvasRef]
  ); // No dependency on getTouchPosition here

  const canvasElement = canvasRef?.current;
  useEffect(() => {
    if (canvasElement) {
      // Use passive: false to allow preventDefault()
      const options = { passive: false };
      canvasElement.addEventListener("touchstart", handleTouchStart, options);
      canvasElement.addEventListener("touchmove", handleTouchMove, options);
      canvasElement.addEventListener("touchend", handleTouchEnd, options);
      canvasElement.addEventListener("touchcancel", handleTouchEnd, options); // Treat cancel same as end

      // Cleanup function
      return () => {
        canvasElement.removeEventListener("touchstart", handleTouchStart);
        canvasElement.removeEventListener("touchmove", handleTouchMove);
        canvasElement.removeEventListener("touchend", handleTouchEnd);
        canvasElement.removeEventListener("touchcancel", handleTouchEnd);
      };
    }
  }, [handleTouchStart, handleTouchMove, handleTouchEnd, canvasElement]);

  return {
    touchState,
    resetTouchState,
  };
}
