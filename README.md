# Kondis

An open source, self-hosted fitness tracker.

Let's do to commercial fitness platforms what Immich did to photo hosting.

The name is Nordic slang for "conditioning"

## Goals (subject to change)

1. Mobile apps with fast, reliable workout tracking
2. Workout analysis and route map display
3. Support for .fit and .gpx files
4. Multi-user support with roles and shared environments
5. Privacy-first defaults with self-hosted ownership of data

## Development

```bash
mise run dev
```

The web app is available at [http://localhost:3000](http://localhost:3000) and proxies API requests to the server container on port 2293.

The activity list receives completed imports over WebSockets from port 2293. Set
`PUBLIC_KONDIS_EVENTS_URL` to the public `ws://` or `wss://` `/events` URL when the API is exposed through a reverse proxy.

## License

Kondis is licensed under AGPL-3.0-or-later; see [LICENSE](./LICENSE).

Bundled third-party dependencies and their notices are listed in
[THIRD-PARTY-LICENSES.md](./THIRD-PARTY-LICENSES.md).
