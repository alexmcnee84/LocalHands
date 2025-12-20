import { app, BrowserWindow, ipcMain, dialog } from 'electron';
import * as path from 'path';
import * as fs from 'fs';
import { LLMManager } from './llm';
import { Agent, AgentEventHandlers } from './agent';
import { getToolDefinitionsForLLM } from './tools';
import { IPC_CHANNELS, AgentConfig, Message, ToolResult } from '../shared/types';
import { memoryManager } from './memory';
import { parseFile, detectFileType } from './file-parser';

let mainWindow: BrowserWindow | null = null;
let llmManager: LLMManager | null = null;
let agent: Agent | null = null;

// Default configuration
let config: AgentConfig = {
  workspaceDir: path.join(app.getPath('home'), 'LocalHands-Workspace'),
  confirmDestructive: true,
  maxIterations: 10,
};

function createWindow(): void {
  mainWindow = new BrowserWindow({
    width: 1200,
    height: 800,
    minWidth: 800,
    minHeight: 600,
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      preload: path.join(__dirname, 'preload.js'),
    },
    titleBarStyle: 'hiddenInset',
    title: 'LocalHands',
  });

  // In development, load from Vite dev server
  if (process.env.NODE_ENV === 'development') {
    mainWindow.loadURL('http://localhost:5173');
    mainWindow.webContents.openDevTools();
  } else {
    // In production, load the built files
    mainWindow.loadFile(path.join(__dirname, '../renderer/index.html'));
  }

  mainWindow.on('closed', () => {
    mainWindow = null;
  });
}

// Ensure workspace directory exists
function ensureWorkspaceDir(): void {
  if (!fs.existsSync(config.workspaceDir)) {
    fs.mkdirSync(config.workspaceDir, { recursive: true });
  }
}

// Initialize LLM and Agent
async function initializeAgent(): Promise<void> {
  if (!llmManager) {
    llmManager = new LLMManager();
  }

  if (config.modelPath && fs.existsSync(config.modelPath)) {
    try {
      await llmManager.loadModel({
        modelPath: config.modelPath,
        contextSize: 4096,
      });

      agent = new Agent(llmManager, config);
      console.log('Agent initialized successfully');
    } catch (error) {
      console.error('Failed to initialize agent:', error);
    }
  }
}

// IPC Handlers
function setupIpcHandlers(): void {
  // Load model
  ipcMain.handle(IPC_CHANNELS.LOAD_MODEL, async (_, modelPath: string) => {
    try {
      if (!llmManager) {
        llmManager = new LLMManager();
      }

      await llmManager.loadModel({
        modelPath,
        contextSize: 4096,
      });

      config.modelPath = modelPath;
      agent = new Agent(llmManager, config);

      return { success: true, modelPath };
    } catch (error) {
      return { success: false, error: (error as Error).message };
    }
  });

  // Send message to agent
  ipcMain.handle(IPC_CHANNELS.SEND_MESSAGE, async (_, message: string) => {
    if (!agent || !llmManager?.isModelLoaded()) {
      return { 
        success: false, 
        error: 'Model not loaded. Please load a GGUF model first.' 
      };
    }

    try {
      // Start a new conversation if needed
      if (!memoryManager.listConversations().length) {
        memoryManager.startNewConversation(
          llmManager?.getModelPath() || undefined,
          llmManager?.getTemperature()
        );
      }

      const handlers: AgentEventHandlers = {
        onMessage: (msg: Message) => {
          mainWindow?.webContents.send(IPC_CHANNELS.RECEIVE_MESSAGE, msg);
          // Log message to memory bank
          memoryManager.addMessage(msg);
        },
        onToolStart: (toolName: string, args: Record<string, unknown>) => {
          mainWindow?.webContents.send(IPC_CHANNELS.TOOL_EXECUTION_START, { toolName, args });
        },
        onToolEnd: (toolName: string, result: ToolResult) => {
          mainWindow?.webContents.send(IPC_CHANNELS.TOOL_EXECUTION_END, { toolName, result });
        },
        onToken: (token: string) => {
          mainWindow?.webContents.send('token', token);
        },
        onError: (error: Error) => {
          mainWindow?.webContents.send('error', error.message);
        },
        onComplete: () => {
          mainWindow?.webContents.send('complete');
        },
      };

      const messages = await agent.processMessage(message, handlers);
      return { success: true, messages };
    } catch (error) {
      return { success: false, error: (error as Error).message };
    }
  });

  // Cancel generation
  ipcMain.handle(IPC_CHANNELS.CANCEL_GENERATION, async () => {
    if (agent) {
      agent.cancel();
      return { success: true };
    }
    return { success: false, error: 'No agent running' };
  });

  // Get configuration
  ipcMain.handle(IPC_CHANNELS.GET_CONFIG, async () => {
    return {
      ...config,
      modelLoaded: llmManager?.isModelLoaded() || false,
      modelInfo: llmManager?.getModelInfo() || null,
    };
  });

  // Set configuration
  ipcMain.handle(IPC_CHANNELS.SET_CONFIG, async (_, newConfig: Partial<AgentConfig>) => {
    config = { ...config, ...newConfig };
    
    if (newConfig.workspaceDir) {
      ensureWorkspaceDir();
      if (agent) {
        agent.setWorkspaceDir(config.workspaceDir);
      }
    }

    return { success: true, config };
  });

  // Set workspace directory
  ipcMain.handle(IPC_CHANNELS.SET_WORKSPACE, async () => {
    const result = await dialog.showOpenDialog(mainWindow!, {
      properties: ['openDirectory', 'createDirectory'],
      title: 'Select Workspace Directory',
    });

    if (!result.canceled && result.filePaths.length > 0) {
      config.workspaceDir = result.filePaths[0];
      if (agent) {
        agent.setWorkspaceDir(config.workspaceDir);
      }
      return { success: true, workspaceDir: config.workspaceDir };
    }

    return { success: false };
  });

  // Select model file
  ipcMain.handle('select-model', async () => {
    const result = await dialog.showOpenDialog(mainWindow!, {
      properties: ['openFile'],
      filters: [
        { name: 'GGUF Models', extensions: ['gguf'] },
        { name: 'All Files', extensions: ['*'] },
      ],
      title: 'Select GGUF Model',
    });

    if (!result.canceled && result.filePaths.length > 0) {
      return { success: true, modelPath: result.filePaths[0] };
    }

    return { success: false };
  });

  // Get tool definitions
  ipcMain.handle('get-tools', async () => {
    return getToolDefinitionsForLLM();
  });

  // Clear conversation history
  ipcMain.handle('clear-history', async () => {
    if (agent) {
      agent.clearHistory();
      return { success: true };
    }
    return { success: false };
  });

  // Upload media into the workspace
  ipcMain.handle('upload-media', async () => {
    try {
      if (!mainWindow) {
        return { success: false, error: 'No active window' };
      }
      const result = await dialog.showOpenDialog(mainWindow, {
        properties: ['openFile', 'multiSelections'],
        filters: [
          { name: 'Supported Files', extensions: ['txt', 'rtf', 'pdf', 'jpg', 'jpeg', 'png'] },
          { name: 'Text Files', extensions: ['txt', 'rtf'] },
          { name: 'PDF Documents', extensions: ['pdf'] },
          { name: 'Images', extensions: ['jpg', 'jpeg', 'png', 'gif'] },
          { name: 'All Files', extensions: ['*'] },
        ],
        title: 'Select files to upload',
      });

      if (result.canceled || result.filePaths.length === 0) {
        return { success: false };
      }

      const uploadedFiles: Array<{ fileName: string; type: string; textContent?: string }> = [];

      for (const selectedPath of result.filePaths) {
        const fileName = path.basename(selectedPath);

        // Ensure workspace directory exists
        ensureWorkspaceDir();

        const destPath = path.join(config.workspaceDir, fileName);

        // Copy the selected file into the workspace directory
        await fs.promises.copyFile(selectedPath, destPath);

        // Parse the file to extract text content
        const parsed = await parseFile(destPath);
        uploadedFiles.push({
          fileName,
          type: parsed.type,
          textContent: parsed.textContent,
        });
      }

      return { 
        success: true, 
        files: uploadedFiles,
        fileName: uploadedFiles[0]?.fileName, // For backward compatibility
      };
    } catch (err) {
      console.error('Failed to upload media:', err);
      return { success: false, error: (err as Error).message };
    }
  });

  // Temperature control
  ipcMain.handle(IPC_CHANNELS.SET_TEMPERATURE, async (_, temperature: number) => {
    if (llmManager) {
      llmManager.setTemperature(temperature);
      return { success: true, temperature: llmManager.getTemperature() };
    }
    return { success: false, error: 'LLM not initialized' };
  });

  ipcMain.handle(IPC_CHANNELS.GET_TEMPERATURE, async () => {
    if (llmManager) {
      return { success: true, temperature: llmManager.getTemperature() };
    }
    return { success: true, temperature: 0.7 };
  });

  // Memory bank handlers
  ipcMain.handle(IPC_CHANNELS.GET_MEMORY_STATS, async () => {
    try {
      const stats = await memoryManager.getMemoryStats();
      return { success: true, ...stats };
    } catch (err) {
      return { success: false, error: (err as Error).message };
    }
  });

  ipcMain.handle(IPC_CHANNELS.LIST_CONVERSATIONS, async () => {
    try {
      const conversations = memoryManager.listConversations();
      return { success: true, conversations };
    } catch (err) {
      return { success: false, error: (err as Error).message };
    }
  });

  ipcMain.handle(IPC_CHANNELS.LOAD_CONVERSATION, async (_, id: string) => {
    try {
      const conversation = memoryManager.loadConversation(id);
      if (conversation) {
        return { success: true, conversation };
      }
      return { success: false, error: 'Conversation not found' };
    } catch (err) {
      return { success: false, error: (err as Error).message };
    }
  });

  ipcMain.handle(IPC_CHANNELS.CLEAR_MEMORY, async () => {
    try {
      memoryManager.clearCurrentConversation();
      return { success: true };
    } catch (err) {
      return { success: false, error: (err as Error).message };
    }
  });
}

// App lifecycle
app.whenReady().then(async () => {
  ensureWorkspaceDir();
  setupIpcHandlers();
  createWindow();

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow();
    }
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

app.on('before-quit', async () => {
  if (llmManager) {
    await llmManager.unload();
  }
});
