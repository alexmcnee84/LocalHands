import { useState, useRef, useEffect } from "react";
import { invoke } from "@tauri-apps/api/core";
import { ChatInput, Message } from "./components/features/chat";
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
  const [messages, setMessages] = useState<Message[]>([]);
  const [modelLoaded, setModelLoaded] = useState(false);
  const [currentModel, setCurrentModel] = useState<ModelInfo | null>(null);
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
    setCurrentModel(info);
    console.log("Model loaded:", info.name);
  };

  const handleModelUnloaded = () => {
    setModelLoaded(false);
    setCurrentModel(null);
    console.log("Model unloaded");
  };

  const handleNewChat = () => {
    setMessages([]);
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
        content: "Please load a GGUF model first using the sidebar to start chatting.",
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
    <div className="h-screen w-screen bg-app-gradient text-slate-100 flex flex-col">
      {/* Top Bar */}
      <header className="topbar-bg h-12 flex items-center justify-center">
        <h1 className="text-sm font-medium tracking-[0.3em] uppercase text-cyan-300/80">
          LocalHands
        </h1>
      </header>

      {/* Main Area */}
      <div className="flex flex-1 overflow-hidden">
        {/* Left Sidebar */}
        <aside className="sidebar-bg w-72 flex flex-col p-4 gap-4">
          {/* New Chat Button */}
          <button
            onClick={handleNewChat}
            className="glow-button w-full py-3 rounded-xl font-medium text-sm flex items-center justify-center gap-2"
          >
            <svg
              xmlns="http://www.w3.org/2000/svg"
              width="18"
              height="18"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <line x1="12" y1="5" x2="12" y2="19" />
              <line x1="5" y1="12" x2="19" y2="12" />
            </svg>
            New Chat
          </button>

          {/* Current Model Display */}
          {currentModel && (
            <div className="glow-panel p-4 space-y-2">
              <div className="flex items-center gap-2">
                <div className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
                <span className="text-xs font-medium text-cyan-200 uppercase tracking-wider">
                  Active Model
                </span>
              </div>
              <div className="text-sm font-semibold text-slate-100 truncate" title={currentModel.name}>
                {currentModel.name}
              </div>
              <div className="flex justify-between text-xs text-slate-400">
                <span>{currentModel.size_display}</span>
                {currentModel.quantization && (
                  <span className="text-cyan-400">{currentModel.quantization}</span>
                )}
              </div>
            </div>
          )}

          {/* Model Loader */}
          <div className="glow-panel p-4">
            <ModelLoader
              onModelLoaded={handleModelLoaded}
              onModelUnloaded={handleModelUnloaded}
            />
          </div>
        </aside>

        {/* Center Chat Column */}
        <div className="flex-1 flex flex-col items-center">
          {/* Chat Messages Area */}
          <div className="flex-1 w-full flex justify-center overflow-hidden">
            <div className="w-full max-w-3xl px-6 py-6 overflow-y-auto custom-scrollbar">
              {messages.length === 0 ? (
                <div className="flex flex-col items-center justify-center h-full text-center">
                  <div className="w-20 h-20 mb-6 rounded-full glow-panel flex items-center justify-center">
                    <svg
                      xmlns="http://www.w3.org/2000/svg"
                      width="36"
                      height="36"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="1.5"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      className="text-cyan-400"
                    >
                      <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
                    </svg>
                  </div>
                  <h2 className="text-2xl font-semibold text-slate-100 mb-3">
                    Welcome to LocalHands
                  </h2>
                  <p className="text-slate-400 max-w-md text-sm leading-relaxed">
                    Your local AI assistant. Load a GGUF model from the sidebar
                    and start building anything you can imagine.
                  </p>
                </div>
              ) : (
                <div className="space-y-4">
                  {messages.map((message) => (
                    <div
                      key={message.id}
                      className={`p-4 ${
                        message.role === "user" ? "message-user ml-12" : "message-assistant mr-12"
                      }`}
                    >
                      <div className="flex items-start gap-3">
                        <div className={`w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 ${
                          message.role === "user" 
                            ? "bg-cyan-500/20 text-cyan-400" 
                            : "bg-slate-600/50 text-slate-300"
                        }`}>
                          {message.role === "user" ? (
                            <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                              <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
                              <circle cx="12" cy="7" r="4" />
                            </svg>
                          ) : (
                            <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                              <path d="M12 8V4H8" />
                              <rect width="16" height="12" x="4" y="8" rx="2" />
                              <path d="M2 14h2" />
                              <path d="M20 14h2" />
                              <path d="M15 13v2" />
                              <path d="M9 13v2" />
                            </svg>
                          )}
                        </div>
                        <div className="flex-1 text-sm text-slate-200 leading-relaxed whitespace-pre-wrap">
                          {message.content}
                        </div>
                      </div>
                    </div>
                  ))}
                  <div ref={messagesEndRef} />
                </div>
              )}
            </div>
          </div>

          {/* Bottom Input Bar */}
          <div className="input-bar-bg w-full">
            <div className="max-w-3xl mx-auto px-6 py-4">
              <div className="glow-input">
                <ChatInput
                  onSend={handleSendMessage}
                  disabled={isGenerating}
                  placeholder={
                    isGenerating 
                      ? "Generating response..." 
                      : modelLoaded 
                        ? "Message LocalHands..." 
                        : "Load a model to start chatting..."
                  }
                />
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Bottom-right dedication */}
      <div className="fixed bottom-3 right-4 text-[11px] text-cyan-100/40 pointer-events-none select-none">
        For Valerie. Never again.
      </div>
    </div>
  );
}

export default App;
