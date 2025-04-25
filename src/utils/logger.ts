function parseLogLevel(level: string): number {
  switch (level) {
    case 'debug':
      return 0
    case 'info':
      return 1
    case 'warn':
      return 2
    case 'error':
      return 3
    default:
      return 1
  }
}

interface Logger {
  debug: (...args: any[]) => void
  info: (...args: any[]) => void
  warn: (...args: any[]) => void
  error: (...args: any[]) => void
  time: (name: string) => void
  timeEnd: (name: string) => void
  timeLog: (name: string, ...args: any[]) => void
}

export class DefaultLogger implements Logger {
  level: number
  #context: string

  constructor(context: string = 'root', level: 'debug' | 'info' | 'warn' | 'error' = 'info') {
    this.level = parseLogLevel(level)
    this.#context = `[unplugin-vue-gen-routes](${context})`
  }

  debug = (...args: any[]) => {
    if (this.level > 0) return
    console.log(this.#context, 'DEBUG', ...args)
  }

  info = (...args: any[]) => {
    if (this.level > 1) return
    console.log(this.#context, 'INFO ', ...args)
  }

  warn = (...args: any[]) => {
    if (this.level > 2) return
    console.warn(this.#context, 'WARN ', ...args)
  }

  error = (...args: any[]) => {
    if (this.level > 3) return
    console.error(this.#context, 'ERROR', ...args)
  }

  time = (name: string) => {
    if (this.level > 0) return
    console.time(name)
  }

  timeEnd = (name: string) => {
    if (this.level > 0) return
    console.timeEnd(name)
  }

  timeLog = (name: string, ...args: any[]) => {
    if (this.level > 0) return
    console.timeLog(name, this.#context, 'debug:', ...args)
  }
}

export class NoopLogger implements Logger {
  debug = () => {}
  info = () => {}
  warn = () => {}
  error = () => {}
  time = () => {}
  timeEnd = () => {}
  timeLog = () => {}
}
