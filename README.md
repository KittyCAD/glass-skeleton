# Glass Skeleton

JavaScript/TypeScript tooling to distill and replay E2E tests as server
request/response pairs.

Why would you ever want such a tool?

The short version: *you want to use this tool if you want to create "interaction
API contracts"*.

The long version: Let me explain.

E2E testing frameworks, such as Playwright, while extremely useful in capturing
and testing user behaviors, have the downside of being slow and flakey.

It was clear to us that E2Es were genuinely useful, especially for establishing
implicit "contracts" between the server and client. The E2Es for us were
essentially micro-API contracts that the server had to always abide by.

This is particularly useful because a lot of service developers don't want
"totality checking" aka an extremely rigorous API contract they have to work
against, otherwise, breaking changes will happen extremely often. If you're
versioning your API, this is not a factor, but a lot of the time teams aren't
because of the inherent infrastructure complexity.

Given that, and knowledge that pure information is faster to check than awaiting
virtual interactions, the concept behind "glass skeletons" is simple:

*Interactions are service exchanges.*

A click that leads to a request is captured. A response is usually then either
acted on by the system or visualized in some way.

As long as those two parts are captured and used to replay and check, we can
guarantee the client will act the same way if the service gives us what's
expected.

**Note**: This does *not* remove the need for E2Es, as they're still required
to check complex data->component transformations / visualizations.
Additionally the E2Es are needed to generate the glass skeletons in the first
place (although you can get away with just the Chrome extension, which is a
totally valid use-case).

## Why the name?

Because Playwright is metaphorically a person clicking and pressing keys and
waiting around for stuff to happen. I wanted to keep this metaphor but reflect
that it's a much lighter variant of a person, but also, that when something
goes wrong, they explode into a bajillion shards. Thus: the glass skeleton.

# Requirements

The usual suspects:

* node
* npm

We try to not make the versions matter, as long as they can run ES6+ code.

# Usage

At a high level, the recording mechanisms (detailed below) output a BSON capture
file that is then fed into a replay tool.

The tool supports the following protocols:

* WebSocket

The tool also supports capturing multiple URLs at once. The intent is you can
capture interactions with many services (WebSocket, HTTP, whatever) in one run.

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
  urlRegExpStr: 'wss://api.example.com'
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
