# Vinci Render Server

The project simply wraps a headless Chrome browser (provided by puppeteer)
with a REST API, so that it can be run separate to other services.

This is very much a work in progress. It hasn't been load tested or tested
for security vunerabilities. Use at your own risk.

Author: Andre-John Mas

## Endpoints

- `/api/` -- server build information
- `/api/browser/screenshot` -- creates a screenshot of the page
  - **url**: the URL of the page
  - **lang**: the page language (default: en)
  - **w**: width of the page in pixels (default: 1920)
  - **h**: height of the page in pixels (default: 1080)
- `/api/browser/pdf` -- creates a pdf of the page
  - **url**: the URL of the page
  - **lang**: the page language (default: en)
- `/api/browser/html` -- returns the HTML of the page
  - **url**: the URL of the page
  - **lang**: the page language (default: en)
- `/api/browser/metadata` -- returns the page metadata
  - **url**: the URL of the page
  - **lang**: the page language (default: en)
- `/api/browser/preview` -- returns the page metadata suitable for a link preview
  - **url**: the URL of the page
  - **lang**: the page language (default: en)

Note: all endpoints, except `/api` need an `apikey` parameter. The accepted 
values can be configured in the `config/default.json` file.

## Building & Running

This project is written using Node.js version 20, which  you will
need before you start.

### Setting Up

First install the dependencies:

```
npm install
```

### Running in Dev

```
npm run web
```

### Building

```
npm run build
```

## License

MIT

