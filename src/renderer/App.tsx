import React, { useState, useEffect, useRef, useCallback } from 'react';
import { Message, ToolResult } from '../shared/types';
import ChatWindow from './components/ChatWindow';
import Sidebar from './components/Sidebar';
import SettingsModal from './components/SettingsModal';

interface AppConfig {
  workspaceDir: string;
  modelPath?: string;
  modelLoaded: boolean;
  confirmDestructive: boolean;
  maxIterations: number;
}

interface ToolExecution {
  toolName: string;
  args: Record<string, unknown>;
  status: 'running' | 'completed' | 'error';
  result?: ToolResult;
}

const App: React.FC = () => {
  const [messages, setMessages] = useState<Message[]>([]);
  const [inputValue, setInputValue] = useState('');
  const [isProcessing, setIsProcessing] = useState(false);
  const [config, setConfig] = useState<AppConfig | null>(null);
  const [currentToolExecution, setCurrentToolExecution] = useState<ToolExecution | null>(null);
  const [streamingContent, setStreamingContent] = useState('');
  const [showSettings, setShowSettings] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Load initial config
  useEffect(() => {
    const loadConfig = async () => {
      try {
        const cfg = await window.electronAPI.getConfig();
        setConfig(cfg as AppConfig);
      } catch (err) {
        console.error('Failed to load config:', err);
      }
    };
    loadConfig();
  }, []);

  // Set up event listeners
  useEffect(() => {
    const unsubMessage = window.electronAPI.onMessage((message: Message) => {
      setMessages(prev => [...prev, message]);
      setStreamingContent('');
    });

    const unsubToolStart = window.electronAPI.onToolStart((data) => {
      setCurrentToolExecution({
        toolName: data.toolName,
        args: data.args,
        status: 'running',
      });
    });

    const unsubToolEnd = window.electronAPI.onToolEnd((data) => {
      setCurrentToolExecution({
        toolName: data.toolName,
        args: {},
        status: data.result.success ? 'completed' : 'error',
        result: data.result,
      });
      // Clear after a short delay
      setTimeout(() => setCurrentToolExecution(null), 500);
    });

    const unsubToken = window.electronAPI.onToken((token: string) => {
      setStreamingContent(prev => prev + token);
    });

    const unsubError = window.electronAPI.onError((err: string) => {
      setError(err);
      setIsProcessing(false);
    });

    const unsubComplete = window.electronAPI.onComplete(() => {
      setIsProcessing(false);
      setStreamingContent('');
    });

    return () => {
      unsubMessage();
      unsubToolStart();
      unsubToolEnd();
      unsubToken();
      unsubError();
      unsubComplete();
    };
  }, []);

  const handleSendMessage = useCallback(async () => {
    if (!inputValue.trim() || isProcessing) return;

    if (!config?.modelLoaded) {
      setError('Please load a model first. Click the settings icon to select a GGUF model.');
      return;
    }

    setIsProcessing(true);
    setError(null);
    const message = inputValue;
    setInputValue('');

    try {
      await window.electronAPI.sendMessage(message);
    } catch (err) {
      setError((err as Error).message);
      setIsProcessing(false);
    }
  }, [inputValue, isProcessing, config?.modelLoaded]);

  const handleCancel = useCallback(async () => {
    try {
      await window.electronAPI.cancelGeneration();
      setIsProcessing(false);
    } catch (err) {
      console.error('Failed to cancel:', err);
    }
  }, []);

  const handleClearHistory = useCallback(async () => {
    try {
      await window.electronAPI.clearHistory();
      setMessages([]);
    } catch (err) {
      console.error('Failed to clear history:', err);
    }
  }, []);

  const handleLoadModel = useCallback(async () => {
    try {
      const result = await window.electronAPI.selectModel();
      if (result.success && result.modelPath) {
        setIsProcessing(true);
        const loadResult = await window.electronAPI.loadModel(result.modelPath);
        if (loadResult.success) {
          const newConfig = await window.electronAPI.getConfig();
          setConfig(newConfig as AppConfig);
          setError(null);
        } else {
          setError(loadResult.error || 'Failed to load model');
        }
        setIsProcessing(false);
      }
    } catch (err) {
      setError((err as Error).message);
      setIsProcessing(false);
    }
  }, []);

  const handleSetWorkspace = useCallback(async () => {
    try {
      const result = await window.electronAPI.setWorkspace();
      if (result.success) {
        const newConfig = await window.electronAPI.getConfig();
        setConfig(newConfig as AppConfig);
      }
    } catch (err) {
      console.error('Failed to set workspace:', err);
    }
  }, []);

  return (
    <div className="flex h-screen bg-gray-900 text-white">
      {/* Sidebar */}
      <Sidebar
        config={config}
        onLoadModel={handleLoadModel}
        onSetWorkspace={handleSetWorkspace}
        onClearHistory={handleClearHistory}
        onOpenSettings={() => setShowSettings(true)}
      />

      {/* Main Content */}
      <div className="flex-1 flex flex-col">
        {/* Header */}
        <header className="h-14 border-b border-gray-700 flex items-center px-4">
          <h1 className="text-lg font-semibold">LocalHands</h1>
          <span className="ml-2 text-sm text-gray-400">
            {config?.modelLoaded ? 'Model loaded' : 'No model loaded'}
          </span>
          {config?.workspaceDir && (
            <span className="ml-auto text-sm text-gray-500 truncate max-w-md">
              Workspace: {config.workspaceDir}
            </span>
          )}
        </header>

        {/* Error Banner */}
        {error && (
          <div className="bg-red-900/50 border-b border-red-700 px-4 py-2 flex items-center justify-between">
            <span className="text-red-200 text-sm">{error}</span>
            <button
              onClick={() => setError(null)}
              className="text-red-300 hover:text-red-100"
            >
              Dismiss
            </button>
          </div>
        )}

        {/* Tool Execution Status */}
        {currentToolExecution && (
          <div className="bg-blue-900/30 border-b border-blue-700 px-4 py-2">
            <div className="flex items-center gap-2">
              <div className={`w-2 h-2 rounded-full ${
                currentToolExecution.status === 'running' ? 'bg-yellow-400 animate-pulse' :
                currentToolExecution.status === 'completed' ? 'bg-green-400' : 'bg-red-400'
              }`} />
              <span className="text-sm text-blue-200">
                {currentToolExecution.status === 'running' ? 'Executing' : 'Completed'}: {currentToolExecution.toolName}
              </span>
            </div>
          </div>
        )}

        {/* Chat Window */}
        <ChatWindow
          messages={messages}
          streamingContent={streamingContent}
          isProcessing={isProcessing}
        />

        {/* Input Area */}
        <div className="border-t border-gray-700 p-4">
          <div className="flex gap-2">
            <textarea
              value={inputValue}
              onChange={(e) => setInputValue(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && !e.shiftKey) {
                  e.preventDefault();
                  handleSendMessage();
                }
              }}
              placeholder={config?.modelLoaded ? "Type your message..." : "Load a model to start chatting..."}
              disabled={!config?.modelLoaded || isProcessing}
              className="flex-1 bg-gray-800 border border-gray-600 rounded-lg px-4 py-2 resize-none focus:outline-none focus:border-blue-500 disabled:opacity-50"
              rows={2}
            />
            <div className="flex flex-col gap-2">
              {isProcessing ? (
                <button
                  onClick={handleCancel}
                  className="px-4 py-2 bg-red-600 hover:bg-red-700 rounded-lg transition-colors"
                >
                  Cancel
                </button>
              ) : (
                <button
                  onClick={handleSendMessage}
                  disabled={!config?.modelLoaded || !inputValue.trim()}
                  className="px-4 py-2 bg-blue-600 hover:bg-blue-700 rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  Send
                </button>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Settings Modal */}
      {showSettings && (
        <SettingsModal
          config={config}
          onClose={() => setShowSettings(false)}
          onLoadModel={handleLoadModel}
          onSetWorkspace={handleSetWorkspace}
        />
      )}
    </div>
  );
};

export default App;
