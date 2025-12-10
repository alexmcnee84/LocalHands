// Shared types for LocalHands

export interface Message {
  id: string;
  role: 'user' | 'assistant' | 'system' | 'tool';
  content: string;
  timestamp: number;
  toolCall?: ToolCall;
  toolResult?: ToolResult;
}

export interface ToolCall {
  id: string;
  name: string;
  arguments: Record<string, unknown>;
}

export interface ToolResult {
  toolCallId: string;
  success: boolean;
  output: string;
  exitCode?: number;
  error?: string;
}

export interface Tool {
  name: string;
  description: string;
  parameters: ToolParameter[];
  execute: (args: Record<string, unknown>) => Promise<ToolResult>;
}

export interface ToolParameter {
  name: string;
  type: 'string' | 'number' | 'boolean' | 'array' | 'object';
  description: string;
  required: boolean;
  enum?: string[];
}

export interface ToolDefinition {
  type: 'function';
  function: {
    name: string;
    description: string;
    parameters: {
      type: 'object';
      properties: Record<string, {
        type: string;
        description: string;
        enum?: string[];
        items?: { type: string };
      }>;
      required: string[];
    };
  };
}

export interface AgentConfig {
  workspaceDir: string;
  modelPath?: string;
  confirmDestructive: boolean;
  maxIterations: number;
}

export interface ConversationState {
  messages: Message[];
  isProcessing: boolean;
  currentToolExecution?: {
    toolName: string;
    status: 'running' | 'completed' | 'error';
  };
}

// Action types inspired by OpenHands
export type ActionType = 
  | 'bash'
  | 'file_read'
  | 'file_write'
  | 'file_edit'
  | 'browser_navigate'
  | 'browser_action'
  | 'finish'
  | 'message';

export interface Action {
  type: ActionType;
  thought?: string;
  [key: string]: unknown;
}

export interface BashAction extends Action {
  type: 'bash';
  command: string;
  timeout?: number;
}

export interface FileReadAction extends Action {
  type: 'file_read';
  path: string;
  startLine?: number;
  endLine?: number;
}

export interface FileWriteAction extends Action {
  type: 'file_write';
  path: string;
  content: string;
}

export interface FileEditAction extends Action {
  type: 'file_edit';
  path: string;
  command: 'view' | 'create' | 'str_replace' | 'insert' | 'undo_edit';
  oldStr?: string;
  newStr?: string;
  insertLine?: number;
  fileText?: string;
  viewRange?: [number, number];
}

export interface BrowserNavigateAction extends Action {
  type: 'browser_navigate';
  url: string;
}

export interface BrowserAction extends Action {
  type: 'browser_action';
  actions: string;
}

export interface FinishAction extends Action {
  type: 'finish';
  result?: string;
}

export interface MessageAction extends Action {
  type: 'message';
  content: string;
}

// Observation types
export interface Observation {
  type: string;
  content: string;
  success: boolean;
  exitCode?: number;
  error?: string;
}

export interface BashObservation extends Observation {
  type: 'bash';
  command: string;
  exitCode: number;
}

export interface FileObservation extends Observation {
  type: 'file';
  path: string;
}

// IPC Channel names
export const IPC_CHANNELS = {
  SEND_MESSAGE: 'send-message',
  RECEIVE_MESSAGE: 'receive-message',
  TOOL_EXECUTION_START: 'tool-execution-start',
  TOOL_EXECUTION_END: 'tool-execution-end',
  LOAD_MODEL: 'load-model',
  MODEL_LOADED: 'model-loaded',
  SET_WORKSPACE: 'set-workspace',
  GET_CONFIG: 'get-config',
  SET_CONFIG: 'set-config',
  CANCEL_GENERATION: 'cancel-generation',
} as const;
