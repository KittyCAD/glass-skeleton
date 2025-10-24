# Glass Skeleton

JavaScript/TypeScript tooling to distill and replay E2E tests as server
request/response pairs.

The tool supports the following protocols:

* WebSocket

# Requirements

The usual suspects:

* node
* npm

We try to not make the versions matter, as long as they can run ES6+ code.

# Usage

At a high level, the recording mechanisms (detailed below) output a BSON capture
file that is then fed into a replay tool.

## Capture

### Recorder

A `GlassSkeletonRecorder` class is available to capture requests in the following
environments:

* Playwright (Browser, Electron)
* Browser

Each environment has specific code to `start` and `stop` the recorder, but it's
the users responsibility to call those methods in the correct places.

The output of a capture is in BSON, as it has the ability to keep binary together
with other metadata. Please refer to the class for its structure.

#### Configuration

The `GlassSkeletonRecorder` class takes a configuration object which passes in
the environment type, and its dependencies, as well as what protocol URL to
watch / match against. Here's an example:

```ts
const recorder = new GlassSkeletonRecorder({
  type: 'playwright',
  page,
  fs: {
    writeFile: fs.writeFile,
    mkdir: fs.mkdir,
  },
  path: {
    resolve: path.resolve,
  },
  protocol: GlassSkeletonRecorder.SupportedProtocol.WebSocket,
  urlToWatch: /wss:\/\/api.example.com/
})
```


### Chrome Extension

Alternatively a Chrome extension is available for users to do quick one-off
captures. This is particularly useful for sales peoples' demos, where they
expect the same demo to work. Changes to a service can be caught and prevent
their demo from going bad.

The extension can be downloaded from releases and side-loaded.

It has two buttons:

* Start/Stop
* Save capture

## Replay

After a `<capture>.bson` file is generated, it's time to replay the
requests against the server.

1. Start up the server that will consume the requests.
2. Run `node replay.ts <capture>.bson`.
3. Wait for it to complete.
4. Review the final output for any failures.
5. Either make adjustments to the server code, or the capture, and repeat.

The output is formatted, but can be in pure json via `--json` for consumption
by other tools.
