import { useState, useRef, useEffect } from "react";
import { invoke } from "@tauri-apps/api/core";
import { Sidebar } from "./components/shared";
import { ChatInput, ChatMessage, Message } from "./components/features/chat";
import { ModelLoader } from "./components/features/model";

interface ModelInfo {
  name: string;
  path: string;
  size_bytes: number;
  size_display: string;
  quantization: string | null;
  loaded: boolean;
}

interface InferenceResult {
  text: string;
  tokens_generated: number;
}

function App() {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [messages, setMessages] = useState<Message[]>([]);
  const [modelLoaded, setModelLoaded] = useState(false);
  const [isGenerating, setIsGenerating] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  const handleModelLoaded = (info: ModelInfo) => {
    setModelLoaded(true);
    console.log("Model loaded:", info.name);
  };

  const handleModelUnloaded = () => {
    setModelLoaded(false);
    console.log("Model unloaded");
  };

  const handleSendMessage = async (content: string) => {
    const userMessage: Message = {
      id: crypto.randomUUID(),
      role: "user",
      content,
      timestamp: new Date(),
    };

    setMessages((prev) => [...prev, userMessage]);

    if (!modelLoaded) {
      const assistantMessage: Message = {
        id: crypto.randomUUID(),
        role: "assistant",
        content: "Please load a GGUF model first using the sidebar to start chatting with AI.",
        timestamp: new Date(),
      };
      setMessages((prev) => [...prev, assistantMessage]);
      return;
    }

    setIsGenerating(true);
    
    try {
      const result = await invoke<InferenceResult>("generate_response", {
        prompt: content,
        maxTokens: 512,
      });
      
      const assistantMessage: Message = {
        id: crypto.randomUUID(),
        role: "assistant",
        content: result.text || "No response generated.",
        timestamp: new Date(),
      };
      setMessages((prev) => [...prev, assistantMessage]);
    } catch (e) {
      const errorMessage: Message = {
        id: crypto.randomUUID(),
        role: "assistant",
        content: `Error generating response: ${e}`,
        timestamp: new Date(),
      };
      setMessages((prev) => [...prev, errorMessage]);
    } finally {
      setIsGenerating(false);
    }
  };

  return (
    <div className="flex h-screen bg-base">
      {/* Sidebar */}
      <Sidebar
        isOpen={sidebarOpen}
        onToggle={() => setSidebarOpen(!sidebarOpen)}
      >
        <ModelLoader
          onModelLoaded={handleModelLoaded}
          onModelUnloaded={handleModelUnloaded}
        />
      </Sidebar>

      {/* Main Content */}
      <main className="flex-1 flex flex-col min-w-0">
        {/* Header */}
        <header className="flex items-center gap-4 p-4 border-b border-tertiary bg-base">
          <button
            onClick={() => setSidebarOpen(!sidebarOpen)}
            className="p-2 rounded-lg hover:bg-base-secondary transition-colors lg:hidden"
          >
            <svg
              xmlns="http://www.w3.org/2000/svg"
              width="24"
              height="24"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <line x1="3" y1="12" x2="21" y2="12" />
              <line x1="3" y1="6" x2="21" y2="6" />
              <line x1="3" y1="18" x2="21" y2="18" />
            </svg>
          </button>
          <h2 className="text-lg font-semibold text-content">Chat</h2>
        </header>

        {/* Messages Area */}
        <div className="flex-1 overflow-y-auto custom-scrollbar p-4">
          {messages.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-full text-center">
              <div className="w-16 h-16 mb-4 rounded-full bg-primary/20 flex items-center justify-center">
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  width="32"
                  height="32"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  className="text-primary"
                >
                  <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
                </svg>
              </div>
              <h3 className="text-xl font-semibold text-content mb-2">
                Welcome to LocalHands
              </h3>
              <p className="text-basic max-w-md">
                Your local AI assistant powered by Tauri. Start a conversation
                to get help with coding, writing, analysis, and more.
              </p>
            </div>
          ) : (
            <div className="max-w-3xl mx-auto">
              {messages.map((message) => (
                <ChatMessage key={message.id} message={message} />
              ))}
              <div ref={messagesEndRef} />
            </div>
          )}
        </div>

        {/* Input Area */}
        <div className="p-4 border-t border-tertiary bg-base">
          <div className="max-w-3xl mx-auto">
            <ChatInput
              onSend={handleSendMessage}
              disabled={isGenerating}
              placeholder={isGenerating ? "Generating response..." : (modelLoaded ? "Message LocalHands..." : "Load a model to start chatting...")}
            />
          </div>
        </div>
      </main>
    </div>
  );
}

export default App;
