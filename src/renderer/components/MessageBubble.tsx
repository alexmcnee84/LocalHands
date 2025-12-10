import React, { useState } from 'react';
import { Message } from '../../shared/types';
import ToolOutput from './ToolOutput';

interface MessageBubbleProps {
  message: Message;
}

const MessageBubble: React.FC<MessageBubbleProps> = ({ message }) => {
  const [isExpanded, setIsExpanded] = useState(true);

  const isUser = message.role === 'user';
  const isSystem = message.role === 'system';
  const isTool = message.role === 'tool';

  const getRoleLabel = () => {
    switch (message.role) {
      case 'user':
        return 'You';
      case 'assistant':
        return 'Assistant';
      case 'system':
        return 'System';
      case 'tool':
        return message.toolCall?.name || 'Tool';
      default:
        return message.role;
    }
  };

  const getRoleColor = () => {
    switch (message.role) {
      case 'user':
        return 'text-blue-400';
      case 'assistant':
        return 'text-green-400';
      case 'system':
        return 'text-yellow-400';
      case 'tool':
        return 'text-purple-400';
      default:
        return 'text-gray-400';
    }
  };

  const getBubbleStyle = () => {
    if (isUser) {
      return 'bg-blue-600';
    }
    if (isSystem) {
      return 'bg-yellow-900/50 border border-yellow-700';
    }
    if (isTool) {
      return 'bg-gray-800 border border-gray-600';
    }
    return 'bg-gray-800';
  };

  const formatTimestamp = (timestamp: number) => {
    return new Date(timestamp).toLocaleTimeString([], {
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  // Render tool message with special formatting
  if (isTool && message.toolCall && message.toolResult) {
    return (
      <div className="flex justify-start">
        <div className="max-w-4xl w-full">
          <ToolOutput
            toolCall={message.toolCall}
            result={message.toolResult}
            timestamp={message.timestamp}
          />
        </div>
      </div>
    );
  }

  return (
    <div className={`flex ${isUser ? 'justify-end' : 'justify-start'}`}>
      <div className={`max-w-3xl rounded-lg px-4 py-3 ${getBubbleStyle()}`}>
        {/* Header */}
        <div className="flex items-center justify-between mb-1">
          <span className={`text-sm font-medium ${getRoleColor()}`}>
            {getRoleLabel()}
          </span>
          <span className="text-xs text-gray-500 ml-4">
            {formatTimestamp(message.timestamp)}
          </span>
        </div>

        {/* Content */}
        <div className="whitespace-pre-wrap break-words">
          {message.content}
        </div>

        {/* Tool calls indicator */}
        {message.toolCall && !isTool && (
          <div className="mt-2 pt-2 border-t border-gray-600">
            <div className="text-sm text-purple-400">
              Called tool: {message.toolCall.name}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default MessageBubble;
