// src/utils/message.ts
// Simple utility if needed, otherwise integrate into components/hooks directly

interface StatusMessage {
  text: string;
  type: "info" | "error" | "success";
  timestamp?: number; // Optional timestamp
}

// Example function if you wanted a global message handler (not currently used)
export function showMessage(
  message: string,
  type: StatusMessage["type"],
  setMessageState: React.Dispatch<React.SetStateAction<StatusMessage | null>>,
  timeoutRef: React.MutableRefObject<number | null>,
  duration: number = 2500
): void {
  if (timeoutRef.current) clearTimeout(timeoutRef.current);
  setMessageState({ text: message, type, timestamp: Date.now() });
  timeoutRef.current = window.setTimeout(() => {
    setMessageState(null);
  }, duration);
}
