import { contextBridge, ipcRenderer } from 'electron';
import { IPC_CHANNELS, Message, AgentConfig, ToolResult } from '../shared/types';

// Expose protected methods that allow the renderer process to use
// ipcRenderer without exposing the entire object
contextBridge.exposeInMainWorld('electronAPI', {
  // Model operations
  loadModel: (modelPath: string) => 
    ipcRenderer.invoke(IPC_CHANNELS.LOAD_MODEL, modelPath),
  
  selectModel: () => 
    ipcRenderer.invoke('select-model'),

  // Message operations
  sendMessage: (message: string) => 
    ipcRenderer.invoke(IPC_CHANNELS.SEND_MESSAGE, message),
  
  cancelGeneration: () => 
    ipcRenderer.invoke(IPC_CHANNELS.CANCEL_GENERATION),

  clearHistory: () => 
    ipcRenderer.invoke('clear-history'),

  // Configuration
  getConfig: () => 
    ipcRenderer.invoke(IPC_CHANNELS.GET_CONFIG),
  
  setConfig: (config: Partial<AgentConfig>) => 
    ipcRenderer.invoke(IPC_CHANNELS.SET_CONFIG, config),
  
  setWorkspace: () => 
    ipcRenderer.invoke(IPC_CHANNELS.SET_WORKSPACE),

  // Tools
  getTools: () => 
    ipcRenderer.invoke('get-tools'),

  // Event listeners
  onMessage: (callback: (message: Message) => void) => {
    const listener = (_: Electron.IpcRendererEvent, message: Message) => callback(message);
    ipcRenderer.on(IPC_CHANNELS.RECEIVE_MESSAGE, listener);
    return () => ipcRenderer.removeListener(IPC_CHANNELS.RECEIVE_MESSAGE, listener);
  },

  onToolStart: (callback: (data: { toolName: string; args: Record<string, unknown> }) => void) => {
    const listener = (_: Electron.IpcRendererEvent, data: { toolName: string; args: Record<string, unknown> }) => callback(data);
    ipcRenderer.on(IPC_CHANNELS.TOOL_EXECUTION_START, listener);
    return () => ipcRenderer.removeListener(IPC_CHANNELS.TOOL_EXECUTION_START, listener);
  },

  onToolEnd: (callback: (data: { toolName: string; result: ToolResult }) => void) => {
    const listener = (_: Electron.IpcRendererEvent, data: { toolName: string; result: ToolResult }) => callback(data);
    ipcRenderer.on(IPC_CHANNELS.TOOL_EXECUTION_END, listener);
    return () => ipcRenderer.removeListener(IPC_CHANNELS.TOOL_EXECUTION_END, listener);
  },

  onToken: (callback: (token: string) => void) => {
    const listener = (_: Electron.IpcRendererEvent, token: string) => callback(token);
    ipcRenderer.on('token', listener);
    return () => ipcRenderer.removeListener('token', listener);
  },

  onError: (callback: (error: string) => void) => {
    const listener = (_: Electron.IpcRendererEvent, error: string) => callback(error);
    ipcRenderer.on('error', listener);
    return () => ipcRenderer.removeListener('error', listener);
  },

  onComplete: (callback: () => void) => {
    const listener = () => callback();
    ipcRenderer.on('complete', listener);
    return () => ipcRenderer.removeListener('complete', listener);
  },

  onModelLoaded: (callback: (data: { success: boolean; modelPath?: string; error?: string }) => void) => {
    const listener = (_: Electron.IpcRendererEvent, data: { success: boolean; modelPath?: string; error?: string }) => callback(data);
    ipcRenderer.on(IPC_CHANNELS.MODEL_LOADED, listener);
    return () => ipcRenderer.removeListener(IPC_CHANNELS.MODEL_LOADED, listener);
  },

  /**
   * Trigger a native file selection dialog for uploading media. The main process
   * handles copying the selected file(s) into the current workspace. The
   * returned object contains a success flag and, on success, the fileName.
   */
  uploadMedia: () =>
    ipcRenderer.invoke('upload-media'),

  // Temperature control
  setTemperature: (temperature: number) =>
    ipcRenderer.invoke(IPC_CHANNELS.SET_TEMPERATURE, temperature),
  
  getTemperature: () =>
    ipcRenderer.invoke(IPC_CHANNELS.GET_TEMPERATURE),

  // Memory bank
  getMemoryStats: () =>
    ipcRenderer.invoke(IPC_CHANNELS.GET_MEMORY_STATS),
  
  listConversations: () =>
    ipcRenderer.invoke(IPC_CHANNELS.LIST_CONVERSATIONS),
  
  loadConversation: (id: string) =>
    ipcRenderer.invoke(IPC_CHANNELS.LOAD_CONVERSATION, id),
  
  clearMemory: () =>
    ipcRenderer.invoke(IPC_CHANNELS.CLEAR_MEMORY),
});

// Type declaration for the exposed API
declare global {
  interface Window {
    electronAPI: {
      loadModel: (modelPath: string) => Promise<{ success: boolean; modelPath?: string; error?: string }>;
      selectModel: () => Promise<{ success: boolean; modelPath?: string }>;
      sendMessage: (message: string) => Promise<{ success: boolean; messages?: Message[]; error?: string }>;
      cancelGeneration: () => Promise<{ success: boolean; error?: string }>;
      clearHistory: () => Promise<{ success: boolean }>;
      getConfig: () => Promise<AgentConfig & { modelLoaded: boolean; modelInfo: unknown }>;
      setConfig: (config: Partial<AgentConfig>) => Promise<{ success: boolean; config: AgentConfig }>;
      setWorkspace: () => Promise<{ success: boolean; workspaceDir?: string }>;
      getTools: () => Promise<unknown[]>;
      onMessage: (callback: (message: Message) => void) => () => void;
      onToolStart: (callback: (data: { toolName: string; args: Record<string, unknown> }) => void) => () => void;
      onToolEnd: (callback: (data: { toolName: string; result: ToolResult }) => void) => () => void;
      onToken: (callback: (token: string) => void) => () => void;
      onError: (callback: (error: string) => void) => () => void;
      onComplete: (callback: () => void) => () => void;
      onModelLoaded: (callback: (data: { success: boolean; modelPath?: string; error?: string }) => void) => () => void;

      /**
       * Open a file picker to upload media into the workspace. Returns
       * an object with a success boolean and optional fileName or error.
       */
      uploadMedia: () => Promise<{ success: boolean; fileName?: string; error?: string }>;

      // Temperature control
      setTemperature: (temperature: number) => Promise<{ success: boolean; temperature?: number; error?: string }>;
      getTemperature: () => Promise<{ success: boolean; temperature: number }>;

      // Memory bank
      getMemoryStats: () => Promise<{ success: boolean; totalSize?: number; conversationCount?: number; maxSize?: number; error?: string }>;
      listConversations: () => Promise<{ success: boolean; conversations?: Array<{ id: string; title: string; startedAt: number; updatedAt: number; messageCount: number }>; error?: string }>;
      loadConversation: (id: string) => Promise<{ success: boolean; conversation?: unknown; error?: string }>;
      clearMemory: () => Promise<{ success: boolean; error?: string }>;
    };
  }
}
