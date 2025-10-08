import * as cheerio from 'cheerio';
import { URL } from 'url';
import robotsParser from 'robots-parser'; // Import robots-parser
import { chromium, Browser, Page } from 'playwright'; // Import Playwright

interface WebCrawlOptions {
  maxDepth?: number;
  baseUrl: string;
  respectRobotsTxt?: boolean;
  rateLimitMs?: number;
}

// Export CrawledPage interface
export interface CrawledPage {
  url: string;
  content: string;
  title?: string;
  links: string[];
  metadata?: { // Add metadata to CrawledPage
    originalUrl: string;
    links: string[];
  };
}

export class WebCrawler {
  private baseUrl: URL;
  private maxDepth: number;
  private rateLimitMs: number;
  private visitedUrls: Set<string>;
  private crawledPages: Map<string, CrawledPage>;
  private robotsTxt: any | null = null; // To store parsed robots.txt
  private respectRobotsTxt: boolean;

  constructor(options: WebCrawlOptions) {
    this.baseUrl = new URL(options.baseUrl);
    this.maxDepth = options.maxDepth || 3; // Default depth
    this.rateLimitMs = options.rateLimitMs || 1000; // Default rate limit
    this.respectRobotsTxt = options.respectRobotsTxt || false; // Store the option
    this.visitedUrls = new Set();
    this.crawledPages = new Map();

    if (this.respectRobotsTxt) {
      this.fetchRobotsTxt(); // Fetch robots.txt on initialization
    }
  }

  private async fetchRobotsTxt(): Promise<void> {
    const robotsUrl = new URL('/robots.txt', this.baseUrl.origin).toString();
    try {
      console.log(`Fetching robots.txt from: ${robotsUrl}`);
      // Use Playwright to fetch robots.txt to ensure consistency and handle potential dynamic content
      const browser = await chromium.launch({ headless: true });
      const page = await browser.newPage();
      await page.goto(robotsUrl, { waitUntil: 'domcontentloaded' });
      const response = await page.goto(robotsUrl, { waitUntil: 'domcontentloaded' }); // Re-goto to get response object
      const robotsText = await page.content(); // Get content as text

      if (response && response.ok() && robotsText) {
        this.robotsTxt = robotsParser(robotsUrl, robotsText);
        console.log('robots.txt parsed successfully.');
      } else {
        console.warn(`robots.txt not found or empty at ${robotsUrl} (Status: ${response?.status()})`);
      }
      await browser.close();
    } catch (error: any) {
      console.warn(`Could not fetch or parse robots.txt from ${robotsUrl}: ${error.message}`);
    }
  }

  private async fetchPage(url: string): Promise<{ content: string; title?: string } | null> {
    let browser: Browser | null = null;
    let page: Page | null = null;
    try {
      console.log(`Fetching: ${url}`);
      browser = await chromium.launch({ headless: true });
      page = await browser.newPage();

      // Set User-Agent header
      await page.setExtraHTTPHeaders({
        'User-Agent': 'Mozilla/5.0 (compatible; MCPIngestor/1.0; +http://example.com/bot)',
      });

      const response = await page.goto(url, { waitUntil: 'domcontentloaded' });

      if (!response || !response.ok()) {
        console.error(`Failed to fetch ${url}: ${response?.status()}`);
        return null;
      }

      const contentType = response.headers()['content-type'];
      if (!contentType || !contentType.includes('text/html')) {
        console.log(`Skipping non-HTML content at ${url}`);
        return null;
      }

      const html = await page.content();
      const $ = cheerio.load(html);
      const title = $('title').text();

      // Basic content filtering (can be expanded)
      $('script, style, noscript, header, footer, nav, aside').remove();
      const content = $('body').text().trim();

      return { content, title };
    } catch (error: any) {
      console.error(`Error fetching ${url}: ${error.message}`);
      return null;
    } finally {
      if (page) await page.close();
      if (browser) await browser.close();
    }
  }

  private async crawl(url: string, currentDepth: number): Promise<void> {
    if (currentDepth > this.maxDepth || this.visitedUrls.has(url)) {
      return;
    }

    // Check if the URL is allowed by robots.txt
    if (this.respectRobotsTxt && this.robotsTxt && !this.robotsTxt.isAllowed(url, 'MCPIngestor/1.0')) {
      console.log(`Skipping disallowed URL due to robots.txt: ${url}`);
      return;
    }

    this.visitedUrls.add(url);

    const pageData = await this.fetchPage(url);
    if (!pageData) {
      return;
    }

    const $ = cheerio.load(pageData.content);
    const links: string[] = [];

    $('a[href]').each((i, element) => {
      const href = $(element).attr('href');
      if (href) {
        try {
          const absoluteUrl = new URL(href, url).toString();
          const parsedAbsoluteUrl = new URL(absoluteUrl);

          // Only follow links within the same domain and to http/https protocols
          if (parsedAbsoluteUrl.origin === this.baseUrl.origin &&
              (parsedAbsoluteUrl.protocol === 'http:' || parsedAbsoluteUrl.protocol === 'https:')) {
            links.push(absoluteUrl);
          }
        } catch (e) {
          console.warn(`Could not parse URL: ${href} from ${url}`);
        }
      }
    });

    this.crawledPages.set(url, {
      url: url,
      content: pageData.content, // Store original content for potential later parsing
      title: pageData.title,
      links: links,
      metadata: { // Populate metadata
        originalUrl: url,
        links: links,
      },
    });

    // Rate limiting
    await new Promise(resolve => setTimeout(resolve, this.rateLimitMs));

    // Recursively crawl links
    for (const link of links) {
      await this.crawl(link, currentDepth + 1);
    }
  }

  public async start(startUrl: string): Promise<Map<string, CrawledPage>> {
    this.visitedUrls.clear();
    this.crawledPages.clear();
    await this.crawl(startUrl, 0);
    return this.crawledPages;
  }
}
