// src/hooks/useGameLoop.ts
import { useRef, useEffect, useCallback } from "react";
import { UpdateCallback } from "../game/types";

/**
 * Custom hook to manage the game loop using requestAnimationFrame.
 * @param onUpdate - The callback function to execute on each frame. Receives deltaTime and timestamp.
 * @param isRunning - Boolean indicating if the loop should be running.
 */
export function useGameLoop(
  onUpdate: UpdateCallback | null,
  isRunning: boolean = true
): void {
  const animationFrameId = useRef<number | null>(null);
  const lastTimeRef = useRef<number>(performance.now());
  const onUpdateRef = useRef(onUpdate);

  // Keep the callback reference up-to-date without restarting the loop effect
  useEffect(() => {
    onUpdateRef.current = onUpdate;
  }, [onUpdate]);

  const loop = useCallback((timestamp: number) => {
    const deltaTime = timestamp - lastTimeRef.current;
    lastTimeRef.current = timestamp;

    // Execute the update callback if provided
    if (onUpdateRef.current) {
      onUpdateRef.current(deltaTime, timestamp);
    }

    // Continue the loop
    animationFrameId.current = requestAnimationFrame(loop);
  }, []); // No dependencies, relies on refs

  useEffect(() => {
    if (isRunning) {
      console.log("Starting game loop...");
      lastTimeRef.current = performance.now(); // Reset time when starting
      animationFrameId.current = requestAnimationFrame(loop);
    } else {
      console.log("Stopping game loop...");
      if (animationFrameId.current !== null) {
        cancelAnimationFrame(animationFrameId.current);
        animationFrameId.current = null;
      }
    }

    // Cleanup function to cancel animation frame when component unmounts or isRunning changes to false
    return () => {
      if (animationFrameId.current !== null) {
        cancelAnimationFrame(animationFrameId.current);
        console.log("Cleaned up game loop.");
      }
    };
  }, [isRunning, loop]); // Depend on isRunning and the stable loop callback
}
