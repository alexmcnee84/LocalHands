import { spawn, ChildProcess } from 'child_process';
import * as path from 'path';
import { ToolResult, ToolDefinition } from '../../shared/types';

export const BASH_TOOL_NAME = 'execute_bash';

export const bashToolDefinition: ToolDefinition = {
  type: 'function',
  function: {
    name: BASH_TOOL_NAME,
    description: `Execute a bash command in the terminal within a sandboxed workspace.

### Command Execution
* One command at a time: Execute one bash command at a time. Chain multiple commands with && or ;
* Persistent session: Environment variables and working directory persist between commands
* Timeout: Commands have a default timeout of 30 seconds

### Long-running Commands
* For commands that may run indefinitely, run them in the background: python3 app.py > server.log 2>&1 &
* Set the timeout parameter for commands that need more time

### Best Practices
* Use absolute paths when possible
* Verify directories exist before creating files
* Output is truncated if too long`,
    parameters: {
      type: 'object',
      properties: {
        command: {
          type: 'string',
          description: 'The bash command to execute. Can be empty to view additional logs.',
        },
        timeout: {
          type: 'number',
          description: 'Optional timeout in seconds (default: 30)',
        },
        workingDir: {
          type: 'string',
          description: 'Optional working directory for the command',
        },
      },
      required: ['command'],
    },
  },
};

interface BashExecutorOptions {
  workspaceDir: string;
  maxOutputLength?: number;
  defaultTimeout?: number;
}

export class BashExecutor {
  private workspaceDir: string;
  private maxOutputLength: number;
  private defaultTimeout: number;
  private currentProcess: ChildProcess | null = null;
  private currentWorkingDir: string;

  constructor(options: BashExecutorOptions) {
    this.workspaceDir = options.workspaceDir;
    this.maxOutputLength = options.maxOutputLength || 50000;
    this.defaultTimeout = options.defaultTimeout || 30000;
    this.currentWorkingDir = this.workspaceDir;
  }

  private isPathWithinWorkspace(targetPath: string): boolean {
    const resolvedPath = path.resolve(this.currentWorkingDir, targetPath);
    const normalizedWorkspace = path.normalize(this.workspaceDir);
    const normalizedTarget = path.normalize(resolvedPath);
    return normalizedTarget.startsWith(normalizedWorkspace);
  }

  private sanitizeCommand(command: string): { safe: boolean; reason?: string } {
    const dangerousPatterns = [
      /rm\s+-rf\s+\/(?!\s|$)/,
      /rm\s+-rf\s+~(?!\s|$)/,
      />\s*\/dev\/sd[a-z]/,
      /mkfs\./,
      /dd\s+if=.*of=\/dev/,
      /:(){ :|:& };:/,
    ];

    for (const pattern of dangerousPatterns) {
      if (pattern.test(command)) {
        return { safe: false, reason: 'Command contains potentially dangerous patterns' };
      }
    }

    return { safe: true };
  }

  async execute(args: {
    command: string;
    timeout?: number;
    workingDir?: string;
  }): Promise<ToolResult> {
    const { command, timeout, workingDir } = args;
    const timeoutMs = (timeout || this.defaultTimeout / 1000) * 1000;

    if (!command || command.trim() === '') {
      return {
        toolCallId: '',
        success: false,
        output: '',
        error: 'Empty command provided',
        exitCode: 1,
      };
    }

    const sanitizeResult = this.sanitizeCommand(command);
    if (!sanitizeResult.safe) {
      return {
        toolCallId: '',
        success: false,
        output: '',
        error: sanitizeResult.reason || 'Command blocked for safety reasons',
        exitCode: 1,
      };
    }

    const execDir = workingDir 
      ? path.resolve(this.currentWorkingDir, workingDir)
      : this.currentWorkingDir;

    if (!this.isPathWithinWorkspace(execDir)) {
      return {
        toolCallId: '',
        success: false,
        output: '',
        error: `Cannot execute commands outside workspace: ${execDir}`,
        exitCode: 1,
      };
    }

    return new Promise((resolve) => {
      let stdout = '';
      let stderr = '';
      let timedOut = false;

      const shell = process.platform === 'win32' ? 'powershell.exe' : '/bin/bash';
      const shellArgs = process.platform === 'win32' ? ['-Command', command] : ['-c', command];

      this.currentProcess = spawn(shell, shellArgs, {
        cwd: execDir,
        env: {
          ...process.env,
          WORKSPACE: this.workspaceDir,
        },
        shell: false,
      });

      const timeoutId = setTimeout(() => {
        timedOut = true;
        if (this.currentProcess) {
          this.currentProcess.kill('SIGTERM');
          setTimeout(() => {
            if (this.currentProcess && !this.currentProcess.killed) {
              this.currentProcess.kill('SIGKILL');
            }
          }, 1000);
        }
      }, timeoutMs);

      this.currentProcess.stdout?.on('data', (data) => {
        stdout += data.toString();
        if (stdout.length > this.maxOutputLength) {
          stdout = stdout.slice(0, this.maxOutputLength) + '\n... [output truncated]';
        }
      });

      this.currentProcess.stderr?.on('data', (data) => {
        stderr += data.toString();
        if (stderr.length > this.maxOutputLength) {
          stderr = stderr.slice(0, this.maxOutputLength) + '\n... [output truncated]';
        }
      });

      this.currentProcess.on('close', (code) => {
        clearTimeout(timeoutId);
        this.currentProcess = null;

        const output = stdout + (stderr ? `\n[stderr]\n${stderr}` : '');
        const exitCode = timedOut ? -1 : (code ?? 0);

        if (timedOut) {
          resolve({
            toolCallId: '',
            success: false,
            output: output + `\n[Command timed out after ${timeout || this.defaultTimeout / 1000} seconds]`,
            exitCode,
            error: 'Command timed out',
          });
        } else {
          resolve({
            toolCallId: '',
            success: exitCode === 0,
            output: output || '(no output)',
            exitCode,
            error: exitCode !== 0 ? `Command exited with code ${exitCode}` : undefined,
          });
        }
      });

      this.currentProcess.on('error', (err) => {
        clearTimeout(timeoutId);
        this.currentProcess = null;
        resolve({
          toolCallId: '',
          success: false,
          output: '',
          exitCode: 1,
          error: `Failed to execute command: ${err.message}`,
        });
      });
    });
  }

  cancel(): void {
    if (this.currentProcess) {
      this.currentProcess.kill('SIGTERM');
      setTimeout(() => {
        if (this.currentProcess && !this.currentProcess.killed) {
          this.currentProcess.kill('SIGKILL');
        }
      }, 1000);
    }
  }

  setWorkingDir(dir: string): boolean {
    const resolvedDir = path.resolve(this.currentWorkingDir, dir);
    if (this.isPathWithinWorkspace(resolvedDir)) {
      this.currentWorkingDir = resolvedDir;
      return true;
    }
    return false;
  }

  getWorkingDir(): string {
    return this.currentWorkingDir;
  }

  getWorkspaceDir(): string {
    return this.workspaceDir;
  }
}
