import { setTimeout as awaitTimeout } from 'timers/promises';
import puppeteer, { Browser, PDFOptions, Page, PuppeteerLaunchOptions } from 'puppeteer';
import urlMetadata from 'url-metadata';
import path from 'path';
import os from 'os';

import cacheService from './CacheService.js';

class BrowserService {
  maxPageCount = 20;
  idlePeriod = 60000;

  browser: Browser | undefined;
  requestHeaders: Record<string, string> = {};
  pageCount: number = 0;
  lastAccessTime: number;

  browserOptions: PuppeteerLaunchOptions = {
    headless: true,
    args: [
      '--disable-features=site-per-process',
      '--window-size=1920,1080',
      '--incognito'
      // '--lang=fr-FR,fr'
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

      const waitDuration = options?.waitDuration || 2000;

      if (waitDuration) {
        await awaitTimeout(waitDuration);
      }

      return page;
  }

  private closePage (page: Page) {
    if (page) {
      // delaying the closing since we seem to be running into some issues
      // if we close it too soon
      setTimeout(() => {
        this.pageCount--;
        page.close();
      }, 2000);
    }
  }

  async getPageAsPdf (pageUrl: string, locale: string, options: Record<string, any> = {}) {
    let page;
    let tmpFilePath;
    try {
      if (options.path) {
        tmpFilePath = options.path;
      }

      let waitDuration = 2000;
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

      let waitDuration = 2000;
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

        let waitDuration = 2000;
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

  async getPageMetadata (pageUrl: string, locale: string, options: Record<string, unknown> = {}) {
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
}

export default new BrowserService();
