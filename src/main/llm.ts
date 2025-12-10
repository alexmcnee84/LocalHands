import { getLlama, LlamaModel, LlamaContext, LlamaChatSession, ChatHistoryItem, Token } from 'node-llama-cpp';
import * as path from 'path';
import * as fs from 'fs';
import { ToolDefinition, ToolCall } from '../shared/types';

export interface LLMConfig {
  modelPath: string;
  contextSize?: number;
  gpuLayers?: number;
  threads?: number;
}

export interface LLMResponse {
  content: string;
  toolCalls: ToolCall[];
  finishReason: 'stop' | 'tool_calls' | 'length' | 'error';
}

export interface ChatMessage {
  role: 'system' | 'user' | 'assistant' | 'tool';
  content: string;
  toolCallId?: string;
  toolCalls?: ToolCall[];
}

export class LLMManager {
  private llama: Awaited<ReturnType<typeof getLlama>> | null = null;
  private model: LlamaModel | null = null;
  private context: LlamaContext | null = null;
  private session: LlamaChatSession | null = null;
  private isLoaded: boolean = false;
  private currentModelPath: string | null = null;
  private tools: ToolDefinition[] = [];
  private systemPrompt: string = '';

  async loadModel(config: LLMConfig): Promise<void> {
    const { modelPath, contextSize = 4096, gpuLayers = 0, threads } = config;

    if (!fs.existsSync(modelPath)) {
      throw new Error(`Model file not found: ${modelPath}`);
    }

    // Unload previous model if any
    await this.unload();

    console.log(`Loading model from: ${modelPath}`);

    this.llama = await getLlama();
    
    this.model = await this.llama.loadModel({
      modelPath,
      gpuLayers,
    });

    this.context = await this.model.createContext({
      contextSize,
      threads,
    });

    this.currentModelPath = modelPath;
    this.isLoaded = true;

    console.log('Model loaded successfully');
  }

  async unload(): Promise<void> {
    if (this.session) {
      this.session = null;
    }
    if (this.context) {
      await this.context.dispose();
      this.context = null;
    }
    if (this.model) {
      await this.model.dispose();
      this.model = null;
    }
    this.llama = null;
    this.isLoaded = false;
    this.currentModelPath = null;
  }

  setTools(tools: ToolDefinition[]): void {
    this.tools = tools;
  }

  setSystemPrompt(prompt: string): void {
    this.systemPrompt = prompt;
  }

  private buildToolsPrompt(): string {
    if (this.tools.length === 0) return '';

    let prompt = '\n\n## Available Tools\n\nYou have access to the following tools:\n\n';

    for (const tool of this.tools) {
      prompt += `### ${tool.function.name}\n`;
      prompt += `${tool.function.description}\n\n`;
      prompt += `Parameters:\n`;
      prompt += '```json\n';
      prompt += JSON.stringify(tool.function.parameters, null, 2);
      prompt += '\n```\n\n';
    }

    prompt += `## Tool Usage Format

When you need to use a tool, respond with a JSON object in the following format:

\`\`\`json
{
  "tool_calls": [
    {
      "id": "unique_id",
      "name": "tool_name",
      "arguments": {
        "param1": "value1",
        "param2": "value2"
      }
    }
  ]
}
\`\`\`

You can call multiple tools in a single response. After receiving tool results, continue your response based on the results.

If you don't need to use any tools, respond normally with text.

IMPORTANT: Always use the exact tool names and parameter names as specified above.
`;

    return prompt;
  }

  private parseToolCalls(content: string): { text: string; toolCalls: ToolCall[] } {
    const toolCalls: ToolCall[] = [];
    let text = content;

    // Try to find JSON blocks with tool_calls
    const jsonBlockRegex = /```json\s*([\s\S]*?)\s*```/g;
    let match;

    while ((match = jsonBlockRegex.exec(content)) !== null) {
      try {
        const parsed = JSON.parse(match[1]);
        if (parsed.tool_calls && Array.isArray(parsed.tool_calls)) {
          for (const call of parsed.tool_calls) {
            if (call.name && call.arguments) {
              toolCalls.push({
                id: call.id || `call_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`,
                name: call.name,
                arguments: call.arguments,
              });
            }
          }
          // Remove the JSON block from text
          text = text.replace(match[0], '').trim();
        }
      } catch {
        // Not valid JSON, ignore
      }
    }

    // Also try to find inline JSON (without code blocks)
    if (toolCalls.length === 0) {
      try {
        const inlineJson = content.match(/\{[\s\S]*"tool_calls"[\s\S]*\}/);
        if (inlineJson) {
          const parsed = JSON.parse(inlineJson[0]);
          if (parsed.tool_calls && Array.isArray(parsed.tool_calls)) {
            for (const call of parsed.tool_calls) {
              if (call.name && call.arguments) {
                toolCalls.push({
                  id: call.id || `call_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`,
                  name: call.name,
                  arguments: call.arguments,
                });
              }
            }
            text = text.replace(inlineJson[0], '').trim();
          }
        }
      } catch {
        // Not valid JSON, ignore
      }
    }

    return { text, toolCalls };
  }

  async chat(messages: ChatMessage[], onToken?: (token: string) => void): Promise<LLMResponse> {
    if (!this.isLoaded || !this.context || !this.model) {
      throw new Error('Model not loaded. Call loadModel() first.');
    }

    // Build the full system prompt with tools
    const fullSystemPrompt = this.systemPrompt + this.buildToolsPrompt();

    // Convert messages to chat history format
    const chatHistory: ChatHistoryItem[] = [];

    // Add system message
    if (fullSystemPrompt) {
      chatHistory.push({
        type: 'system',
        text: fullSystemPrompt,
      });
    }

    // Add conversation messages
    for (const msg of messages) {
      if (msg.role === 'user') {
        chatHistory.push({
          type: 'user',
          text: msg.content,
        });
      } else if (msg.role === 'assistant') {
        chatHistory.push({
          type: 'model',
          response: [msg.content],
        });
      } else if (msg.role === 'tool') {
        // Tool results are added as user messages with special formatting
        chatHistory.push({
          type: 'user',
          text: `[Tool Result for ${msg.toolCallId}]\n${msg.content}`,
        });
      }
    }

    // Create a new session for this conversation
    // Build the prompt from chat history since chatHistory option may not be available
    let conversationPrompt = '';
    for (const item of chatHistory) {
      if (item.type === 'system') {
        conversationPrompt += `System: ${item.text}\n\n`;
      } else if (item.type === 'user') {
        conversationPrompt += `User: ${item.text}\n\n`;
      } else if (item.type === 'model') {
        conversationPrompt += `Assistant: ${(item as { type: 'model'; response: string[] }).response.join('')}\n\n`;
      }
    }

    this.session = new LlamaChatSession({
      contextSequence: this.context.getSequence(),
    });

    let fullResponse = '';

    try {
      const response = await this.session.prompt(conversationPrompt, {
        onTextChunk: (chunk) => {
          fullResponse += chunk;
          if (onToken) {
            onToken(chunk);
          }
        },
        maxTokens: 2048,
        temperature: 0.7,
        topP: 0.9,
      });

      fullResponse = response;
    } catch (err) {
      console.error('Error during chat:', err);
      return {
        content: '',
        toolCalls: [],
        finishReason: 'error',
      };
    }

    // Parse tool calls from response
    const { text, toolCalls } = this.parseToolCalls(fullResponse);

    return {
      content: text,
      toolCalls,
      finishReason: toolCalls.length > 0 ? 'tool_calls' : 'stop',
    };
  }

  async generateCompletion(prompt: string, onToken?: (token: string) => void): Promise<string> {
    if (!this.isLoaded || !this.context || !this.model) {
      throw new Error('Model not loaded. Call loadModel() first.');
    }

    const session = new LlamaChatSession({
      contextSequence: this.context.getSequence(),
    });

    let response = '';

    try {
      response = await session.prompt(prompt, {
        onTextChunk: (chunk) => {
          response += chunk;
          if (onToken) {
            onToken(chunk);
          }
        },
        maxTokens: 2048,
        temperature: 0.7,
      });
    } catch (err) {
      console.error('Error during completion:', err);
      throw err;
    }

    return response;
  }

  isModelLoaded(): boolean {
    return this.isLoaded;
  }

  getModelPath(): string | null {
    return this.currentModelPath;
  }

  getModelInfo(): { loaded: boolean; path: string | null; contextSize: number | null } {
    return {
      loaded: this.isLoaded,
      path: this.currentModelPath,
      contextSize: this.context ? 4096 : null, // Default context size
    };
  }
}

// Singleton instance
export const llmManager = new LLMManager();
