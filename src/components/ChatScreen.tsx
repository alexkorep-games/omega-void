// src/components/ChatScreen.tsx
import React, { useEffect, useRef } from "react";
import { ChatMessage } from "../game/types"; // Assuming type is here
import "./ChatScreen.css";

interface ChatScreenProps {
  messages: ChatMessage[];
  title?: string;
}

const ChatScreen: React.FC<ChatScreenProps> = ({
  messages = [],
  title = "COMMUNICATIONS LOG",
}) => {
  const messagesEndRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

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
              key={message.id}
              className={`chat-message-container ${
                // Add a container for flex layout
                message.sender === "user" ? "user-container" : "ai-container"
              }`}
            >
              {/* Conditionally render the userpic for AI messages */}
              {message.sender === "user" && (
                <div className="user-userpic">
                  <span>HM</span> {/* Wrap text in span for centering */}
                </div>
              )}
              <div
                // Move classes to the inner message bubble
                className={`chat-message ${
                  message.sender === "user" ? "user-message" : "ai-message"
                }`}
              >
                <div className="message-text">{message.text}</div>
                <span className="message-sender-label">{message.sender}</span>
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
