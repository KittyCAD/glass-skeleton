import BSON = require('bson')

type Exchanges = ({ request: string } | { response: string })[]

declare global {
  interface Window {
    exchanges: Exchanges
  }
}

const DIR_BONEYARD = 'boneyard'

class GlassSkeletonRecorder {
  // Why isn't this the same as the window.exchanges? It's because this code
  // is used in some environments where there are actually two environments,
  // that communicate with eachother over a bridge.
  // I've written the code to be environment generic, and always see the world
  // as having this bridge, but sometimes, there is actually none, such as
  // a regular web browser.
  public exchangesBuffered: Exchanges = []

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
    onPageReady: (fn: () => void) => Promise<void>,
    executeWithinPage: <T>(fn: () => T) => Promise<T>
  }) & {
    fs: {
      writeFile: (path: string, data: Uint8Array) => Promise<unknown>,
      mkdir: (path: string) => Promise<unknown>,
    },
    path: {
      resolve: (...path: string[]) => string,
    }
  }

  constructor(env: GlassSkeletonRecorder['env']) {
    this.env = env
  }

  async start() {
    // Re-initialize captured exchanges
    this.exchangesBuffered = []

    const fnWithinOtherEnv = () => {
      window.exchanges = []

      console.log('#glassSkeleton Proxying WebSocket')
      const WebSocketOg = window.WebSocket
      const WebSocketProxy = new Proxy(WebSocketOg, {
        construct(...args) {
          console.log('#glassSkeleton Intercepting constructor')

          const ogSocket = Reflect.construct(...args)

          const ogSocketSend = ogSocket.send
          ogSocket.send = (...args: any[]) => {
            window.exchanges.push({ request: args[0] })
            ogSocketSend.apply(ogSocket, args)
          }

          ogSocket.addEventListener('message', (event: MessageEvent) => {
            window.exchanges.push({ response: event.data })
          })

          return ogSocket
        }
      })

      window.WebSocket = WebSocketProxy
    }

    switch (this.env.type) {
      case 'playwright':
        await this.env.page.addInitScript(fnWithinOtherEnv)
        break
      case 'browser':
        await this.env.onPageReady(fnWithinOtherEnv)
        break
    }
  }

  async stop() {
    switch (this.env.type) {
      case 'playwright':
        this.exchangesBuffered = await this.env.page.evaluate(() => {
          return window.exchanges
        })
        break
      case 'browser':
        this.exchangesBuffered = await this.env.executeWithinPage<Exchanges>(() => {
          return window.exchanges
        })
        break
    }
  }

  async save(args: { outputDir: string, outputName: string }) {
    const outputDirComplete = this.env.path.resolve(args.outputDir, DIR_BONEYARD)
    this.env.fs.mkdir(outputDirComplete)
    const outputPathFull = this.env.path.resolve(outputDirComplete, args.outputName)
    return this.env.fs.writeFile(outputPathFull, BSON.serialize({ capture: this.exchangesBuffered }))
  }
}

export = {
  GlassSkeletonRecorder
}
