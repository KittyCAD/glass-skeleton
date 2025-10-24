import BSON = require('bson')

type Exchanges = ({ request: string } | { response: string })[]

type Capture = {
  capture: Record<
    string /* URL */,
    // Open to extension.
    {
      exchanges: Exchanges,
    }
  >
}

type CaptureFn<T> = (passedIn: T) => void

type ForOtherEnv = {
  IDENTIFIER: typeof IDENTIFIER,
  urlRegExpStr: string,
  removeMatchingRegExpStrs: string[],
}

declare global {
  interface Window {
    glassSkeletonCapture: Capture
  }
}

const DIR_BONEYARD = 'boneyard'
const IDENTIFIER = '#GlassSkeletonRecorder'

class GlassSkeletonRecorder {
  // Why isn't this the same as the window.exchanges? It's because this code
  // is used in some environments where there are actually two environments,
  // that communicate with eachother over a bridge.
  // I've written the code to be environment generic, and always see the world
  // as having this bridge, but sometimes, there is actually none, such as
  // a regular web browser.
  public capture: Capture = { capture: {} }

  // Various environments have different mechanisms to interact with the page.
  // It's really unfortunate, but playwright appears to require the page
  // object to really be a reference when using methods like `addInitScript`
  // or `evaluate`. The better alternative would've been to pass in higher
  // order functions that abstract over what we want (hence `onPageReady` and
  // `executeWithinPage` for browser, which was supposed to be reusable).
  // At least for all environments, the fs functions can remain generic.
  public env: ({
    type: 'playwright',
    page: any,
  } | {
    type: 'browser',
    onPageReady: <T>(fn: CaptureFn<T>, passIn: T) => Promise<void>,
    executeWithinPage: <T>(fn: () => T) => Promise<T>
  }) & {
    fs: {
      writeFile: (path: string, data: Uint8Array) => Promise<unknown>,
      mkdir: (path: string) => Promise<unknown>,
    },
    path: {
      resolve: (...path: string[]) => string,
    }
  } & {
    resources: {
      protocol: GlassSkeletonRecorder.SupportedProtocol,
      urlRegExpStr: string,
      // Intended to remove sensitive data. Uses regular expressions.
      removeMatchingRegExpStrs: string[]
    }[]
  }

  constructor(env: GlassSkeletonRecorder['env']) {
    this.env = env
  }

  async start() {
    // Make sure we're starting with a fresh capture.
    this.capture = { capture: {} }

    const captureWebSocket = (passedIn: ForOtherEnv) => {
      // I've tried to avoid property-name clashing but TypeScript makes it
      // not possible because this name is generated at runtime (not TS's fault).
      window.glassSkeletonCapture  = { capture: {} }

      console.log(passedIn.IDENTIFIER, 'Hooked into other environment')
      const WebSocketOg = window.WebSocket
      const WebSocketProxy = new Proxy(WebSocketOg, {
        construct(target, argumentsList, newTarget) {
          const ogSocket = Reflect.construct(target, argumentsList, newTarget)
          const url = argumentsList[0]

          const urlRegExp = new RegExp(passedIn.urlRegExpStr)
          if (urlRegExp.test(url) === false) {
            console.log(passedIn.IDENTIFIER, "This WebSocket didn't match")
            console.log(passedIn.IDENTIFIER, url)
            return ogSocket
          }
          
          console.log(passedIn.IDENTIFIER, 'Intercepting WebSocket constructor')

          const resource: { exchanges: Exchanges }  = {
            exchanges: []
          }

          window.glassSkeletonCapture.capture[url] = resource

          const ogSocketSend = ogSocket.send
          ogSocket.send = (...args: any[]) => {
            const removalRegExps = passedIn.removeMatchingRegExpStrs
              .map((str) => new RegExp(str))

            let request = args[0]

            removalRegExps.forEach((r) => { request = request.replace(r, '') })
            resource.exchanges.push({ request })
            Reflect.apply(ogSocketSend, ogSocket, args)
          }

          ogSocket.addEventListener('message', (event: MessageEvent) => {
            resource.exchanges.push({ response: event.data })
          })

          return ogSocket
        }
      })

      window.WebSocket = WebSocketProxy
    }

    const captureFns: Record<
      GlassSkeletonRecorder.SupportedProtocol,
      CaptureFn<ForOtherEnv>
    > = {
      [GlassSkeletonRecorder.SupportedProtocol.WebSocket]: captureWebSocket
    }

    for (const resource of this.env.resources) {
      switch (this.env.type) {
        case 'playwright':
          await this.env.page.addInitScript(captureFns[resource.protocol], {
            IDENTIFIER,
            urlRegExpStr: resource.urlRegExpStr,
            removeMatchingRegExpStrs: resource.removeMatchingRegExpStrs,
          })
          break
        case 'browser':
          await this.env.onPageReady(captureFns[resource.protocol], {
            IDENTIFIER,
            urlRegExpStr: resource.urlRegExpStr,
            removeMatchingRegExpStrs: resource.removeMatchingRegExpStrs,
          })
          break
      }
    }
  }

  async stop() {
    switch (this.env.type) {
      case 'playwright':
        this.capture = await this.env.page.evaluate(() => {
          return window.glassSkeletonCapture
        })
        break
      case 'browser':
        this.capture = await this.env.executeWithinPage<Capture>(() => {
          return window.glassSkeletonCapture
        })
        break
    }
  }

  async save(args: { outputDir: string, outputName: string }) {
    const outputDirComplete = this.env.path.resolve(args.outputDir, DIR_BONEYARD)
    this.env.fs.mkdir(outputDirComplete)
    const outputPathFull = this.env.path.resolve(outputDirComplete, args.outputName)
    return this.env.fs.writeFile(outputPathFull, BSON.serialize(this.capture))
  }
}

namespace GlassSkeletonRecorder {
  export enum SupportedProtocol {
    WebSocket = 'WebSocket',
  }
}

export = {
  GlassSkeletonRecorder
}
