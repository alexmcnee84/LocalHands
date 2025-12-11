import * as fs from 'fs';
import * as path from 'path';
import { ToolResult, ToolDefinition } from '../../shared/types';

export const FILE_EDITOR_TOOL_NAME = 'str_replace_editor';

export const fileEditorToolDefinition: ToolDefinition = {
  type: 'function',
  function: {
    name: FILE_EDITOR_TOOL_NAME,
    description: `Custom editing tool for viewing, creating and editing files in plain-text format.

* State is persistent across command calls
* If path is a file, view displays the result with line numbers
* If path is a directory, view lists files up to 2 levels deep
* The create command cannot be used if the file already exists
* The undo_edit command will revert the last edit made to the file

Commands:
- view: View file contents or directory listing
- create: Create a new file with content
- str_replace: Replace a string in a file
- insert: Insert text after a specific line
- undo_edit: Revert the last edit

CRITICAL: The old_str must match EXACTLY including whitespace and indentation.`,
    parameters: {
      type: 'object',
      properties: {
        command: {
          type: 'string',
          description: 'The command to run: view, create, str_replace, insert, undo_edit',
          enum: ['view', 'create', 'str_replace', 'insert', 'undo_edit'],
        },
        path: {
          type: 'string',
          description: 'Absolute path to file or directory',
        },
        file_text: {
          type: 'string',
          description: 'Content for create command',
        },
        old_str: {
          type: 'string',
          description: 'String to replace (for str_replace)',
        },
        new_str: {
          type: 'string',
          description: 'Replacement string (for str_replace and insert)',
        },
        insert_line: {
          type: 'number',
          description: 'Line number after which to insert (for insert)',
        },
        view_range: {
          type: 'array',
          description: 'Line range to view [start, end], e.g. [1, 50]',
          items: { type: 'number' },
        },
      },
      required: ['command', 'path'],
    },
  },
};

interface FileEditorOptions {
  workspaceDir: string;
  maxFileSize?: number;
  maxOutputLines?: number;
}

interface FileBackup {
  path: string;
  content: string;
  timestamp: number;
}

export class FileEditor {
  private workspaceDir: string;
  private maxFileSize: number;
  private maxOutputLines: number;
  private backups: Map<string, FileBackup[]> = new Map();

  constructor(options: FileEditorOptions) {
    this.workspaceDir = options.workspaceDir;
    this.maxFileSize = options.maxFileSize || 10 * 1024 * 1024; // 10MB
    this.maxOutputLines = options.maxOutputLines || 1000;
  }

  private isPathWithinWorkspace(targetPath: string): boolean {
    const resolvedPath = path.resolve(targetPath);
    const normalizedWorkspace = path.normalize(this.workspaceDir);
    const normalizedTarget = path.normalize(resolvedPath);
    return normalizedTarget.startsWith(normalizedWorkspace);
  }

  private resolvePath(filePath: string): string {
    if (path.isAbsolute(filePath)) {
      return filePath;
    }
    return path.resolve(this.workspaceDir, filePath);
  }

  private addLineNumbers(content: string, startLine: number = 1): string {
    const lines = content.split('\n');
    const maxLineNumWidth = String(startLine + lines.length - 1).length;
    return lines
      .map((line, i) => {
        const lineNum = String(startLine + i).padStart(maxLineNumWidth, ' ');
        return `${lineNum}\t${line}`;
      })
      .join('\n');
  }

  private saveBackup(filePath: string, content: string): void {
    const backups = this.backups.get(filePath) || [];
    backups.push({
      path: filePath,
      content,
      timestamp: Date.now(),
    });
    // Keep only last 10 backups per file
    if (backups.length > 10) {
      backups.shift();
    }
    this.backups.set(filePath, backups);
  }

  async execute(args: {
    command: string;
    path: string;
    file_text?: string;
    old_str?: string;
    new_str?: string;
    insert_line?: number;
    view_range?: number[];
  }): Promise<ToolResult> {
    const { command, path: filePath, file_text, old_str, new_str, insert_line, view_range } = args;

    const resolvedPath = this.resolvePath(filePath);

    if (!this.isPathWithinWorkspace(resolvedPath)) {
      return {
        toolCallId: '',
        success: false,
        output: '',
        error: `Cannot access files outside workspace: ${filePath}`,
      };
    }

    try {
      switch (command) {
        case 'view':
          return await this.view(resolvedPath, view_range);
        case 'create':
          return await this.create(resolvedPath, file_text || '');
        case 'str_replace':
          return await this.strReplace(resolvedPath, old_str || '', new_str || '');
        case 'insert':
          return await this.insert(resolvedPath, insert_line || 0, new_str || '');
        case 'undo_edit':
          return await this.undoEdit(resolvedPath);
        default:
          return {
            toolCallId: '',
            success: false,
            output: '',
            error: `Unknown command: ${command}`,
          };
      }
    } catch (err) {
      return {
        toolCallId: '',
        success: false,
        output: '',
        error: `Error executing ${command}: ${(err as Error).message}`,
      };
    }
  }

  private async view(filePath: string, viewRange?: number[]): Promise<ToolResult> {
    const stats = await fs.promises.stat(filePath).catch(() => null);

    if (!stats) {
      return {
        toolCallId: '',
        success: false,
        output: '',
        error: `Path does not exist: ${filePath}`,
      };
    }

    if (stats.isDirectory()) {
      return await this.listDirectory(filePath);
    }

    if (stats.size > this.maxFileSize) {
      return {
        toolCallId: '',
        success: false,
        output: '',
        error: `File too large (${stats.size} bytes). Maximum: ${this.maxFileSize} bytes`,
      };
    }

    const content = await fs.promises.readFile(filePath, 'utf-8');
    const lines = content.split('\n');

    let startLine = 1;
    let endLine = lines.length;

    if (viewRange && viewRange.length === 2) {
      startLine = Math.max(1, viewRange[0]);
      endLine = viewRange[1] === -1 ? lines.length : Math.min(lines.length, viewRange[1]);
    }

    const selectedLines = lines.slice(startLine - 1, endLine);
    let output = this.addLineNumbers(selectedLines.join('\n'), startLine);

    if (selectedLines.length > this.maxOutputLines) {
      output = this.addLineNumbers(selectedLines.slice(0, this.maxOutputLines).join('\n'), startLine);
      output += '\n... [output truncated]';
    }

    return {
      toolCallId: '',
      success: true,
      output: `File: ${filePath}\n${output}`,
    };
  }

  private async listDirectory(dirPath: string, depth: number = 0, maxDepth: number = 2): Promise<ToolResult> {
    if (depth > maxDepth) {
      return { toolCallId: '', success: true, output: '' };
    }

    const entries = await fs.promises.readdir(dirPath, { withFileTypes: true });
    const indent = '  '.repeat(depth);
    let output = '';

    for (const entry of entries) {
      if (entry.name.startsWith('.')) continue; // Skip hidden files

      const entryPath = path.join(dirPath, entry.name);
      
      if (entry.isDirectory()) {
        output += `${indent}${entry.name}/\n`;
        if (depth < maxDepth) {
          const subResult = await this.listDirectory(entryPath, depth + 1, maxDepth);
          output += subResult.output;
        }
      } else {
        const stats = await fs.promises.stat(entryPath);
        const size = this.formatSize(stats.size);
        output += `${indent}${entry.name} (${size})\n`;
      }
    }

    if (depth === 0) {
      return {
        toolCallId: '',
        success: true,
        output: `Directory: ${dirPath}\n${output}`,
      };
    }

    return { toolCallId: '', success: true, output };
  }

  private formatSize(bytes: number): string {
    if (bytes < 1024) return `${bytes}B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)}KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)}MB`;
  }

  private async create(filePath: string, content: string): Promise<ToolResult> {
    const exists = await fs.promises.stat(filePath).catch(() => null);

    if (exists) {
      return {
        toolCallId: '',
        success: false,
        output: '',
        error: `File already exists: ${filePath}. Use str_replace to edit existing files.`,
      };
    }

    // Create parent directories if needed
    const dir = path.dirname(filePath);
    await fs.promises.mkdir(dir, { recursive: true });

    await fs.promises.writeFile(filePath, content, 'utf-8');

    const lines = content.split('\n').length;
    return {
      toolCallId: '',
      success: true,
      output: `File created successfully: ${filePath} (${lines} lines)`,
    };
  }

  private async strReplace(filePath: string, oldStr: string, newStr: string): Promise<ToolResult> {
    if (!oldStr) {
      return {
        toolCallId: '',
        success: false,
        output: '',
        error: 'old_str parameter is required for str_replace',
      };
    }

    const content = await fs.promises.readFile(filePath, 'utf-8');

    // Check if old_str exists in the file
    const occurrences = content.split(oldStr).length - 1;

    if (occurrences === 0) {
      return {
        toolCallId: '',
        success: false,
        output: '',
        error: `String not found in file. Make sure old_str matches exactly including whitespace.\n\nSearched for:\n${oldStr}`,
      };
    }

    if (occurrences > 1) {
      return {
        toolCallId: '',
        success: false,
        output: '',
        error: `String found ${occurrences} times. old_str must be unique. Add more context to make it unique.`,
      };
    }

    // Save backup before editing
    this.saveBackup(filePath, content);

    const newContent = content.replace(oldStr, newStr);
    await fs.promises.writeFile(filePath, newContent, 'utf-8');

    // Show diff-like output
    const oldLines = oldStr.split('\n').length;
    const newLines = newStr.split('\n').length;

    return {
      toolCallId: '',
      success: true,
      output: `File edited successfully: ${filePath}\nReplaced ${oldLines} line(s) with ${newLines} line(s)`,
    };
  }

  private async insert(filePath: string, insertLine: number, newStr: string): Promise<ToolResult> {
    if (insertLine < 0) {
      return {
        toolCallId: '',
        success: false,
        output: '',
        error: 'insert_line must be >= 0',
      };
    }

    const content = await fs.promises.readFile(filePath, 'utf-8');
    const lines = content.split('\n');

    if (insertLine > lines.length) {
      return {
        toolCallId: '',
        success: false,
        output: '',
        error: `insert_line (${insertLine}) exceeds file length (${lines.length} lines)`,
      };
    }

    // Save backup before editing
    this.saveBackup(filePath, content);

    // Insert after the specified line
    lines.splice(insertLine, 0, newStr);
    const newContent = lines.join('\n');

    await fs.promises.writeFile(filePath, newContent, 'utf-8');

    const insertedLines = newStr.split('\n').length;
    return {
      toolCallId: '',
      success: true,
      output: `Inserted ${insertedLines} line(s) after line ${insertLine} in ${filePath}`,
    };
  }

  private async undoEdit(filePath: string): Promise<ToolResult> {
    const backups = this.backups.get(filePath);

    if (!backups || backups.length === 0) {
      return {
        toolCallId: '',
        success: false,
        output: '',
        error: `No edit history found for: ${filePath}`,
      };
    }

    const lastBackup = backups.pop()!;
    this.backups.set(filePath, backups);

    await fs.promises.writeFile(filePath, lastBackup.content, 'utf-8');

    return {
      toolCallId: '',
      success: true,
      output: `Reverted ${filePath} to previous state (${new Date(lastBackup.timestamp).toISOString()})`,
    };
  }

  getWorkspaceDir(): string {
    return this.workspaceDir;
  }
}
