# syntax=docker/dockerfile:1.4
ARG DEBIAN_RELEASE=trixie

FROM node:24.19.0-${DEBIAN_RELEASE}-slim AS builder

ENV CI=1

ENV DEBIAN_FRONTEND=noninteractive
ARG DEBIAN_RELEASE
ENV DEBIAN_RELEASE=${DEBIAN_RELEASE}

RUN apt-get update \
    && apt-get install -y --no-install-recommends \
        bash \
        ca-certificates \
        coreutils \
        tini \
    && rm -rf /var/lib/apt/lists/*

RUN npm install -g pnpm@11.20.0
FROM builder AS server-build

WORKDIR /usr/src/app

COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
COPY server/package.json ./server/package.json
COPY web/package.json ./web/package.json
COPY e2e/package.json ./e2e/package.json
RUN pnpm install --frozen-lockfile

COPY ./server ./server/
RUN pnpm --filter ./server build && \
    pnpm --filter ./server --prod deploy /output/server-pruned

FROM builder AS server

WORKDIR /usr/src/app

COPY --from=server-build /output/server-pruned ./

EXPOSE 2293

ENTRYPOINT ["/usr/bin/tini", "--"]
CMD ["node", "dist/main.js"]
