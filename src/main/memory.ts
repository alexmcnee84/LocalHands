import * as fs from 'fs';
import * as path from 'path';
import { app } from 'electron';
import { v4 as uuidv4 } from 'uuid';
import { Message, ConversationMeta, ConversationLog, AttachmentInfo } from '../shared/types';

const MAX_MEMORY_SIZE_BYTES = 3 * 1024 * 1024 * 1024; // 3GB

interface MemoryIndex {
  conversations: ConversationMeta[];
  totalSize: number;
  lastUpdated: number;
}

export class MemoryManager {
  private memoryDir: string;
  private conversationsDir: string;
  private indexPath: string;
  private currentConversationId: string | null = null;
  private currentMessages: Message[] = [];

  constructor() {
    this.memoryDir = path.join(app.getPath('userData'), 'memory');
    this.conversationsDir = path.join(this.memoryDir, 'conversations');
    this.indexPath = path.join(this.memoryDir, 'index.json');
    this.ensureDirectories();
  }

  private ensureDirectories(): void {
    if (!fs.existsSync(this.memoryDir)) {
      fs.mkdirSync(this.memoryDir, { recursive: true });
    }
    if (!fs.existsSync(this.conversationsDir)) {
      fs.mkdirSync(this.conversationsDir, { recursive: true });
    }
  }

  private loadIndex(): MemoryIndex {
    try {
      if (fs.existsSync(this.indexPath)) {
        const data = fs.readFileSync(this.indexPath, 'utf-8');
        return JSON.parse(data);
      }
    } catch (err) {
      console.error('Failed to load memory index:', err);
    }
    return { conversations: [], totalSize: 0, lastUpdated: Date.now() };
  }

  private saveIndex(index: MemoryIndex): void {
    try {
      index.lastUpdated = Date.now();
      fs.writeFileSync(this.indexPath, JSON.stringify(index, null, 2));
    } catch (err) {
      console.error('Failed to save memory index:', err);
    }
  }

  startNewConversation(modelName?: string, temperature?: number): string {
    const id = uuidv4();
    const timestamp = Date.now();
    
    this.currentConversationId = id;
    this.currentMessages = [];

    const conversationDir = path.join(this.conversationsDir, `${new Date(timestamp).toISOString().replace(/[:.]/g, '-')}__${id}`);
    fs.mkdirSync(conversationDir, { recursive: true });
    fs.mkdirSync(path.join(conversationDir, 'attachments'), { recursive: true });

    const meta: ConversationMeta = {
      id,
      startedAt: timestamp,
      updatedAt: timestamp,
      title: 'New Conversation',
      messageCount: 0,
      modelName,
      temperature,
    };

    const log: ConversationLog = {
      meta,
      messages: [],
      attachments: [],
    };

    fs.writeFileSync(path.join(conversationDir, 'meta.json'), JSON.stringify(meta, null, 2));
    fs.writeFileSync(path.join(conversationDir, 'transcript.json'), JSON.stringify(log, null, 2));

    const index = this.loadIndex();
    index.conversations.push(meta);
    this.saveIndex(index);

    return id;
  }

  addMessage(message: Message): void {
    if (!this.currentConversationId) {
      this.startNewConversation();
    }

    this.currentMessages.push(message);
    this.saveCurrentConversation();
  }

  private getConversationDir(): string | null {
    if (!this.currentConversationId) return null;

    const index = this.loadIndex();
    const meta = index.conversations.find(c => c.id === this.currentConversationId);
    if (!meta) return null;

    const dirs = fs.readdirSync(this.conversationsDir);
    const dir = dirs.find(d => d.includes(this.currentConversationId!));
    return dir ? path.join(this.conversationsDir, dir) : null;
  }

  private saveCurrentConversation(): void {
    const conversationDir = this.getConversationDir();
    if (!conversationDir) return;

    const index = this.loadIndex();
    const metaIndex = index.conversations.findIndex(c => c.id === this.currentConversationId);
    if (metaIndex === -1) return;

    const meta = index.conversations[metaIndex];
    meta.updatedAt = Date.now();
    meta.messageCount = this.currentMessages.length;

    if (this.currentMessages.length > 0 && this.currentMessages[0].role === 'user') {
      meta.title = this.currentMessages[0].content.slice(0, 100);
    }

    const log: ConversationLog = {
      meta,
      messages: this.currentMessages,
    };

    try {
      fs.writeFileSync(path.join(conversationDir, 'meta.json'), JSON.stringify(meta, null, 2));
      fs.writeFileSync(path.join(conversationDir, 'transcript.json'), JSON.stringify(log, null, 2));
      this.generateHtmlTranscript(conversationDir, log);
      this.saveIndex(index);
    } catch (err) {
      console.error('Failed to save conversation:', err);
    }
  }

  private generateHtmlTranscript(conversationDir: string, log: ConversationLog): void {
    const html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Conversation: ${this.escapeHtml(log.meta.title)}</title>
  <style>
    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
      background: #1a1a2e;
      color: #e0e0e0;
      max-width: 800px;
      margin: 0 auto;
      padding: 20px;
    }
    .header {
      border-bottom: 2px solid #00d4ff;
      padding-bottom: 10px;
      margin-bottom: 20px;
    }
    .meta {
      color: #888;
      font-size: 0.9em;
    }
    .message {
      margin: 15px 0;
      padding: 15px;
      border-radius: 8px;
    }
    .user { background: #2a2a4e; border-left: 4px solid #00d4ff; }
    .assistant { background: #1e3a2e; border-left: 4px solid #00ff88; }
    .system { background: #3a2a1e; border-left: 4px solid #ff8800; }
    .tool { background: #2a2a2a; border-left: 4px solid #888; font-family: monospace; }
    .role { font-weight: bold; margin-bottom: 8px; text-transform: capitalize; }
    .content { white-space: pre-wrap; }
    .timestamp { color: #666; font-size: 0.8em; margin-top: 8px; }
  </style>
</head>
<body>
  <div class="header">
    <h1>${this.escapeHtml(log.meta.title)}</h1>
    <div class="meta">
      <p>Started: ${new Date(log.meta.startedAt).toLocaleString()}</p>
      <p>Messages: ${log.meta.messageCount}</p>
      ${log.meta.modelName ? `<p>Model: ${this.escapeHtml(log.meta.modelName)}</p>` : ''}
      ${log.meta.temperature !== undefined ? `<p>Temperature: ${log.meta.temperature}</p>` : ''}
    </div>
  </div>
  <div class="messages">
    ${log.messages.map(msg => `
      <div class="message ${msg.role}">
        <div class="role">${msg.role}</div>
        <div class="content">${this.escapeHtml(msg.content)}</div>
        <div class="timestamp">${new Date(msg.timestamp).toLocaleString()}</div>
      </div>
    `).join('')}
  </div>
</body>
</html>`;

    fs.writeFileSync(path.join(conversationDir, 'transcript.html'), html);
  }

  private escapeHtml(text: string): string {
    return text
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#039;');
  }

  async calculateTotalSize(): Promise<number> {
    let totalSize = 0;
    
    const walkDir = (dir: string): void => {
      try {
        const files = fs.readdirSync(dir);
        for (const file of files) {
          const filePath = path.join(dir, file);
          const stat = fs.statSync(filePath);
          if (stat.isDirectory()) {
            walkDir(filePath);
          } else {
            totalSize += stat.size;
          }
        }
      } catch (err) {
        console.error('Error calculating size:', err);
      }
    };

    walkDir(this.memoryDir);
    return totalSize;
  }

  async pruneOldConversations(): Promise<void> {
    const totalSize = await this.calculateTotalSize();
    if (totalSize <= MAX_MEMORY_SIZE_BYTES) return;

    const index = this.loadIndex();
    const sorted = [...index.conversations].sort((a, b) => a.updatedAt - b.updatedAt);

    let currentSize = totalSize;
    for (const conv of sorted) {
      if (currentSize <= MAX_MEMORY_SIZE_BYTES * 0.9) break;
      if (conv.id === this.currentConversationId) continue;

      const dirs = fs.readdirSync(this.conversationsDir);
      const dir = dirs.find(d => d.includes(conv.id));
      if (dir) {
        const convDir = path.join(this.conversationsDir, dir);
        const convSize = await this.getDirSize(convDir);
        fs.rmSync(convDir, { recursive: true, force: true });
        currentSize -= convSize;
        
        const idx = index.conversations.findIndex(c => c.id === conv.id);
        if (idx !== -1) {
          index.conversations.splice(idx, 1);
        }
      }
    }

    index.totalSize = currentSize;
    this.saveIndex(index);
  }

  private async getDirSize(dir: string): Promise<number> {
    let size = 0;
    try {
      const files = fs.readdirSync(dir);
      for (const file of files) {
        const filePath = path.join(dir, file);
        const stat = fs.statSync(filePath);
        if (stat.isDirectory()) {
          size += await this.getDirSize(filePath);
        } else {
          size += stat.size;
        }
      }
    } catch (err) {
      console.error('Error getting dir size:', err);
    }
    return size;
  }

  listConversations(): ConversationMeta[] {
    const index = this.loadIndex();
    return index.conversations.sort((a, b) => b.updatedAt - a.updatedAt);
  }

  loadConversation(id: string): ConversationLog | null {
    const dirs = fs.readdirSync(this.conversationsDir);
    const dir = dirs.find(d => d.includes(id));
    if (!dir) return null;

    const transcriptPath = path.join(this.conversationsDir, dir, 'transcript.json');
    if (!fs.existsSync(transcriptPath)) return null;

    try {
      const data = fs.readFileSync(transcriptPath, 'utf-8');
      return JSON.parse(data);
    } catch (err) {
      console.error('Failed to load conversation:', err);
      return null;
    }
  }

  getMemoryDir(): string {
    return this.memoryDir;
  }

  async getMemoryStats(): Promise<{ totalSize: number; conversationCount: number; maxSize: number }> {
    const totalSize = await this.calculateTotalSize();
    const index = this.loadIndex();
    return {
      totalSize,
      conversationCount: index.conversations.length,
      maxSize: MAX_MEMORY_SIZE_BYTES,
    };
  }

  clearCurrentConversation(): void {
    this.currentConversationId = null;
    this.currentMessages = [];
  }
}

// Lazy singleton - only instantiate after app is ready
let _memoryManager: MemoryManager | null = null;

export function getMemoryManager(): MemoryManager {
  if (!_memoryManager) {
    _memoryManager = new MemoryManager();
  }
  return _memoryManager;
}
