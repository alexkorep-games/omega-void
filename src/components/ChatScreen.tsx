// src/components/ChatScreen.tsx
import React, { useEffect, useRef } from "react";
import { ChatMessage } from "../game/types"; // Type is already correct
import "./ChatScreen.css";

interface ChatScreenProps {
  messages: ChatMessage[]; // Expecting the processed ChatMessage[]
  title?: string;
}

const ChatScreen: React.FC<ChatScreenProps> = ({
  messages = [], // Default to empty array
  title = "COMMUNICATIONS LOG",
}) => {
  const messagesEndRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "instant" });
  }, [messages]);

  const getSenderLabel = (sender: ChatMessage["sender"]): string => {
    if (sender === "user") return "CMDR Bob";
    if (sender === "ai") return "Bot";
    if (sender === "system") return "System";
    return "Unknown";
  };

  return (
    <div className="market-container chat-screen">
      <div className="market-header chat-header">
        <div className="market-title">{title}</div>
      </div>

      <div className="chat-messages-area">
        {messages.length === 0 ? (
          <div className="chat-empty-message">-- No messages --</div>
        ) : (
          messages.map((message) => (
            <div
              key={message.id} // Use message.id (which comes from DialogEntry.id)
              className={`chat-message-container ${
                message.sender === "user"
                  ? "user-container"
                  : message.sender === "ai"
                  ? "ai-container"
                  : "system-container"
              }`}
            >
              {/* Userpic for Commander Bob */}
              {message.sender === "user" && (
                <div className="user-userpic">
                  <span>CB</span>
                </div>
              )}
              {/* No userpic for AI or System for now */}

              <div
                className={`chat-message ${
                  message.sender === "user"
                    ? "user-message"
                    : message.sender === "ai"
                    ? "ai-message"
                    : "system-message" // Class for system messages
                }`}
              >
                <div className="message-text">{message.text}</div>
                <span className="message-sender-label">
                  {getSenderLabel(message.sender)}
                </span>
              </div>
            </div>
          ))
        )}
        <div ref={messagesEndRef} />
      </div>

      <div className="market-footer chat-footer">
        <span>End of log.</span>
      </div>
    </div>
  );
};

export default ChatScreen;
