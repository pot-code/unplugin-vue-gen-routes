import type { ResolvedOptions, RoutesFolderOption, RoutesFolderOptionResolved } from '../options'
import EventEmitter from 'node:events'
import path, { resolve } from 'pathe'
import picomatch from 'picomatch'
import { appendExtensionListToPattern, asRoutePath } from './utils'

export class RoutesFolderWatcher {
  src: string
  path: string | ((filepath: string) => string)
  extensions: string[]
  filePatterns: string[]
  exclude: string[]
  #emitter: EventEmitter
  #fileMatcher: picomatch.Matcher

  constructor(folderOptions: RoutesFolderOptionResolved) {
    this.src = folderOptions.src
    this.path = folderOptions.path
    this.exclude = folderOptions.exclude
    this.extensions = folderOptions.extensions
    // the pattern includes the extenions, so we leverage picomatch check
    this.filePatterns = folderOptions.pattern
    this.#emitter = new EventEmitter()
    this.#fileMatcher = picomatch(this.filePatterns, {
      ignore: this.exclude,
    })
  }

  #isMatch(filePath: string) {
    return this.#fileMatcher(path.relative(this.src, filePath))
  }

  on(event: 'create' | 'update' | 'delete', handler: (context: HandlerContext) => void) {
    this.#emitter.on(event, (filePath: string) => {
      if (!this.#isMatch(filePath)) {
        return
      }

      filePath = resolve(this.src, filePath)

      handler({
        filePath,
        routePath: asRoutePath(
          {
            src: this.src,
            path: this.path,
            extensions: this.extensions,
          },
          filePath,
        ),
      })
    })
    return this
  }

  receive(filePath: string, event: 'create' | 'update' | 'delete') {
    this.#emitter.emit(event, filePath)
  }

  close() {
    return this.#emitter.removeAllListeners()
  }
}

export interface HandlerContext {
  // resolved path
  filePath: string
  // routePath
  routePath: string
}

export function resolveFolderOptions(
  globalOptions: ResolvedOptions,
  folderOptions: RoutesFolderOption,
): RoutesFolderOptionResolved {
  const extensions = overrideOption(globalOptions.extensions, folderOptions.extensions)
  const filePatterns = overrideOption(globalOptions.filePatterns, folderOptions.filePatterns)

  return {
    src: path.resolve(globalOptions.root, folderOptions.src),
    pattern: appendExtensionListToPattern(
      filePatterns,
      // also override the extensions if the folder has a custom extensions
      extensions,
    ),
    path: folderOptions.path || '',
    extensions,
    filePatterns,
    exclude: overrideOption(globalOptions.exclude, folderOptions.exclude).map((p) =>
      p.startsWith('**') ? p : resolve(p),
    ),
  }
}

function overrideOption(
  existing: string[] | string,
  newValue: undefined | string[] | string | ((existing: string[]) => string[]),
): string[] {
  const asArray = typeof existing === 'string' ? [existing] : existing
  // allow extending when a function is passed
  if (typeof newValue === 'function') {
    return newValue(asArray)
  }
  // override if passed
  if (typeof newValue !== 'undefined') {
    return typeof newValue === 'string' ? [newValue] : newValue
  }
  // fallback to existing
  return asArray
}
