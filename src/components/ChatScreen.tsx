// src/components/ChatScreen.tsx
import React, { useEffect, useRef } from "react";
// If you defined ChatMessage in types.ts:
import { ChatMessage } from "../game/types";
import "./ChatScreen.css"; // Import the CSS

/*
// If you prefer to define the type locally:
interface ChatMessage {
    id: string | number;
    sender: 'user' | 'ai';
    text: string;
}
*/

interface ChatScreenProps {
  messages: ChatMessage[];
  title?: string; // Optional title for the header
}

const ChatScreen: React.FC<ChatScreenProps> = ({
  messages = [], // Default to empty array
  title = "COMMUNICATIONS LOG",
}) => {
  const messagesEndRef = useRef<HTMLDivElement | null>(null);

  // Automatically scroll to the bottom when messages change
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  return (
    // Reuse market-container structure for consistency
    <div className="market-container chat-screen">
      {/* Header */}
      <div className="market-header chat-header">
        <div className="market-title">{title}</div>
        {/* Optional: Add other info like time or status here */}
      </div>

      {/* Message Area */}
      <div className="chat-messages-area">
        {messages.length === 0 ? (
          <div className="chat-empty-message">-- No messages --</div>
        ) : (
          messages.map((message) => (
            <div
              key={message.id}
              className={`chat-message ${
                message.sender === "user" ? "user-message" : "ai-message"
              }`}
            >
              <div className="message-text">{message.text}</div>
              <span className="message-sender-label">{message.sender}</span>
            </div>
          ))
        )}
        {/* Dummy div to help scroll to bottom */}
        <div ref={messagesEndRef} />
      </div>

      <div className="market-footer chat-footer">
        <span>End of log.</span>
      </div>
    </div>
  );
};

export default ChatScreen;
