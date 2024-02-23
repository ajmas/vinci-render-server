import { setTimeout as awaitTimeout } from 'timers/promises';
import puppeteer, { Browser, PDFOptions, Page, PuppeteerLaunchOptions } from 'puppeteer';
import urlMetadata from 'url-metadata';
import path from 'path';
import os from 'os';

import cacheService from './CacheService.js';
import { createLogger } from '../utils/Logger.js';

const logger = createLogger('browser-service');

class BrowserService {
  maxPageCount = 20;
  idlePeriod = 60000;
  waitDuration = 500;
  idleTime: 15000;

  browser: Browser | undefined;
  requestHeaders: Record<string, string> = {};
  pageCount: number = 0;
  lastAccessTime: number;

  browserOptions: PuppeteerLaunchOptions = {
    headless: true,
    args: [
      '--disable-features=site-per-process',
      '--window-size=1920,1080',
      '--incognito',
      '--no-sandbox'
    ]
  };

  pdfOptions: PDFOptions = {
    format: 'Letter',
    margin: { top: 37, right: 37, bottom: 37, left: 37 },
    printBackground: true,
    omitBackground: false
  };

  init () {
    this.startIdleTimer();
  }

  private createTempFile (suffix: string = '.dat'): string {
    return path.join(
      os.tmpdir(),
      `${Date.now()}-${Math.floor(Math.random() * 10000000)}-${suffix}`
    );
  }

  private getSignificantValue (text: string): string | undefined {
    if (text && text.trim().length > 0) {
      return text;
    }
    return undefined;
  }

  private async getBrowser (): Promise<Browser> {
    this.lastAccessTime = Date.now();
    if (!this.browser?.connected) {
      this.browser = await puppeteer.launch(this.browserOptions);
    }
    return this.browser;
  }

  private closeBrowser () {
    if (this.browser?.connected) {
      const browser = this.browser;
      this.browser = undefined;
      this.pageCount = 0;
      browser.close();
    }
  }

  private startIdleTimer () {
    // stop the browser if it hasn't been used in a whilt
    setInterval(() => {
      if (this.browser && (Date.now() - this.lastAccessTime) > this.idlePeriod) {
        this.closeBrowser();
      }
    }, 30000);
  }

  private async createPage (pageUrl: string, locale: string, options: Record<string, any> = {}): Promise<Page> {
    logger.debug(`createPage - ${pageUrl} ${JSON.stringify(options)}`);

    const browser = await this.getBrowser();

    // TODO deal with max tries
    while (this.pageCount >= this.maxPageCount) {
      await awaitTimeout(500);
    }
    this.pageCount++;

    const page = await browser.newPage();
    const headers: Record<string, string> = {
      'Accept-Language': `${locale},en;q=0.9,en;q=0.8`
    };
    page.setRequestInterception(true);

    page.on('request', request => {
      // Override headers
      const headers = Object.assign({}, request.headers(), {
        'Accept-Language': `${locale};q=0.7`
      });
      request.continue({ headers });
    });

    page.goto(pageUrl);

    const waitDuration = options?.waitDuration || this.waitDuration;

    if (waitDuration) {
      await awaitTimeout(waitDuration);
    }

    await page.waitForNetworkIdle({
      concurrency: 5,
      idleTime: this.idleTime
    });

    return page;
  }

  private closePage (page: Page) {
    if (page) {
      // delaying the closing since we seem to be running into some issues
      // if we close it too soon
      setTimeout(() => {
        this.pageCount--;
        page.close();
      }, 5000);
    }
  }

  async getPageAsPdf (pageUrl: string, locale: string, options: Record<string, any> = {}) {
    let page;
    let tmpFilePath;
    try {
      if (options.path) {
        tmpFilePath = options.path;
      }

      let waitDuration;
      if (options.wait) {
        waitDuration = options.wait;
      }

      page = await this.createPage(pageUrl, locale, { waitDuration });
      const data = await page.pdf({
        path: tmpFilePath,
        ...this.pdfOptions,
        ...options
      });

      if (!options.path) {
        return data;
      }
    } finally {
      this.closePage(page);
    }

    return tmpFilePath;
  }

  async getPageScreenshot (pageUrl: string, locale: string, options: Record<string, any> = {}) {
    let page;
    let tmpFilePath;
    let fileType = 'jpeg';

    try {
      if (options.path) {
        tmpFilePath = options.path;
      }

      if (options.type) {
        fileType = options.type;
      }

      let waitDuration;
      if (options.wait) {
        waitDuration = options.wait;
      }

      page = await this.createPage(pageUrl, locale, { waitDuration });

      page.setViewport({
        width: options?.viewport.width || 1920,
        height: options?.viewport.height || 1080,
      });

      const data = await page.screenshot({
        path: tmpFilePath,
        type: fileType
      });

      if (!options.path) {
        return data;
      }
    } finally {
      this.closePage(page);
    }

    return tmpFilePath;
  }

  async getPageAsHtml (pageUrl: string, locale: string, options: Record<string, unknown> = {}): Promise<string | undefined> {
    const key = `html-${pageUrl}-${locale}`;

    let html = cacheService.getFromCache<string>(undefined, key);
    if (!html) {
      let page;
      try {

        let waitDuration;
        if (options.wait) {
          waitDuration = options.wait as number;
        }

        page = await this.createPage(pageUrl, locale, { waitDuration });
        if (page) {
          html = await page.content();
          cacheService.addToCache(undefined, key, html);
        }
      } finally {
        this.closePage(page);
      }
    }

    return html;
  }

  async getPageMetadata (pageUrl: string, locale: string, options: urlMetadata.Result = {}) {
    const html = await this.getPageAsHtml(pageUrl, locale, options);
    let metadata;

    if (html) {
      const response = new Response(html, {
        headers: {
          'Content-Type': 'text/html'
        }
      });

      metadata = await urlMetadata(null as any, {
        requestHeaders: {
          ...(this.requestHeaders || {}),
          'Accept-Language': locale,
        },
        parseResponseObject: response
      });
    }

    return metadata;
  }

  async getPagePreviewMetadata (pageUrl: string, locale: string, options: Record<string, unknown> = {}) {
    const metadata = await this.getPageMetadata(pageUrl, locale, options);

    let url = metadata.canonical || metadata['og:url'] || pageUrl;
    const favicons = (metadata.favicons || []).map(favicon => {
      if (favicon?.href.startsWith('/')) {
        const canonicalUrl = new URL(url);
        if (url.endsWith('/')) {
          url = url.substring(0, url.length - 1);
        }
        favicon.href = `${canonicalUrl.protocol}//${canonicalUrl.host}${favicon.href}`;
      }
      return favicon;
    });

    const prevewMetadata = {
      title: metadata.title || metadata['og:title'],
      description: metadata.description || metadata['og:description'],
      siteName: metadata['og:siteName'],
      type: this.getSignificantValue(metadata['og:type']),
      previewImage: this.getSignificantValue(metadata['og:image']),
      url: metadata.canonical || metadata['og:url'] || pageUrl,
      favicons,
      locale: this.getSignificantValue(metadata['og:locale'])
    };

    return prevewMetadata;
  }
}

export default new BrowserService();
