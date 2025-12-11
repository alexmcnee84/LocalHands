import React, { useRef, useEffect } from 'react';
import { Message } from '../../shared/types';
import MessageBubble from './MessageBubble';

interface ChatWindowProps {
  messages: Message[];
  streamingContent: string;
  isProcessing: boolean;
}

const ChatWindow: React.FC<ChatWindowProps> = ({
  messages,
  streamingContent,
  isProcessing,
}) => {
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages, streamingContent]);

  return (
    <div className="flex-1 overflow-y-auto p-4 space-y-4">
      {messages.length === 0 && !isProcessing && (
        <div className="flex flex-col items-center justify-center h-full text-gray-500">
          <div className="text-6xl mb-4">🤖</div>
          <h2 className="text-xl font-semibold mb-2">Welcome to LocalHands</h2>
          <p className="text-center max-w-md">
            Your local AI assistant with sandbox capabilities. Load a GGUF model to get started.
          </p>
          <div className="mt-6 text-sm text-gray-600">
            <p className="mb-2">Available tools:</p>
            <ul className="list-disc list-inside space-y-1">
              <li>Execute bash commands</li>
              <li>View and edit files</li>
              <li>Browse the web (if Playwright is installed)</li>
            </ul>
          </div>
        </div>
      )}

      {messages.map((message) => (
        <MessageBubble key={message.id} message={message} />
      ))}

      {/* Streaming content */}
      {streamingContent && (
        <div className="flex justify-start">
          <div className="max-w-3xl bg-gray-800 rounded-lg px-4 py-3">
            <div className="text-sm text-gray-400 mb-1">Assistant</div>
            <div className="whitespace-pre-wrap">{streamingContent}</div>
            <span className="inline-block w-2 h-4 bg-blue-400 animate-pulse ml-1" />
          </div>
        </div>
      )}

      {/* Processing indicator */}
      {isProcessing && !streamingContent && (
        <div className="flex justify-start">
          <div className="bg-gray-800 rounded-lg px-4 py-3">
            <div className="flex items-center gap-2">
              <div className="flex gap-1">
                <div className="w-2 h-2 bg-blue-400 rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
                <div className="w-2 h-2 bg-blue-400 rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
                <div className="w-2 h-2 bg-blue-400 rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
              </div>
              <span className="text-gray-400 text-sm">Thinking...</span>
            </div>
          </div>
        </div>
      )}

      <div ref={messagesEndRef} />
    </div>
  );
};

export default ChatWindow;
