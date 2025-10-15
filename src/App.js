import React, { useState, useEffect, useRef } from "react";
import axios from "axios";
import "./App.css";

function App() {
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [sessionId] = useState(
    () => `session_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`
  );

  const messagesEndRef = useRef(null);

  // Replace with your n8n webhook URL
  const WEBHOOK_URL =
    "https://travel2026.app.n8n.cloud/webhook/ba34c0ab-9dcc-4f49-bd09-dffd78c607ea";

  // Auto-scroll to bottom when messages change
  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();

    if (!input.trim()) return;

    // Create user message
    const userMessage = {
      id: Date.now(),
      text: input,
      sender: "user",
      timestamp: new Date().toISOString(),
    };

    setMessages((prev) => [...prev, userMessage]);
    const currentInput = input;
    setInput("");
    setLoading(true);
    setError(null);

    try {
      const response = await axios.post(
        WEBHOOK_URL,
        {
          action: "sendMessage",
          chatInput: currentInput,
          sessionId: sessionId,
        },
        {
          headers: {
            "Content-Type": "application/json",
          },
          timeout: 120000, // 2 minutes timeout for AI processing
        }
      );

      // Check if response has data
      if (!response.data) {
        throw new Error("No response from server");
      }

      // Extract message from various possible response formats
      let aiMessageText =
        response.data.message ||
        response.data.output ||
        response.data.text ||
        response.data.response ||
        JSON.stringify(response.data);

      // If response is stringified JSON, try to parse it
      if (typeof aiMessageText === "string" && aiMessageText.startsWith("{")) {
        try {
          const parsed = JSON.parse(aiMessageText);
          aiMessageText =
            parsed.message || parsed.output || parsed.text || aiMessageText;
        } catch (e) {
          // Keep original if parsing fails
        }
      }

      // Create AI response message
      const aiMessage = {
        id: Date.now() + 1,
        text: aiMessageText,
        sender: "ai",
        timestamp: new Date().toISOString(),
      };

      setMessages((prev) => [...prev, aiMessage]);
    } catch (err) {
      console.error("Error:", err);

      let errorText = "Sorry, I encountered an error. Please try again.";

      if (err.code === "ECONNABORTED") {
        errorText =
          "Request timed out. The AI is taking too long to respond. Please try a simpler query.";
      } else if (err.response?.status === 404) {
        errorText =
          "Webhook not found. Please check the n8n workflow configuration.";
      } else if (err.response?.status === 500) {
        errorText = "Server error. Please check the n8n workflow for issues.";
      } else if (!navigator.onLine) {
        errorText = "No internet connection. Please check your network.";
      }

      setError(err.message || "Failed to send message");

      const errorMessage = {
        id: Date.now() + 1,
        text: errorText,
        sender: "ai",
        timestamp: new Date().toISOString(),
        isError: true,
      };

      setMessages((prev) => [...prev, errorMessage]);
    } finally {
      setLoading(false);
    }
  };

  const handleKeyDown = (e) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSubmit(e);
    }
  };

  const clearChat = () => {
    setMessages([]);
    setError(null);
  };

  return (
    <div className="app">
      <div className="chat-container">
        <div className="chat-header">
          <div className="header-content">
            <h1>🏨 AI Hotel Assistant</h1>
            <p>Ask me anything about hotels and travel!</p>
          </div>
          {messages.length > 0 && (
            <button
              className="clear-button"
              onClick={clearChat}
              title="Clear chat"
            >
              🗑️
            </button>
          )}
        </div>

        <div className="messages-container">
          {messages.length === 0 && (
            <div className="welcome-message">
              <div className="welcome-icon">👋</div>
              <h2>Welcome to AI Hotel Assistant</h2>
              <p>
                I can help you find hotels, compare prices, and answer travel
                questions.
              </p>
              <div className="example-queries">
                <h3>Try asking:</h3>
                <div className="query-chips">
                  <button
                    onClick={() => setInput("I need a room")}
                    className="chip"
                  >
                    🏨 I need a room
                  </button>
                  <button
                    onClick={() => setInput("Hotels in Mumbai under 3000")}
                    className="chip"
                  >
                    💰 Hotels in Mumbai under 3000
                  </button>
                  <button
                    onClick={() => setInput("Best hotels near airport")}
                    className="chip"
                  >
                    ✈️ Best hotels near airport
                  </button>
                </div>
              </div>
            </div>
          )}

          {messages.map((msg) => (
            <div
              key={msg.id}
              className={`message ${msg.sender} ${msg.isError ? "error" : ""}`}
            >
              <div className="message-avatar">
                {msg.sender === "user" ? "👤" : "🤖"}
              </div>
              <div className="message-content">
                <div className="message-text">{msg.text}</div>
                <div className="message-time">
                  {new Date(msg.timestamp).toLocaleTimeString([], {
                    hour: "2-digit",
                    minute: "2-digit",
                  })}
                </div>
              </div>
            </div>
          ))}

          {loading && (
            <div className="message ai">
              <div className="message-avatar">🤖</div>
              <div className="message-content">
                <div className="typing-indicator">
                  <span></span>
                  <span></span>
                  <span></span>
                </div>
              </div>
            </div>
          )}

          <div ref={messagesEndRef} />
        </div>

        <div className="input-container">
          {error && (
            <div className="error-banner">
              <span className="error-icon">⚠️</span>
              <span className="error-text">{error}</span>
              <button className="error-close" onClick={() => setError(null)}>
                ✕
              </button>
            </div>
          )}

          <form onSubmit={handleSubmit} className="input-form">
            <input
              type="text"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="Type your message..."
              disabled={loading}
              className="message-input"
              autoFocus
            />
            <button
              type="submit"
              disabled={loading || !input.trim()}
              className="send-button"
              title="Send message"
            >
              {loading ? "⏳" : "📤"}
            </button>
          </form>

          <div className="footer-info">
            <small>Session ID: {sessionId.substring(0, 20)}...</small>
          </div>
        </div>
      </div>
    </div>
  );
}

export default App;
