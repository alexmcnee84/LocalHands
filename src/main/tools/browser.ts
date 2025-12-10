import { ToolResult, ToolDefinition } from '../../shared/types';

export const BROWSER_TOOL_NAME = 'browser';

export const browserToolDefinition: ToolDefinition = {
  type: 'function',
  function: {
    name: BROWSER_TOOL_NAME,
    description: `Browser automation tool for navigating and interacting with web pages.

Note: Browser automation requires Playwright to be installed. This tool provides basic web browsing capabilities.

Actions:
- goto: Navigate to a URL
- click: Click on an element
- type: Type text into an input
- screenshot: Take a screenshot
- get_text: Get text content from the page
- evaluate: Run JavaScript in the page context`,
    parameters: {
      type: 'object',
      properties: {
        action: {
          type: 'string',
          description: 'The browser action to perform',
          enum: ['goto', 'click', 'type', 'screenshot', 'get_text', 'evaluate', 'close'],
        },
        url: {
          type: 'string',
          description: 'URL to navigate to (for goto action)',
        },
        selector: {
          type: 'string',
          description: 'CSS selector for the element (for click, type, get_text)',
        },
        text: {
          type: 'string',
          description: 'Text to type (for type action)',
        },
        script: {
          type: 'string',
          description: 'JavaScript code to evaluate (for evaluate action)',
        },
      },
      required: ['action'],
    },
  },
};

// Browser automation is optional and requires Playwright
// This is a placeholder that can be extended when Playwright is available

interface BrowserState {
  isOpen: boolean;
  currentUrl: string | null;
  pageTitle: string | null;
}

export class BrowserAutomation {
  private state: BrowserState = {
    isOpen: false,
    currentUrl: null,
    pageTitle: null,
  };
  private browser: unknown = null;
  private page: unknown = null;
  private playwrightAvailable: boolean = false;

  constructor() {
    this.checkPlaywrightAvailability();
  }

  private async checkPlaywrightAvailability(): Promise<void> {
    try {
      // Try to require playwright dynamically to check availability
      // eslint-disable-next-line @typescript-eslint/no-require-imports
      require.resolve('playwright');
      this.playwrightAvailable = true;
    } catch {
      this.playwrightAvailable = false;
    }
  }

  async execute(args: {
    action: string;
    url?: string;
    selector?: string;
    text?: string;
    script?: string;
  }): Promise<ToolResult> {
    const { action, url, selector, text, script } = args;

    if (!this.playwrightAvailable) {
      return {
        toolCallId: '',
        success: false,
        output: '',
        error: 'Browser automation is not available. Playwright is not installed.\n\nTo enable browser automation, install Playwright:\nnpm install playwright\nnpx playwright install chromium',
      };
    }

    try {
      switch (action) {
        case 'goto':
          return await this.goto(url || '');
        case 'click':
          return await this.click(selector || '');
        case 'type':
          return await this.typeText(selector || '', text || '');
        case 'screenshot':
          return await this.screenshot();
        case 'get_text':
          return await this.getText(selector);
        case 'evaluate':
          return await this.evaluate(script || '');
        case 'close':
          return await this.close();
        default:
          return {
            toolCallId: '',
            success: false,
            output: '',
            error: `Unknown browser action: ${action}`,
          };
      }
    } catch (err) {
      return {
        toolCallId: '',
        success: false,
        output: '',
        error: `Browser error: ${(err as Error).message}`,
      };
    }
  }

  private async ensureBrowser(): Promise<void> {
    if (!this.browser) {
      // eslint-disable-next-line @typescript-eslint/no-require-imports
      const playwright = require('playwright');
      this.browser = await playwright.chromium.launch({ headless: true });
      const context = await (this.browser as { newContext: () => Promise<{ newPage: () => Promise<unknown> }> }).newContext();
      this.page = await context.newPage();
      this.state.isOpen = true;
    }
  }

  private async goto(url: string): Promise<ToolResult> {
    if (!url) {
      return {
        toolCallId: '',
        success: false,
        output: '',
        error: 'URL is required for goto action',
      };
    }

    await this.ensureBrowser();
    
    const page = this.page as { goto: (url: string) => Promise<void>; title: () => Promise<string>; url: () => string };
    await page.goto(url);
    
    this.state.currentUrl = page.url();
    this.state.pageTitle = await page.title();

    return {
      toolCallId: '',
      success: true,
      output: `Navigated to: ${this.state.currentUrl}\nPage title: ${this.state.pageTitle}`,
    };
  }

  private async click(selector: string): Promise<ToolResult> {
    if (!selector) {
      return {
        toolCallId: '',
        success: false,
        output: '',
        error: 'Selector is required for click action',
      };
    }

    if (!this.page) {
      return {
        toolCallId: '',
        success: false,
        output: '',
        error: 'No page is open. Use goto first.',
      };
    }

    const page = this.page as { click: (selector: string) => Promise<void> };
    await page.click(selector);

    return {
      toolCallId: '',
      success: true,
      output: `Clicked on element: ${selector}`,
    };
  }

  private async typeText(selector: string, text: string): Promise<ToolResult> {
    if (!selector) {
      return {
        toolCallId: '',
        success: false,
        output: '',
        error: 'Selector is required for type action',
      };
    }

    if (!this.page) {
      return {
        toolCallId: '',
        success: false,
        output: '',
        error: 'No page is open. Use goto first.',
      };
    }

    const page = this.page as { fill: (selector: string, text: string) => Promise<void> };
    await page.fill(selector, text);

    return {
      toolCallId: '',
      success: true,
      output: `Typed text into: ${selector}`,
    };
  }

  private async screenshot(): Promise<ToolResult> {
    if (!this.page) {
      return {
        toolCallId: '',
        success: false,
        output: '',
        error: 'No page is open. Use goto first.',
      };
    }

    const page = this.page as { screenshot: (options: { encoding: string }) => Promise<string> };
    const screenshot = await page.screenshot({ encoding: 'base64' });

    return {
      toolCallId: '',
      success: true,
      output: `Screenshot captured (base64 encoded, ${screenshot.length} chars)`,
    };
  }

  private async getText(selector?: string): Promise<ToolResult> {
    if (!this.page) {
      return {
        toolCallId: '',
        success: false,
        output: '',
        error: 'No page is open. Use goto first.',
      };
    }

    const page = this.page as { 
      textContent: (selector: string) => Promise<string | null>;
      evaluate: (script: string) => Promise<string>;
    };

    let text: string;
    if (selector) {
      text = await page.textContent(selector) || '';
    } else {
      // Use string-based evaluate to avoid TypeScript DOM type issues
      text = await page.evaluate('document.body.innerText');
    }

    // Truncate if too long
    if (text.length > 10000) {
      text = text.slice(0, 10000) + '\n... [text truncated]';
    }

    return {
      toolCallId: '',
      success: true,
      output: text,
    };
  }

  private async evaluate(script: string): Promise<ToolResult> {
    if (!script) {
      return {
        toolCallId: '',
        success: false,
        output: '',
        error: 'Script is required for evaluate action',
      };
    }

    if (!this.page) {
      return {
        toolCallId: '',
        success: false,
        output: '',
        error: 'No page is open. Use goto first.',
      };
    }

    const page = this.page as { evaluate: (script: string) => Promise<unknown> };
    const result = await page.evaluate(script);

    return {
      toolCallId: '',
      success: true,
      output: JSON.stringify(result, null, 2),
    };
  }

  private async close(): Promise<ToolResult> {
    if (this.browser) {
      await (this.browser as { close: () => Promise<void> }).close();
      this.browser = null;
      this.page = null;
      this.state = {
        isOpen: false,
        currentUrl: null,
        pageTitle: null,
      };
    }

    return {
      toolCallId: '',
      success: true,
      output: 'Browser closed',
    };
  }

  getState(): BrowserState {
    return { ...this.state };
  }
}
