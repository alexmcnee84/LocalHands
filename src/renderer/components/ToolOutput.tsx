import React, { useState } from 'react';
import { ToolCall, ToolResult } from '../../shared/types';

interface ToolOutputProps {
  toolCall: ToolCall;
  result: ToolResult;
  timestamp: number;
}

const ToolOutput: React.FC<ToolOutputProps> = ({ toolCall, result, timestamp }) => {
  const [isExpanded, setIsExpanded] = useState(true);
  const [showArgs, setShowArgs] = useState(false);

  const formatTimestamp = (ts: number) => {
    return new Date(ts).toLocaleTimeString([], {
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  const getToolIcon = (toolName: string) => {
    switch (toolName) {
      case 'execute_bash':
        return '💻';
      case 'str_replace_editor':
        return '📝';
      case 'browser':
        return '🌐';
      default:
        return '🔧';
    }
  };

  const getStatusColor = () => {
    if (result.success) {
      return 'border-green-600 bg-green-900/20';
    }
    return 'border-red-600 bg-red-900/20';
  };

  const getStatusIcon = () => {
    if (result.success) {
      return '✓';
    }
    return '✗';
  };

  const formatOutput = (output: string) => {
    // Limit output length for display
    const maxLength = 5000;
    if (output.length > maxLength) {
      return output.slice(0, maxLength) + '\n... [output truncated]';
    }
    return output;
  };

  return (
    <div className={`rounded-lg border ${getStatusColor()} overflow-hidden`}>
      {/* Header */}
      <div
        className="flex items-center justify-between px-4 py-2 bg-gray-800/50 cursor-pointer hover:bg-gray-800/70"
        onClick={() => setIsExpanded(!isExpanded)}
      >
        <div className="flex items-center gap-2">
          <span className="text-lg">{getToolIcon(toolCall.name)}</span>
          <span className="font-medium text-purple-400">{toolCall.name}</span>
          <span className={`text-sm ${result.success ? 'text-green-400' : 'text-red-400'}`}>
            {getStatusIcon()}
          </span>
          {result.exitCode !== undefined && (
            <span className="text-xs text-gray-500">
              exit code: {result.exitCode}
            </span>
          )}
        </div>
        <div className="flex items-center gap-2">
          <span className="text-xs text-gray-500">{formatTimestamp(timestamp)}</span>
          <span className="text-gray-400">{isExpanded ? '▼' : '▶'}</span>
        </div>
      </div>

      {/* Content */}
      {isExpanded && (
        <div className="p-4 space-y-3">
          {/* Arguments */}
          <div>
            <button
              onClick={() => setShowArgs(!showArgs)}
              className="text-sm text-gray-400 hover:text-gray-300 flex items-center gap-1"
            >
              <span>{showArgs ? '▼' : '▶'}</span>
              <span>Arguments</span>
            </button>
            {showArgs && (
              <pre className="mt-2 p-2 bg-gray-900 rounded text-xs overflow-x-auto">
                {JSON.stringify(toolCall.arguments, null, 2)}
              </pre>
            )}
          </div>

          {/* Output */}
          <div>
            <div className="text-sm text-gray-400 mb-2">Output:</div>
            <div className="bg-gray-900 rounded p-3 font-mono text-sm overflow-x-auto">
              {toolCall.name === 'execute_bash' ? (
                <TerminalOutput content={formatOutput(result.output)} />
              ) : (
                <pre className="whitespace-pre-wrap break-words">
                  {formatOutput(result.output)}
                </pre>
              )}
            </div>
          </div>

          {/* Error */}
          {result.error && (
            <div className="bg-red-900/30 border border-red-700 rounded p-3">
              <div className="text-sm text-red-400 font-medium mb-1">Error:</div>
              <div className="text-red-200 text-sm">{result.error}</div>
            </div>
          )}
        </div>
      )}
    </div>
  );
};

// Terminal-style output component
const TerminalOutput: React.FC<{ content: string }> = ({ content }) => {
  const lines = content.split('\n');

  return (
    <div className="space-y-0.5">
      {lines.map((line, index) => (
        <div key={index} className="flex">
          <span className="text-gray-600 select-none w-8 text-right pr-2 flex-shrink-0">
            {index + 1}
          </span>
          <span className="text-gray-200 whitespace-pre-wrap break-all">
            {line || ' '}
          </span>
        </div>
      ))}
    </div>
  );
};

export default ToolOutput;
