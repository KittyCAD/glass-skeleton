export type Exchanges = ({ request: string } | { response: string })[]

export type Capture = {
  capture: Record<
    string /* URL */,
    // Open to extension.
    {
      exchanges: Exchanges,
    }
  >
}

export type CaptureFn<T> = (passedIn: T) => void

export type ForOtherEnv = {
  IDENTIFIER: string,
  urlRegExpStr: string,
  removeMatchingRegExpStrs: string[],
}
