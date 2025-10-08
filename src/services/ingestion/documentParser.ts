import * as fs from 'fs';
import * as path from 'path';
import pdfParse from 'pdf-parse';
import mammoth from 'mammoth';
import * as cheerio from 'cheerio';
import * as XLSX from 'xlsx';

interface ParsedDocument {
  content: string;
  metadata: {
    source: string;
    type: string;
    pageCount?: number;
    sheetCount?: number;
    [key: string]: any;
  };
}

export class DocumentParser {
  async parse(filePath: string): Promise<ParsedDocument | null> {
    const ext = path.extname(filePath).toLowerCase();
    const source = path.basename(filePath);

    try {
      switch (ext) {
        case '.pdf':
          return this.parsePdf(filePath, source);
        case '.txt':
          return this.parseText(filePath, source);
        case '.docx':
          return this.parseDocx(filePath, source);
        case '.doc':
          return this.parseDoc(filePath, source);
        case '.md':
          return this.parseMarkdown(filePath, source);
        case '.html':
        case '.htm':
          return this.parseHtml(filePath, source);
        case '.csv':
          return this.parseCsv(filePath, source);
        case '.xlsx':
        case '.xls':
          return this.parseXlsx(filePath, source);
        case '.pptx':
          return this.parsePptx(filePath, source);
        case '.json':
          return this.parseJson(filePath, source);
        case '.xml':
          return this.parseXml(filePath, source);
        case '.rtf':
          return this.parseRtf(filePath, source);
        default:
          console.warn(`Unsupported file type: ${ext} for file ${source}`);
          return null;
      }
    } catch (error: any) {
      console.error(`Error parsing file ${source}: ${error.message}`);
      return null;
    }
  }

  private async parsePdf(filePath: string, source: string): Promise<ParsedDocument> {
    const dataBuffer = fs.readFileSync(filePath);
    const pdfData = await pdfParse(dataBuffer);
    
    return {
      content: pdfData.text,
      metadata: {
        source: source,
        type: 'pdf',
        pageCount: pdfData.numpages,
        ...(pdfData.info || {}),
      },
    };
  }

  private parseText(filePath: string, source: string): ParsedDocument {
    const content = fs.readFileSync(filePath, 'utf-8');
    
    return {
      content: content,
      metadata: {
        source: source,
        type: 'text',
      },
    };
  }

  private async parseDocx(filePath: string, source: string): Promise<ParsedDocument> {
    const result = await mammoth.extractRawText({ path: filePath });
    const text = result.value;
    
    return {
      content: text,
      metadata: {
        source: source,
        type: 'docx',
      },
    };
  }

  private async parseDoc(filePath: string, source: string): Promise<ParsedDocument> {
    // .doc files (older Word format) are harder to parse
    // mammoth doesn't support .doc, only .docx
    console.warn(`Legacy .doc format detected for ${source}. Consider converting to .docx for better parsing.`);
    return {
      content: '',
      metadata: {
        source: source,
        type: 'doc',
        note: 'Legacy format - content extraction not supported',
      },
    };
  }

  private async parseMarkdown(filePath: string, source: string): Promise<ParsedDocument> {
    const content = fs.readFileSync(filePath, 'utf-8');
    
    return {
      content: content,
      metadata: {
        source: source,
        type: 'markdown',
      },
    };
  }

  private async parseHtml(filePath: string, source: string): Promise<ParsedDocument> {
    const content = fs.readFileSync(filePath, 'utf-8');
    const $ = cheerio.load(content);
    
    // Remove script and style elements
    $('script, style').remove();
    
    // Extract text content from the body
    const textContent = $('body').text().trim();
    
    // Clean up extra whitespace
    const cleanedContent = textContent.replace(/\s+/g, ' ');

    return {
      content: cleanedContent,
      metadata: {
        source: source,
        type: 'html',
      },
    };
  }

  private async parseCsv(filePath: string, source: string): Promise<ParsedDocument> {
    const content = fs.readFileSync(filePath, 'utf-8');
    
    // Convert CSV to readable text format
    const lines = content.split('\n').filter(line => line.trim());
    const formattedContent = lines.join('\n');
    
    return {
      content: formattedContent,
      metadata: {
        source: source,
        type: 'csv',
        lineCount: lines.length,
      },
    };
  }

  private async parseXlsx(filePath: string, source: string): Promise<ParsedDocument> {
    try {
      const workbook = XLSX.readFile(filePath);
      let allContent = '';
      
      // Process each sheet
      workbook.SheetNames.forEach((sheetName, index) => {
        const sheet = workbook.Sheets[sheetName];
        const csvContent = XLSX.utils.sheet_to_csv(sheet);
        
        if (index > 0) allContent += '\n\n';
        allContent += `Sheet: ${sheetName}\n${csvContent}`;
      });
      
      return {
        content: allContent,
        metadata: {
          source: source,
          type: 'xlsx',
          sheetCount: workbook.SheetNames.length,
          sheetNames: workbook.SheetNames,
        },
      };
    } catch (error: any) {
      console.error(`Error parsing XLSX file ${source}: ${error.message}`);
      return {
        content: '',
        metadata: {
          source: source,
          type: 'xlsx',
          error: error.message,
        },
      };
    }
  }

  private async parsePptx(filePath: string, source: string): Promise<ParsedDocument> {
    // PPTX parsing requires additional library
    // For now, return placeholder
    console.warn(`PPTX parsing not fully implemented for file ${source}. Consider using a specialized library.`);
    return {
      content: '',
      metadata: {
        source: source,
        type: 'pptx',
        note: 'PPTX parsing requires additional implementation',
      },
    };
  }

  private async parseJson(filePath: string, source: string): Promise<ParsedDocument | null> {
    const content = fs.readFileSync(filePath, 'utf-8');
    
    try {
      const jsonData = JSON.parse(content);
      // Convert JSON to readable string format
      const readableContent = JSON.stringify(jsonData, null, 2);
      
      return {
        content: readableContent,
        metadata: {
          source: source,
          type: 'json',
        },
      };
    } catch (e) {
      console.error(`Error parsing JSON file ${source}: ${(e as Error).message}`);
      return null;
    }
  }

  private async parseXml(filePath: string, source: string): Promise<ParsedDocument> {
    const content = fs.readFileSync(filePath, 'utf-8');
    
    // Use cheerio to extract text from XML
    const $ = cheerio.load(content, { xmlMode: true });
    const textContent = $.text().trim().replace(/\s+/g, ' ');
    
    return {
      content: textContent || content, // Fallback to raw content if no text extracted
      metadata: {
        source: source,
        type: 'xml',
      },
    };
  }

  private async parseRtf(filePath: string, source: string): Promise<ParsedDocument> {
    // RTF parsing is complex and requires specialized library
    console.warn(`RTF parsing not fully implemented for file ${source}.`);
    return {
      content: '',
      metadata: {
        source: source,
        type: 'rtf',
        note: 'RTF parsing requires additional implementation',
      },
    };
  }
}