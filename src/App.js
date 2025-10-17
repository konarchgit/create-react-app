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

  // Voice recording states
  const [isListening, setIsListening] = useState(false);
  const [isSupported, setIsSupported] = useState(false);
  const recognitionRef = useRef(null);

  // Text-to-speech states
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [autoSpeak, setAutoSpeak] = useState(true); // Toggle auto-speak
  const synthRef = useRef(window.speechSynthesis);

  const messagesEndRef = useRef(null);

  const WEBHOOK_URL =
    "https://travel2026.app.n8n.cloud/webhook/ba34c0ab-9dcc-4f49-bd09-dffd78c607ea";

  // Initialize Speech Recognition
  useEffect(() => {
    const SpeechRecognition =
      window.SpeechRecognition || window.webkitSpeechRecognition;

    if (SpeechRecognition) {
      setIsSupported(true);
      const recognition = new SpeechRecognition();

      recognition.continuous = false;
      recognition.interimResults = true;
      recognition.lang = "en-US";

      recognition.onresult = (event) => {
        let interimTranscript = "";
        let finalTranscript = "";

        for (let i = event.resultIndex; i < event.results.length; i++) {
          const transcript = event.results[i][0].transcript;
          if (event.results[i].isFinal) {
            finalTranscript += transcript + " ";
          } else {
            interimTranscript += transcript;
          }
        }

        setInput(finalTranscript || interimTranscript);
      };

      recognition.onend = () => {
        setIsListening(false);
      };

      recognition.onerror = (event) => {
        console.error("Speech recognition error:", event.error);
        setError(`Voice recognition error: ${event.error}`);
        setIsListening(false);
      };

      recognitionRef.current = recognition;
    }
  }, []);

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  // Text-to-Speech function
  const speakText = (text) => {
    // Stop any ongoing speech
    if (synthRef.current.speaking) {
      synthRef.current.cancel();
    }

    const utterance = new SpeechSynthesisUtterance(text);

    // Configure speech settings
    utterance.rate = 1.0; // Speed (0.1 to 10)
    utterance.pitch = 1.0; // Pitch (0 to 2)
    utterance.volume = 1.0; // Volume (0 to 1)
    utterance.lang = "en-US"; // Language

    // Get available voices and select a preferred one
    const voices = synthRef.current.getVoices();
    if (voices.length > 0) {
      // You can filter for specific voices, e.g., Google UK English Female
      const preferredVoice = voices.find(
        (voice) =>
          voice.name.includes("Google") || voice.name.includes("Female")
      );
      if (preferredVoice) {
        utterance.voice = preferredVoice;
      }
    }

    // Event handlers
    utterance.onstart = () => {
      setIsSpeaking(true);
    };

    utterance.onend = () => {
      setIsSpeaking(false);
    };

    utterance.onerror = (event) => {
      console.error("Speech synthesis error:", event);
      setIsSpeaking(false);
    };

    // Speak the text
    synthRef.current.speak(utterance);
  };

  // Stop speaking
  const stopSpeaking = () => {
    if (synthRef.current.speaking) {
      synthRef.current.cancel();
      setIsSpeaking(false);
    }
  };

  // Toggle voice recording
  const toggleVoiceRecording = () => {
    if (!isSupported) {
      setError(
        "Voice recognition is not supported in your browser. Please use Chrome, Edge, or Safari."
      );
      return;
    }

    if (isListening) {
      recognitionRef.current?.stop();
      setIsListening(false);
    } else {
      setError(null);
      setInput("");
      recognitionRef.current?.start();
      setIsListening(true);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();

    if (!input.trim()) return;

    // Stop any ongoing speech when user sends a new message
    stopSpeaking();

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
          timeout: 120000,
        }
      );

      if (!response.data) {
        throw new Error("No response from server");
      }

      let aiMessageText =
        response.data.message ||
        response.data.output ||
        response.data.text ||
        response.data.response ||
        JSON.stringify(response.data);

      if (typeof aiMessageText === "string" && aiMessageText.startsWith("{")) {
        try {
          const parsed = JSON.parse(aiMessageText);
          aiMessageText =
            parsed.message || parsed.output || parsed.text || aiMessageText;
        } catch (e) {
          // Keep original if parsing fails
        }
      }

      const aiMessage = {
        id: Date.now() + 1,
        text: aiMessageText,
        sender: "ai",
        timestamp: new Date().toISOString(),
      };

      setMessages((prev) => [...prev, aiMessage]);

      // Automatically speak the AI response if autoSpeak is enabled
      if (autoSpeak) {
        // Small delay to ensure message is rendered
        setTimeout(() => {
          speakText(aiMessageText);
        }, 100);
      }
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
    stopSpeaking();
  };

  // Manual speak/stop for individual messages
  const handleSpeakMessage = (text) => {
    if (isSpeaking) {
      stopSpeaking();
    } else {
      speakText(text);
    }
  };

  return (
    <div className="app">
      <div className="chat-container">
        <div className="chat-header">
          <div className="header-content">
            <h1>🏨 AI Hotel Assistant</h1>
            <p>Ask me anything about hotels and travel!</p>
          </div>
          <div className="header-buttons">
            <button
              className={`auto-speak-button ${autoSpeak ? "active" : ""}`}
              onClick={() => setAutoSpeak(!autoSpeak)}
              title={autoSpeak ? "Disable auto-speak" : "Enable auto-speak"}
            >
              {autoSpeak ? "🔊" : "🔇"}
            </button>
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
                <div className="message-footer">
                  <div className="message-time">
                    {new Date(msg.timestamp).toLocaleTimeString([], {
                      hour: "2-digit",
                      minute: "2-digit",
                    })}
                  </div>
                  {msg.sender === "ai" && !msg.isError && (
                    <button
                      className="speak-button-small"
                      onClick={() => handleSpeakMessage(msg.text)}
                      title={
                        isSpeaking ? "Stop speaking" : "Speak this message"
                      }
                    >
                      {isSpeaking ? "⏹️" : "🔊"}
                    </button>
                  )}
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
              placeholder={
                isListening ? "Listening..." : "Type your message..."
              }
              disabled={loading}
              className="message-input"
              autoFocus
            />
            <button
              type="button"
              onClick={toggleVoiceRecording}
              disabled={loading}
              className={`voice-button ${isListening ? "listening" : ""}`}
              title={isListening ? "Stop recording" : "Start voice recording"}
            >
              {isListening ? "🔴" : "🎤"}
            </button>
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
            {isSpeaking && (
              <small className="speaking-indicator">🔊 Speaking...</small>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

export default App;
