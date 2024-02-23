import express, { Express, Request, Response, NextFunction } from 'express';

import appinfo from './appinfo.json' with { type: 'json' };
import CacheService from './services/CacheService.js';
import BrowserService from './services/BrowserService.js';
import InvalidValueError from './errors/InvalidValueError.js';
import NotFoundError from './errors/NotFoundError.js';
import UnauthorizedError from './errors/UnauthorizedError.js';
import { createLogger } from './utils/Logger.js';
import config from './utils/Config.js';
import { apiKeyConfig } from './types/Global.js';

const defaultLocale = 'en';
const port = 7331;
const apiKey = '12345';
const requiresApiKey = true;
let apiKeyMap : Record<string, apiKeyConfig> = {};
const logger = createLogger('main');

async function logRequests (req: Request, res: Response, next: NextFunction)  {
  // eslint-disable-next-line no-console
  logger.info(`request: ${req.method} ${req.path}`);
  next();
}

function getRemoteIp (req: Request): string | undefined {
  const forwardHeader = req.headers['x-forwarded-for'];
  if (forwardHeader) {
    if (Array.isArray(forwardHeader) && forwardHeader.length > 0) {
      return forwardHeader[0];
    }
  }
  return req.socket.remoteAddress;
}

function checkAccess (req: Request, res: Response, next: NextFunction) {
  if (requiresApiKey) {
    if (typeof req.query.apikey === 'string') {
      let okay = true;
      if (!apiKeyMap[req.query.apikey]) {
        okay = false;
      } else {
        const ip = apiKeyMap[req.query.apikey]?.ip;
        if (ip) {
          let matched = false;
          for (let i = 0; i < ip.length; i++) {
            if (ip[i] !== '0.0.0.0' || ip[i] !== '::') {
              matched = true;
              break;
            } else if (getRemoteIp(req) === ip[i]) {
              matched = true;
              break;
            }
          }
          okay = matched;
        }
      }

      if (okay) {
        next();
        return;
      }
    }
  }
  logger.warn(`Rejected access from ${getRemoteIp(req)}`);
  next(new UnauthorizedError('Insufficient credentials to access'));
}

function initRoutes () {
  const router = express.Router({});

  router.get('/', async (req: Request, res: Response, next: NextFunction) => {
    try {
      res.json(appinfo);
    } catch (error) {
      next(error);
    }
  });

  router.get('/browser/pdf', checkAccess, async (req: Request, res: Response, next: NextFunction) => {
    try {
      const filename = 'preview.pdf';
      const url = req.query.url;
      const locale = req.query.lang || defaultLocale;

      if (!url || typeof url !== 'string') {
        throw new InvalidValueError('url: required;one-occurrence', 'url');
      } else if (url.trim().length === 0) {
        throw new InvalidValueError('url: required', 'url');
      }

      const data = await BrowserService.getPageAsPdf(url as string, locale as string, {});

      if (data) {
        res.set('Content-Disposition', `attachment; filename="${filename}"`);
        res.send(data);
      } else {
        throw new Error('Unable to process');
      }
    } catch (error) {
      next(error);
    }
  });

  router.get('/browser/screenshot', checkAccess, async (req: Request, res: Response, next: NextFunction) => {
    try {
      const filename = 'screenshot.jpg';
      const url = req.query.url;
      const locale = req.query.lang || defaultLocale;
      const waitStr = req.query.wait as string;
      let widthStr = req.query.w as string;
      let heightStr = req.query.h as string;
      let width = 1920;
      let height = 1080;
      let wait;

      if (widthStr) {
        width = parseInt(widthStr);
      }

      if (heightStr) {
        height = parseInt(heightStr);
      }

      if (waitStr) {
        wait = parseInt(waitStr);
      }

      if (!url || typeof url !== 'string') {
        throw new InvalidValueError('url: required;one-occurrence', 'url');
      } else if (url.trim().length === 0) {
        throw new InvalidValueError('url: required', 'url');
      }

      const data = await BrowserService.getPageScreenshot(url as string, locale as string, {
        viewport: {
          width, height
        },
        wait
      });

      if (data) {
        res.set('Content-Disposition', `attachment; filename="${filename}"`);
        res.send(data);
      } else {
        throw new Error('Unable to process');
      }
    } catch (error) {
      next(error);
    }
  });

  router.get('/browser/html', checkAccess, async (req: Request, res: Response, next: NextFunction) => {
    try {
      const url = req.query.url;
      const locale = req.query.lang || defaultLocale;

      if (!url || typeof url !== 'string') {
        throw new InvalidValueError('url: required;one-occurrence', 'url');
      } else if (url.trim().length === 0) {
        throw new InvalidValueError('url: required', 'url');
      }

      const html = await BrowserService.getPageAsHtml(url as string, locale as string);
      if (html) {
        res.setHeader('content-type', 'text/html')
        res.send(html);
      }
      throw new Error('Unable to process');
    } catch (error) {
      next(error);
    }
  });

  router.get('/browser/metadata', checkAccess, async (req: Request, res: Response, next: NextFunction) => {
    try {
      const url = req.query.url;
      const locale = req.query.lang || defaultLocale;

      if (!url || typeof url !== 'string') {
        throw new InvalidValueError('url: required;one-occurrence', 'url');
      } else if (url.trim().length === 0) {
        throw new InvalidValueError('url: required', 'url');
      }

      const metadata = await BrowserService.getPageMetadata(url as string, locale as string);
      if (metadata) {
        res.json(metadata);
      } else {
        throw new Error('Unable to process');
      }
    } catch (error) {
      next(error);
    }
  });

  router.get('/browser/preview', checkAccess, async (req: Request, res: Response, next: NextFunction) => {
    try {
      const url = req.query.url;
      const locale = req.query.lang || defaultLocale;

      if (!url || typeof url !== 'string') {
        throw new InvalidValueError('url: required;one-occurrence', 'url');
      } else if (url.trim().length === 0) {
        throw new InvalidValueError('url: required', 'url');
      }

      const metadata = await BrowserService.getPagePreviewMetadata(url as string, locale as string);
      if (metadata) {
        res.json(metadata);
      } else {
        throw new Error('Unable to process');
      }
    } catch (error) {
      next(error);
    }
  });

  return router;
}

function initErrorHandlers (app: Express) {
  app.use((_req: Request, _res: Response, next: NextFunction) => {
    next(new NotFoundError('Nothing found at this path'));
  });

  app.use((error: Error, _req: Request, res: Response, _next: NextFunction) => {
    const anyError = error as any;
    let status = 500;

    if (anyError?.httpStatus) {
      status = anyError?.httpStatus;
    }

    res.json({
      status,
      message: error.message
    })
  });
}

async function initExpress () {
  const app = express();

  // app.use(express.json());
  // app.use(express.urlencoded({ extended: false }));

  app.use(logRequests);

  app.use('/api', initRoutes());

  initErrorHandlers(app);

  await new Promise(resolve => {
    app.listen(port, () => resolve(undefined));
  });

  console.info(`Server started on port ${port}`);
}

async function init () {
  const apiKeys = (config.apiKeys || []) as apiKeyConfig[];
  apiKeys.forEach(apiKey => {
    if (apiKey.key) {
      apiKeyMap[apiKey.key as string] = apiKey;
    }
  });

  CacheService.init();
  BrowserService.init();

  await initExpress();
}

init().catch(error => {
  console.error(error);
  process.exit(-1);
});

