FROM node:20-alpine
ENV TZ=America/Toronto
ENV PUPPETEER_SKIP_CHROMIUM_DOWNLOAD true
RUN apk --update add bash python3 build-base && apk --update add tzdata git \
   && cp /usr/share/zoneinfo/America/Toronto /etc/localtime \
   && echo "America/Toronto" > /etc/timezone

# Installs latest Chromium (100) package.
RUN apk add --no-cache \
      chromium \
      nss \
      freetype \
      harfbuzz \
      ca-certificates \
      ttf-freefont \
      nodejs \
      yarn

# Tell Puppeteer to skip installing Chrome. We'll be using the installed package.
ENV PUPPETEER_EXECUTABLE_PATH=/usr/bin/chromium-browser

# Puppeteer v13.5.0 works with Chromium 100.
RUN yarn add puppeteer@13.5.0

# Add user so we don't need --no-sandbox.
RUN addgroup -S pptruser && adduser -S -G pptruser pptruser \
    && mkdir -p /home/pptruser/Downloads /app \
    && chown -R pptruser:pptruser /home/pptruser \
    && chown -R pptruser:pptruser /app

WORKDIR /usr/src/app
COPY package.json package-lock.json ./
RUN npm install --no-save
ADD . /usr/src/app
RUN npm run build

RUN cp src/appinfo.json dist/appinfo.json
# Run everything after as non-privileged user.
USER pptruser
CMD [ "node", "./dist/main.js" ]
EXPOSE 7331
