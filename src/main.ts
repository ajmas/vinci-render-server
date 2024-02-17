import express, { Express, Request, Response, NextFunction } from 'express';
import path from 'path';
import os from 'os';

import appinfo from './appinfo.json';
import CacheService from './CacheService';
import BrowserService from './BrowserService';
import InvalidValueError from './errors/InvalidValueError';
import NotFoundError from './errors/NotFoundError';
import UnauthorizedError from './errors/UnauthorizedError';

const defaultLocale = 'en';
const port = 7331;
const apiKey = '12345';

function createTempFile (suffix: string = '.dat'): string {
  return path.join(
    os.tmpdir(),
    `${Date.now()}-${Math.floor(Math.random() * 10000000)}-${suffix}`
  );
}

function checkAccess (req: Request, res: Response, next: NextFunction) {
  if (req.query.apikey !== apiKey) {
    next(new UnauthorizedError('Insufficient credentials to access'));
  } else {
    next();
  }
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
      const url = req.query.url;
      const locale = req.query.lang || defaultLocale;

      if (!url || typeof url !== 'string') {
        throw new InvalidValueError('url: required;one-occurrence', 'url');
      } else if (url.trim().length === 0) {
        throw new InvalidValueError('url: required', 'url');
      }

      const data = await BrowserService.getPageAsPdf(url as string, locale as string, {});

      if (data) {
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
      const metadata = await BrowserService.getPageMetadata(url as string, locale as string);
      if (metadata) {
        res.json(metadata);
      }
      throw new Error('Unable to process');
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

  app.use('/api', initRoutes());

  initErrorHandlers(app);

  await new Promise(resolve => {
    app.listen(port, () => resolve(undefined));
  });

  console.info(`Server started on port ${port}`);
}

async function init () {
  CacheService.init();
  BrowserService.init();

  await initExpress();
}

init().catch(error => {
  console.error(error);
  process.exit(-1);
});

