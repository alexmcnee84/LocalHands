export { BashExecutor, bashToolDefinition, BASH_TOOL_NAME } from './bash';
export { FileEditor, fileEditorToolDefinition, FILE_EDITOR_TOOL_NAME } from './file-editor';
export { BrowserAutomation, browserToolDefinition, BROWSER_TOOL_NAME } from './browser';

import { ToolDefinition } from '../../shared/types';
import { bashToolDefinition } from './bash';
import { fileEditorToolDefinition } from './file-editor';
import { browserToolDefinition } from './browser';

export const allToolDefinitions: ToolDefinition[] = [
  bashToolDefinition,
  fileEditorToolDefinition,
  browserToolDefinition,
];

export function getToolDefinitionsForLLM(): object[] {
  return allToolDefinitions.map(tool => ({
    type: tool.type,
    function: tool.function,
  }));
}
