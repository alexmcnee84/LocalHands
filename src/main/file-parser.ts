import * as fs from 'fs';
import * as path from 'path';

export type SupportedFileType = 'txt' | 'rtf' | 'pdf' | 'jpeg' | 'png' | 'unknown';

export interface ParsedFile {
  originalName: string;
  type: SupportedFileType;
  size: number;
  textContent?: string;
  error?: string;
}

export function detectFileType(filePath: string): SupportedFileType {
  const ext = path.extname(filePath).toLowerCase();
  switch (ext) {
    case '.txt':
      return 'txt';
    case '.rtf':
      return 'rtf';
    case '.pdf':
      return 'pdf';
    case '.jpg':
    case '.jpeg':
      return 'jpeg';
    case '.png':
      return 'png';
    default:
      return 'unknown';
  }
}

export async function parseTextFile(filePath: string): Promise<string> {
  const content = await fs.promises.readFile(filePath, 'utf-8');
  return content.replace(/\r\n/g, '\n').replace(/\r/g, '\n');
}

export async function parseRtfFile(filePath: string): Promise<string> {
  const content = await fs.promises.readFile(filePath, 'utf-8');
  
  let text = content;
  text = text.replace(/\\par\s*/g, '\n');
  text = text.replace(/\\tab\s*/g, '\t');
  text = text.replace(/\\'([0-9a-fA-F]{2})/g, (_, hex) => {
    return String.fromCharCode(parseInt(hex, 16));
  });
  text = text.replace(/\\[a-z]+\d*\s?/gi, '');
  text = text.replace(/\{[^{}]*\}/g, '');
  text = text.replace(/[{}]/g, '');
  text = text.replace(/\n{3,}/g, '\n\n');
  
  return text.trim();
}

export async function parsePdfFile(filePath: string): Promise<string> {
  try {
    // Use dynamic import with Function constructor to avoid TypeScript errors
    // when pdf-parse is not installed
    const dynamicImport = new Function('specifier', 'return import(specifier)');
    const pdfParse = await dynamicImport('pdf-parse');
    const dataBuffer = await fs.promises.readFile(filePath);
    const data = await pdfParse.default(dataBuffer);
    return data.text;
  } catch (err) {
    console.warn('PDF parsing not available:', (err as Error).message);
    return `[PDF file: ${path.basename(filePath)} - PDF text extraction not available]`;
  }
}

export async function parseFile(filePath: string): Promise<ParsedFile> {
  const type = detectFileType(filePath);
  const stats = await fs.promises.stat(filePath);
  const originalName = path.basename(filePath);

  const result: ParsedFile = {
    originalName,
    type,
    size: stats.size,
  };

  try {
    switch (type) {
      case 'txt':
        result.textContent = await parseTextFile(filePath);
        break;
      case 'rtf':
        result.textContent = await parseRtfFile(filePath);
        break;
      case 'pdf':
        result.textContent = await parsePdfFile(filePath);
        break;
      case 'jpeg':
      case 'png':
        result.textContent = `[Image file: ${originalName}]`;
        break;
      default:
        result.textContent = `[Unsupported file type: ${originalName}]`;
    }
  } catch (err) {
    result.error = (err as Error).message;
  }

  return result;
}

export async function copyFileToMemory(
  sourcePath: string,
  memoryDir: string,
  conversationId: string
): Promise<{ destPath: string; parsed: ParsedFile }> {
  const attachmentsDir = path.join(memoryDir, 'conversations', conversationId, 'attachments');
  
  if (!fs.existsSync(attachmentsDir)) {
    fs.mkdirSync(attachmentsDir, { recursive: true });
  }

  const fileName = path.basename(sourcePath);
  const timestamp = Date.now();
  const destFileName = `${timestamp}_${fileName}`;
  const destPath = path.join(attachmentsDir, destFileName);

  await fs.promises.copyFile(sourcePath, destPath);
  const parsed = await parseFile(destPath);

  return { destPath, parsed };
}
