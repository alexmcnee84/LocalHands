import React, { useState, useEffect, useRef, useCallback } from 'react';
import { v4 as uuidv4 } from 'uuid';
import { Message, ToolResult } from '../shared/types';
import ChatWindow from './components/ChatWindow';
import Sidebar from './components/Sidebar';
import SettingsModal from './components/SettingsModal';
import AnimatedHands from './components/AnimatedHands';

interface AppConfig {
  workspaceDir: string;
  modelPath?: string;
  modelLoaded: boolean;
  confirmDestructive: boolean;
  maxIterations: number;
}

interface ToolExecution {
  id: string;
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
  const [toolExecutions, setToolExecutions] = useState<ToolExecution[]>([]);
  const [streamingContent, setStreamingContent] = useState('');
  const [showSettings, setShowSettings] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [temperature, setTemperature] = useState(0.7);
  const [showTemperature, setShowTemperature] = useState(false);

  // Access the preload-injected API. Casting to any avoids type
  // checker errors when global declarations are missing during
  // type compilation.
  const electronAPI = (window as any).electronAPI;

  // Load initial config and temperature
  useEffect(() => {
    const loadConfig = async () => {
      try {
        const cfg = await electronAPI.getConfig();
        setConfig(cfg as AppConfig);
        
        // Load temperature
        const tempResult = await electronAPI.getTemperature();
        if (tempResult.success) {
          setTemperature(tempResult.temperature);
        }
      } catch (err) {
        console.error('Failed to load config:', err);
      }
    };
    loadConfig();
  }, []);

  // Set up event listeners
  useEffect(() => {
    const unsubMessage = electronAPI.onMessage((message: Message) => {
      setMessages(prev => [...prev, message]);
      setStreamingContent('');
    });

    const unsubToolStart = electronAPI.onToolStart((data) => {
      setToolExecutions(prev => [
        ...prev,
        {
          id: uuidv4(),
          toolName: data.toolName,
          args: data.args,
          status: 'running',
        },
      ]);
    });

    const unsubToolEnd = electronAPI.onToolEnd((data) => {
      setToolExecutions(prev => {
        if (prev.length === 0) return prev;
        const lastIndex = prev.length - 1;
        const last = prev[lastIndex];
        if (last.status !== 'running') return prev;

        const updated = [...prev];
        updated[lastIndex] = {
          ...last,
          status: data.result.success ? 'completed' : 'error',
          result: data.result,
        };
        return updated;
      });
    });

    const unsubToken = electronAPI.onToken((token: string) => {
      setStreamingContent(prev => prev + token);
    });

    const unsubError = electronAPI.onError((err: string) => {
      setError(err);
      setIsProcessing(false);
    });

    const unsubComplete = electronAPI.onComplete(() => {
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

    setIsProcessing(true);
    setError(null);
    setToolExecutions([]); // Clear previous actions
    const message = inputValue;
    setInputValue('');

    try {
      await electronAPI.sendMessage(message);
    } catch (err) {
      setError((err as Error).message);
      setIsProcessing(false);
    }
  }, [inputValue, isProcessing]);

  const handleCancel = useCallback(async () => {
    try {
      await electronAPI.cancelGeneration();
      setIsProcessing(false);
    } catch (err) {
      console.error('Failed to cancel:', err);
    }
  }, []);

  const handleClearHistory = useCallback(async () => {
    try {
      await electronAPI.clearHistory();
      setMessages([]);
    } catch (err) {
      console.error('Failed to clear history:', err);
    }
  }, []);

  /**
   * Trigger a file upload dialog via the preload-exposed API. After the
   * upload completes, we optionally append a system message to the
   * conversation to inform the user. If the upload fails, the error
   * state is updated to reflect the problem.
   */
  const handleUploadMedia = useCallback(async () => {
    try {
      const result = await electronAPI.uploadMedia();
      if (result && result.success && result.fileName) {
        // Inform the user of the uploaded file via a system message
        const systemMsg = {
          id: uuidv4(),
          role: 'system' as const,
          content: `File uploaded: ${result.fileName}`,
          timestamp: Date.now(),
        };
        setMessages(prev => [...prev, systemMsg]);
      } else if (result && !result.success && result.error) {
        setError(result.error);
      }
    } catch (err) {
      console.error('File upload failed:', err);
      setError((err as Error).message);
    }
  }, []);

  const handleLoadModel = useCallback(async () => {
    try {
      const result = await electronAPI.selectModel();
      if (result.success && result.modelPath) {
        setIsProcessing(true);
        const loadResult = await electronAPI.loadModel(result.modelPath);
        if (loadResult.success) {
          const newConfig = await electronAPI.getConfig();
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
      const result = await electronAPI.setWorkspace();
      if (result.success) {
        const newConfig = await electronAPI.getConfig();
        setConfig(newConfig as AppConfig);
      }
    } catch (err) {
      console.error('Failed to set workspace:', err);
    }
  }, []);

  const handleTemperatureChange = useCallback(async (newTemp: number) => {
    setTemperature(newTemp);
    try {
      await electronAPI.setTemperature(newTemp);
    } catch (err) {
      console.error('Failed to set temperature:', err);
    }
  }, []);

  const getTemperatureLabel = (temp: number): string => {
    if (temp <= 0.3) return 'Precise';
    if (temp <= 0.6) return 'Balanced';
    if (temp <= 0.9) return 'Creative';
    return 'Wild';
  };

  return (
    <div className="flex h-screen bg-gray-900 text-white">
      {/* Top accent bar */}
      <div className="absolute top-0 left-0 right-0 h-2 bg-green-600"></div>

      {/* Sidebar */}
      <Sidebar
        config={config}
        onSetWorkspace={handleSetWorkspace}
        onClearHistory={handleClearHistory}
        onOpenSettings={() => setShowSettings(true)}
        onUploadMedia={handleUploadMedia}
      />

      {/* Main Content */}
      <div className="flex-1 flex flex-col">
        {/* Header */}
        <header className="h-14 border-b-2 border-green-600 flex items-center px-4 relative">
          <h1 className="text-lg font-semibold">LocalHands</h1>
          <span className="ml-2 text-sm text-gray-400">AI Assistant</span>
          
          {/* Temperature Control */}
          <div className="ml-4 relative">
            <button
              onClick={() => setShowTemperature(!showTemperature)}
              className="flex items-center gap-2 px-3 py-1 bg-gray-800 border border-gray-600 rounded-lg hover:bg-gray-700 text-sm"
              title="Adjust LLM temperature"
            >
              <span className="text-cyan-400">{temperature.toFixed(1)}</span>
              <span className="text-gray-400">{getTemperatureLabel(temperature)}</span>
            </button>
            
            {showTemperature && (
              <div className="absolute top-full left-0 mt-2 p-3 bg-gray-800 border border-gray-600 rounded-lg shadow-lg z-50 w-64">
                <div className="text-xs text-gray-400 mb-2">Temperature: {temperature.toFixed(2)}</div>
                <input
                  type="range"
                  min="0"
                  max="2"
                  step="0.1"
                  value={temperature}
                  onChange={(e) => handleTemperatureChange(parseFloat(e.target.value))}
                  className="w-full accent-cyan-500"
                />
                <div className="flex justify-between text-xs text-gray-500 mt-1">
                  <span>Precise</span>
                  <span>Balanced</span>
                  <span>Creative</span>
                  <span>Wild</span>
                </div>
                <div className="flex gap-2 mt-3">
                  <button
                    onClick={() => handleTemperatureChange(0.2)}
                    className={`flex-1 px-2 py-1 text-xs rounded ${temperature === 0.2 ? 'bg-cyan-600' : 'bg-gray-700 hover:bg-gray-600'}`}
                  >
                    0.2
                  </button>
                  <button
                    onClick={() => handleTemperatureChange(0.7)}
                    className={`flex-1 px-2 py-1 text-xs rounded ${temperature === 0.7 ? 'bg-cyan-600' : 'bg-gray-700 hover:bg-gray-600'}`}
                  >
                    0.7
                  </button>
                  <button
                    onClick={() => handleTemperatureChange(1.0)}
                    className={`flex-1 px-2 py-1 text-xs rounded ${temperature === 1.0 ? 'bg-cyan-600' : 'bg-gray-700 hover:bg-gray-600'}`}
                  >
                    1.0
                  </button>
                </div>
              </div>
            )}
          </div>

          {config?.workspaceDir && (
            <span className="ml-auto text-sm text-gray-500 truncate max-w-md">
              Workspace: {config.workspaceDir}
            </span>
          )}
        </header>

        {/* Animated hands banner */}
        <AnimatedHands />

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

        {/* Chat Window */}
        <ChatWindow
          messages={messages}
          streamingContent={streamingContent}
          isProcessing={isProcessing}
        />

        {/* Input Area */}
        <div className="border-t border-gray-700 p-4">
          <div className="text-xs text-gray-400 mb-2">
            Give LocalHands a task; it will plan steps and run tools in your workspace.
          </div>
          <div className="flex gap-2">
            {/* Attach media button */}
            <button
              onClick={handleUploadMedia}
              title="Attach files"
              className="flex items-center justify-center px-3 py-2 bg-gray-800 border border-gray-600 rounded-lg hover:bg-gray-700 disabled:opacity-50"
            >
              <span role="img" aria-label="attach" className="text-xl">
                📎
              </span>
            </button>
            <textarea
              value={inputValue}
              onChange={(e) => setInputValue(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && !e.shiftKey) {
                  e.preventDefault();
                  handleSendMessage();
                }
              }}
              placeholder="Describe what you want LocalHands to do (e.g. 'scan this repo and list bugs')."
              disabled={isProcessing}
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
                  disabled={!inputValue.trim()}
                  className="px-4 py-2 bg-blue-600 hover:bg-blue-700 rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  Send
                </button>
              )}
            </div>
          </div>

          {/* Actions/Steps Panel */}
          {toolExecutions.length > 0 && (
            <div className="mt-3 bg-gray-800 border border-gray-700 rounded-lg p-3">
              <div className="text-xs text-gray-400 mb-2 font-medium">Actions</div>
              <div className="space-y-1">
                {toolExecutions.slice(-5).map((exec) => (
                  <div key={exec.id} className="flex items-center gap-2 text-sm">
                    <div className={`w-2 h-2 rounded-full flex-shrink-0 ${
                      exec.status === 'running' ? 'bg-yellow-400 animate-pulse' :
                      exec.status === 'completed' ? 'bg-green-400' : 'bg-red-400'
                    }`} />
                    <span className="text-gray-300 truncate">
                      {exec.status === 'running' ? 'Running' : exec.status === 'completed' ? 'Done' : 'Error'}: {exec.toolName}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Settings Modal */}
      {showSettings && (
        <SettingsModal
          config={config}
          onClose={() => setShowSettings(false)}
          onSetWorkspace={handleSetWorkspace}
        />
      )}
    </div>
  );
};

export default App;
