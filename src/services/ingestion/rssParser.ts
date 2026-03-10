import * as cheerio from 'cheerio';

export interface RSSItem {
  title: string;
  content: string;
  link: string;
  pubDate?: string;
  author?: string;
  categories?: string[];
}

export interface ParsedFeed {
  title: string;
  description?: string;
  link?: string;
  items: RSSItem[];
}

export class RSSParser {
  async parse(feedUrl: string): Promise<ParsedFeed> {
    const response = await fetch(feedUrl, {
      headers: {
        'User-Agent': 'MegaMind/1.0; RSS Reader (+https://github.com/nxGnosis/mcp-megamind)',
        Accept: 'application/rss+xml, application/atom+xml, application/xml, text/xml, */*',
      },
      signal: AbortSignal.timeout(15000),
    });

    if (!response.ok) {
      throw new Error(`Failed to fetch RSS feed from ${feedUrl}: ${response.status} ${response.statusText}`);
    }

    const text = await response.text();
    return this.parseXml(text, feedUrl);
  }

  private parseXml(xml: string, feedUrl: string): ParsedFeed {
    const $ = cheerio.load(xml, { xmlMode: true });

    // Detect Atom vs RSS
    const isAtom = $('feed').length > 0;

    if (isAtom) {
      return this.parseAtom($, feedUrl);
    }
    return this.parseRss($, feedUrl);
  }

  private parseRss($: cheerio.CheerioAPI, feedUrl: string): ParsedFeed {
    const channel = $('channel').first();

    const feedTitle = channel.find('> title').first().text().trim() || feedUrl;
    const feedDescription = channel.find('> description').first().text().trim();
    const feedLink = channel.find('> link').first().text().trim();

    const items: RSSItem[] = [];
    $('item').each((_, el) => {
      const $el = $(el);

      const rawContent =
        $el.find('content\\:encoded').text() ||
        $el.find('description').text() ||
        '';
      const content = this.stripHtml(rawContent);
      const link = $el.find('link').first().text().trim() || $el.find('guid').text().trim();

      if (!content && !link) return;

      const categories: string[] = [];
      $el.find('category').each((_, cat) => categories.push($(cat).text().trim()));

      items.push({
        title: $el.find('title').first().text().trim(),
        content,
        link,
        pubDate: $el.find('pubDate').first().text().trim() || undefined,
        author:
          $el.find('author').first().text().trim() ||
          $el.find('dc\\:creator').first().text().trim() ||
          undefined,
        categories: categories.length ? categories : undefined,
      });
    });

    return { title: feedTitle, description: feedDescription || undefined, link: feedLink || undefined, items };
  }

  private parseAtom($: cheerio.CheerioAPI, feedUrl: string): ParsedFeed {
    const feedTitle = $('feed > title').first().text().trim() || feedUrl;
    const feedDescription = $('feed > subtitle').first().text().trim();
    const feedLink =
      $('feed > link[rel="alternate"]').attr('href') ||
      $('feed > link').first().attr('href') ||
      '';

    const items: RSSItem[] = [];
    $('entry').each((_, el) => {
      const $el = $(el);

      const rawContent =
        $el.find('content').text() ||
        $el.find('summary').text() ||
        '';
      const content = this.stripHtml(rawContent);
      const link =
        $el.find('link[rel="alternate"]').attr('href') ||
        $el.find('link').first().attr('href') ||
        $el.find('id').first().text().trim() ||
        '';

      if (!content && !link) return;

      const categories: string[] = [];
      $el.find('category').each((_, cat) => {
        const term = $(cat).attr('term') || $(cat).text().trim();
        if (term) categories.push(term);
      });

      items.push({
        title: $el.find('title').first().text().trim(),
        content,
        link,
        pubDate:
          $el.find('published').first().text().trim() ||
          $el.find('updated').first().text().trim() ||
          undefined,
        author: $el.find('author > name').first().text().trim() || undefined,
        categories: categories.length ? categories : undefined,
      });
    });

    return { title: feedTitle, description: feedDescription || undefined, link: feedLink || undefined, items };
  }

  private stripHtml(html: string): string {
    if (!html.trim()) return '';
    try {
      const $ = cheerio.load(html);
      return $.text().replace(/\s+/g, ' ').trim();
    } catch {
      return html.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();
    }
  }
}
