import * as cheerio from 'cheerio';
import { URL } from 'url';
import { chromium, Browser, Page } from 'playwright';

interface WebCrawlOptions {
  maxDepth?: number;
  baseUrl: string;
  respectRobotsTxt?: boolean;
  rateLimitMs?: number;
  maxConcurrency?: number;
  useSitemap?: boolean;
}

export interface CrawledPage {
  url: string;
  content: string;
  title?: string;
  links: string[];
  metadata: {
    originalUrl: string;
    links: string[];
  };
}

export class WebCrawler {
  private baseUrl: URL;
  private maxDepth: number;
  private rateLimitMs: number;
  private maxConcurrency: number;
  private useSitemap: boolean;
  private respectRobotsTxt: boolean;
  private visitedUrls: Set<string>;
  private crawledPages: Map<string, CrawledPage>;
  private robotsTxt: any | null = null;
  private browser: Browser | null = null;

  constructor(options: WebCrawlOptions) {
    this.baseUrl = new URL(options.baseUrl);
    this.maxDepth = options.maxDepth ?? 2;
    this.rateLimitMs = options.rateLimitMs ?? 1000;
    this.maxConcurrency = options.maxConcurrency ?? 3;
    this.useSitemap = options.useSitemap ?? false;
    this.respectRobotsTxt = options.respectRobotsTxt ?? false;
    this.visitedUrls = new Set();
    this.crawledPages = new Map();
  }

  private async getBrowser(): Promise<Browser> {
    if (!this.browser || !this.browser.isConnected()) {
      this.browser = await chromium.launch({ headless: true });
    }
    return this.browser;
  }

  private async closeBrowser(): Promise<void> {
    if (this.browser) {
      await this.browser.close().catch(() => {});
      this.browser = null;
    }
  }

  private async fetchRobotsTxt(): Promise<void> {
    const robotsUrl = new URL('/robots.txt', this.baseUrl.origin).toString();
    try {
      const response = await fetch(robotsUrl, {
        headers: { 'User-Agent': 'MegaMind/1.0' },
        signal: AbortSignal.timeout(5000),
      });
      if (response.ok) {
        const text = await response.text();
        const mod = await import('robots-parser');
        const parser = (mod.default ?? mod) as any;
        this.robotsTxt = parser(robotsUrl, text);
        console.log('robots.txt parsed.');
      }
    } catch (err: any) {
      console.warn(`Could not fetch robots.txt: ${err.message}`);
    }
  }

  private isAllowed(url: string): boolean {
    if (!this.respectRobotsTxt || !this.robotsTxt) return true;
    return typeof this.robotsTxt.isAllowed === 'function'
      ? this.robotsTxt.isAllowed(url, 'MegaMind/1.0')
      : true;
  }

  private async fetchSitemapUrls(): Promise<string[]> {
    const sitemapUrl = new URL('/sitemap.xml', this.baseUrl.origin).toString();
    const urls: string[] = [];

    const parseSitemapXml = (xml: string): string[] => {
      const $ = cheerio.load(xml, { xmlMode: true });
      const found: string[] = [];
      $('url > loc').each((_, el) => found.push($(el).text().trim()));
      $('sitemap > loc').each((_, el) => found.push($(el).text().trim()));
      return found.filter(u => {
        try { return new URL(u).origin === this.baseUrl.origin; } catch { return false; }
      });
    };

    try {
      const response = await fetch(sitemapUrl, {
        headers: { 'User-Agent': 'MegaMind/1.0' },
        signal: AbortSignal.timeout(8000),
      });
      if (!response.ok) return [];

      const text = await response.text();
      const found = parseSitemapXml(text);

      // Fetch sub-sitemaps (sitemap index, one level deep)
      const $ = cheerio.load(text, { xmlMode: true });
      const subSitemaps: string[] = [];
      $('sitemap > loc').each((_, el) => subSitemaps.push($(el).text().trim()));

      for (const subUrl of subSitemaps.slice(0, 5)) {
        try {
          const subResp = await fetch(subUrl, { signal: AbortSignal.timeout(5000) });
          if (subResp.ok) {
            const subText = await subResp.text();
            urls.push(...parseSitemapXml(subText));
          }
        } catch {}
      }

      urls.push(...found.filter(u => !u.includes('sitemap')));
      return [...new Set(urls)];
    } catch (err: any) {
      console.warn(`Could not fetch sitemap: ${err.message}`);
      return [];
    }
  }

  private async fetchPage(url: string): Promise<{ content: string; title: string; links: string[] } | null> {
    let page: Page | null = null;
    try {
      const browser = await this.getBrowser();
      page = await browser.newPage();
      await page.setExtraHTTPHeaders({
        'User-Agent': 'Mozilla/5.0 (compatible; MegaMind/1.0)',
      });

      const response = await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 30000 });
      if (!response?.ok()) {
        console.warn(`Failed to fetch ${url}: status ${response?.status()}`);
        return null;
      }

      const contentType = response.headers()['content-type'] || '';
      if (!contentType.includes('text/html')) return null;

      const html = await page.content();
      const $ = cheerio.load(html);

      const title = $('title').text().trim();

      // Extract links before modifying DOM
      const links: string[] = [];
      $('a[href]').each((_, el) => {
        const href = $(el).attr('href');
        if (!href || href.startsWith('#')) return;
        try {
          const parsed = new URL(href, url);
          parsed.hash = ''; // strip fragment
          if (
            parsed.origin === this.baseUrl.origin &&
            (parsed.protocol === 'http:' || parsed.protocol === 'https:')
          ) {
            links.push(parsed.toString());
          }
        } catch {}
      });

      $('script, style, noscript, header, footer, nav, aside').remove();
      const content = $('body').text().replace(/\s+/g, ' ').trim();

      return { content, title, links };
    } catch (err: any) {
      console.warn(`Error fetching ${url}: ${err.message}`);
      return null;
    } finally {
      await page?.close().catch(() => {});
    }
  }

  private async crawlBFS(startUrl: string): Promise<void> {
    if (this.respectRobotsTxt) await this.fetchRobotsTxt();

    let queue: string[] = [startUrl];

    for (let depth = 0; depth <= this.maxDepth && queue.length > 0; depth++) {
      const currentLevel = [...new Set(queue)].filter(
        url => !this.visitedUrls.has(url) && this.isAllowed(url)
      );
      queue = [];

      for (const url of currentLevel) this.visitedUrls.add(url);
      console.log(`[Crawler] Depth ${depth}: fetching ${currentLevel.length} URL(s)`);

      for (let i = 0; i < currentLevel.length; i += this.maxConcurrency) {
        const batch = currentLevel.slice(i, i + this.maxConcurrency);

        const results = await Promise.all(
          batch.map(async url => {
            const data = await this.fetchPage(url);
            return { url, data };
          })
        );

        for (const { url, data } of results) {
          if (!data) continue;
          this.crawledPages.set(url, {
            url,
            content: data.content,
            title: data.title,
            links: data.links,
            metadata: { originalUrl: url, links: data.links },
          });
          for (const link of data.links) {
            if (!this.visitedUrls.has(link)) queue.push(link);
          }
        }

        if (i + this.maxConcurrency < currentLevel.length) {
          await new Promise(r => setTimeout(r, this.rateLimitMs));
        }
      }
    }
  }

  private async crawlFromSitemap(): Promise<void> {
    console.log('[Crawler] Attempting sitemap-based discovery...');
    const sitemapUrls = await this.fetchSitemapUrls();

    if (sitemapUrls.length === 0) {
      console.log('[Crawler] No sitemap URLs found, falling back to BFS crawl.');
      return;
    }

    console.log(`[Crawler] Found ${sitemapUrls.length} URL(s) in sitemap.`);
    const limit = Math.min(sitemapUrls.length, 100);

    for (let i = 0; i < limit; i += this.maxConcurrency) {
      const batch = sitemapUrls.slice(i, i + this.maxConcurrency).filter(u => !this.visitedUrls.has(u));
      for (const url of batch) this.visitedUrls.add(url);

      const results = await Promise.all(
        batch.map(async url => {
          const data = await this.fetchPage(url);
          return { url, data };
        })
      );

      for (const { url, data } of results) {
        if (!data) continue;
        this.crawledPages.set(url, {
          url,
          content: data.content,
          title: data.title,
          links: data.links,
          metadata: { originalUrl: url, links: data.links },
        });
      }

      if (i + this.maxConcurrency < limit) {
        await new Promise(r => setTimeout(r, this.rateLimitMs));
      }
    }
  }

  public async start(startUrl: string): Promise<Map<string, CrawledPage>> {
    this.visitedUrls.clear();
    this.crawledPages.clear();

    try {
      if (this.useSitemap) {
        await this.crawlFromSitemap();
        // If sitemap yielded pages, return; otherwise fall through to BFS
        if (this.crawledPages.size > 0) return this.crawledPages;
      }
      await this.crawlBFS(startUrl);
      return this.crawledPages;
    } finally {
      await this.closeBrowser();
    }
  }
}
