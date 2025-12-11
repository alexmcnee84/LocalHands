import { v4 as uuidv4 } from 'uuid';
import { LLMManager, ChatMessage, LLMResponse } from './llm';
import { BashExecutor, FileEditor, BrowserAutomation, getToolDefinitionsForLLM, BASH_TOOL_NAME, FILE_EDITOR_TOOL_NAME, BROWSER_TOOL_NAME } from './tools';
import { Message, ToolCall, ToolResult, AgentConfig } from '../shared/types';

const DEFAULT_SYSTEM_PROMPT = `You are LocalHands, a helpful AI assistant with access to tools for executing code, editing files, and browsing the web.

Your capabilities include:
1. **Bash Commands**: Execute shell commands in a sandboxed workspace
2. **File Operations**: View, create, and edit files using the str_replace_editor tool
3. **Browser Automation**: Navigate and interact with web pages (if available)

## Guidelines

### General
- Be helpful, accurate, and concise
- When asked to perform tasks, use the appropriate tools
- Explain what you're doing and why
- If a task fails, try alternative approaches

### Code Execution
- Always work within the designated workspace directory
- Be careful with destructive operations
- Test changes incrementally when possible

### File Editing
- Use the view command to understand file contents before editing
- Make precise edits using str_replace with exact string matching
- Verify edits were successful

### Safety
- Never execute commands that could harm the system
- Stay within the workspace directory
- Ask for confirmation before destructive operations

When you need to use a tool, format your response with a JSON block containing tool_calls.
`;

export interface AgentEventHandlers {
  onMessage?: (message: Message) => void;
  onToolStart?: (toolName: string, args: Record<string, unknown>) => void;
  onToolEnd?: (toolName: string, result: ToolResult) => void;
  onToken?: (token: string) => void;
  onError?: (error: Error) => void;
  onComplete?: () => void;
}

export class Agent {
  private llm: LLMManager;
  private bashExecutor: BashExecutor;
  private fileEditor: FileEditor;
  private browserAutomation: BrowserAutomation;
  private config: AgentConfig;
  private conversationHistory: ChatMessage[] = [];
  private isProcessing: boolean = false;
  private shouldCancel: boolean = false;
  private maxIterations: number;

  constructor(llm: LLMManager, config: AgentConfig) {
    this.llm = llm;
    this.config = config;
    this.maxIterations = config.maxIterations || 10;

    // Initialize tools
    this.bashExecutor = new BashExecutor({
      workspaceDir: config.workspaceDir,
    });

    this.fileEditor = new FileEditor({
      workspaceDir: config.workspaceDir,
    });

    this.browserAutomation = new BrowserAutomation();

    // Set up LLM with tools
    this.llm.setTools(getToolDefinitionsForLLM() as any);
    this.llm.setSystemPrompt(DEFAULT_SYSTEM_PROMPT);
  }

  async processMessage(userMessage: string, handlers: AgentEventHandlers = {}): Promise<Message[]> {
    if (this.isProcessing) {
      throw new Error('Agent is already processing a message');
    }

    this.isProcessing = true;
    this.shouldCancel = false;
    const messages: Message[] = [];

    try {
      // Add user message to history
      const userChatMessage: ChatMessage = {
        role: 'user',
        content: userMessage,
      };
      this.conversationHistory.push(userChatMessage);

      // Create user message for UI
      const userMsg: Message = {
        id: uuidv4(),
        role: 'user',
        content: userMessage,
        timestamp: Date.now(),
      };
      messages.push(userMsg);
      handlers.onMessage?.(userMsg);

      // Agent loop: LLM -> tool calls -> results -> LLM -> ...
      let iterations = 0;
      let continueLoop = true;

      while (continueLoop && iterations < this.maxIterations && !this.shouldCancel) {
        iterations++;

        // Get LLM response
        let fullResponse = '';
        const response = await this.llm.chat(
          this.conversationHistory,
          (token) => {
            fullResponse += token;
            handlers.onToken?.(token);
          }
        );

        if (this.shouldCancel) {
          break;
        }

        // Check if there are tool calls
        if (response.toolCalls.length > 0) {
          // Add assistant message with tool calls to history
          const assistantMessage: ChatMessage = {
            role: 'assistant',
            content: response.content,
            toolCalls: response.toolCalls,
          };
          this.conversationHistory.push(assistantMessage);

          // Create assistant message for UI (if there's text content)
          if (response.content.trim()) {
            const assistantMsg: Message = {
              id: uuidv4(),
              role: 'assistant',
              content: response.content,
              timestamp: Date.now(),
            };
            messages.push(assistantMsg);
            handlers.onMessage?.(assistantMsg);
          }

          // Execute each tool call
          for (const toolCall of response.toolCalls) {
            if (this.shouldCancel) break;

            handlers.onToolStart?.(toolCall.name, toolCall.arguments);

            const result = await this.executeTool(toolCall);
            result.toolCallId = toolCall.id;

            handlers.onToolEnd?.(toolCall.name, result);

            // Add tool result to history
            const toolMessage: ChatMessage = {
              role: 'tool',
              content: result.success 
                ? result.output 
                : `Error: ${result.error}\n${result.output}`,
              toolCallId: toolCall.id,
            };
            this.conversationHistory.push(toolMessage);

            // Create tool message for UI
            const toolMsg: Message = {
              id: uuidv4(),
              role: 'tool',
              content: result.output,
              timestamp: Date.now(),
              toolCall,
              toolResult: result,
            };
            messages.push(toolMsg);
            handlers.onMessage?.(toolMsg);
          }

          // Continue loop to get LLM's response to tool results
          continueLoop = true;
        } else {
          // No tool calls, this is the final response
          const assistantMessage: ChatMessage = {
            role: 'assistant',
            content: response.content,
          };
          this.conversationHistory.push(assistantMessage);

          const assistantMsg: Message = {
            id: uuidv4(),
            role: 'assistant',
            content: response.content,
            timestamp: Date.now(),
          };
          messages.push(assistantMsg);
          handlers.onMessage?.(assistantMsg);

          continueLoop = false;
        }
      }

      if (iterations >= this.maxIterations) {
        const warningMsg: Message = {
          id: uuidv4(),
          role: 'system',
          content: `[Agent reached maximum iterations (${this.maxIterations}). Stopping to prevent infinite loops.]`,
          timestamp: Date.now(),
        };
        messages.push(warningMsg);
        handlers.onMessage?.(warningMsg);
      }

      handlers.onComplete?.();
      return messages;

    } catch (error) {
      const err = error as Error;
      handlers.onError?.(err);

      const errorMsg: Message = {
        id: uuidv4(),
        role: 'system',
        content: `Error: ${err.message}`,
        timestamp: Date.now(),
      };
      messages.push(errorMsg);
      handlers.onMessage?.(errorMsg);

      return messages;
    } finally {
      this.isProcessing = false;
    }
  }

  private async executeTool(toolCall: ToolCall): Promise<ToolResult> {
    const { name, arguments: args } = toolCall;

    try {
      switch (name) {
        case BASH_TOOL_NAME:
          return await this.bashExecutor.execute(args as {
            command: string;
            timeout?: number;
            workingDir?: string;
          });

        case FILE_EDITOR_TOOL_NAME:
          return await this.fileEditor.execute(args as {
            command: string;
            path: string;
            file_text?: string;
            old_str?: string;
            new_str?: string;
            insert_line?: number;
            view_range?: number[];
          });

        case BROWSER_TOOL_NAME:
          return await this.browserAutomation.execute(args as {
            action: string;
            url?: string;
            selector?: string;
            text?: string;
            script?: string;
          });

        default:
          return {
            toolCallId: toolCall.id,
            success: false,
            output: '',
            error: `Unknown tool: ${name}`,
          };
      }
    } catch (error) {
      return {
        toolCallId: toolCall.id,
        success: false,
        output: '',
        error: `Tool execution error: ${(error as Error).message}`,
      };
    }
  }

  cancel(): void {
    this.shouldCancel = true;
    this.bashExecutor.cancel();
  }

  clearHistory(): void {
    this.conversationHistory = [];
  }

  getHistory(): ChatMessage[] {
    return [...this.conversationHistory];
  }

  isAgentProcessing(): boolean {
    return this.isProcessing;
  }

  getWorkspaceDir(): string {
    return this.config.workspaceDir;
  }

  setWorkspaceDir(dir: string): void {
    this.config.workspaceDir = dir;
    this.bashExecutor = new BashExecutor({ workspaceDir: dir });
    this.fileEditor = new FileEditor({ workspaceDir: dir });
  }
}
