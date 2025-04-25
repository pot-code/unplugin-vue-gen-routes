import type { ResolvedOptions } from '../options'
import type { HandlerContext } from './RoutesFolderWatcher'
import type { TreeNode } from './tree'
import { promises as fs } from 'node:fs'
import fg from 'fast-glob'
import { dirname, relative, resolve } from 'pathe'
import { generateRouteRecord } from '../codegen/generateRouteRecords'
import { DefaultLogger, NoopLogger } from '../utils/logger'
import { MACRO_DEFINE_PAGE } from './constants'
import { getRouteBlock } from './customBlock'
import { extractDefinePageMeta as extractDefinePageData } from './definePage'
import { EditableTreeNode } from './extendRoutes'
import { resolveFolderOptions, RoutesFolderWatcher } from './RoutesFolderWatcher'
import { PrefixTree } from './tree'
import { asRoutePath, ImportsMap, logTree, throttle } from './utils'

export function createRoutesContext(options: ResolvedOptions) {
  const { routesFolder } = options

  const routeTree = new PrefixTree(options)
  const editableRoutes = new EditableTreeNode(routeTree)

  const logger = options.logs === false ? new NoopLogger() : new DefaultLogger('context', options.logs)

  const watchers: RoutesFolderWatcher[] = []

  async function scanPages(watch: boolean = options.watch) {
    if (options.extensions.length < 1) {
      throw new Error('"extensions" cannot be empty. Please specify at least one extension.')
    }

    if (watchers.length > 0) {
      return
    }

    // get the initial list of pages
    await Promise.all(
      routesFolder
        .map((folder) => resolveFolderOptions(options, folder))
        .map((folder) => {
          if (watch) {
            watchers.push(setupWatcher(new RoutesFolderWatcher(folder)))
          }

          // the ignore option must be relative to cwd or absolute
          const ignorePattern = folder.exclude.map((f) =>
            // if it starts with ** then it will work as expected
            f.startsWith('**') ? f : relative(folder.src, f),
          )

          return fg(folder.pattern, {
            cwd: folder.src,
            // TODO: do they return the symbolic link path or the original file
            // followSymbolicLinks: false,
            ignore: ignorePattern,
          }).then((files) =>
            Promise.all(
              files
                // ensure consistent files in Windows/Unix and absolute paths
                .map((file) => resolve(folder.src, file))
                .map((file) =>
                  addPage({
                    routePath: asRoutePath(folder, file),
                    filePath: file,
                  }),
                ),
            ),
          )
        }),
    )

    for (const route of editableRoutes) {
      options.extendRoute?.(route)
    }

    // write the routes file before build
    // or the compile will fail if the routes file is not found
    await _writeRoutes()
  }

  /**
   * extract latest overrides from the file and update the node
   * @param node the node to be updated
   * @param filePath route file path
   */
  async function syncOverridesToNode(node: TreeNode, filePath: string) {
    const content = await fs.readFile(filePath, 'utf8')
    node.hasDefinePage = content.includes(MACRO_DEFINE_PAGE)
    const definedPageData = node.hasDefinePage ? extractDefinePageData(content, filePath) : {}
    const routeBlock = getRouteBlock(filePath, content, options)
    if (node.hasDefinePage && routeBlock) {
      logger.warn(`"${filePath}" has both "definePage" and "route" block, the "route" block will be ignored.`)
    }
    node.setOverrides(filePath, {
      ...routeBlock,
      ...definedPageData,
    })
  }

  async function addPage({ filePath, routePath }: HandlerContext, triggerExtendRoute = false) {
    const node = routeTree.insert(routePath, filePath)
    await syncOverridesToNode(node, filePath)

    if (triggerExtendRoute) {
      options.extendRoute?.(new EditableTreeNode(node))
    }
    logger.info(`added "${routePath}" for "${filePath}"`)
  }

  async function updatePage({ filePath, routePath }: HandlerContext) {
    const node = routeTree.getChild(filePath)
    if (!node) {
      logger.warn(`Cannot update "${filePath}": Not found.`)
      return
    }

    await syncOverridesToNode(node, filePath)
    logger.info(`updated "${routePath}" for "${filePath}"`)
    options.extendRoute?.(new EditableTreeNode(node))
    // no need to manually trigger the update of vue-router/auto-routes because
    // the change of the vue file will trigger HMR
  }

  function removePage({ filePath, routePath }: HandlerContext) {
    routeTree.removeChild(filePath)
    logger.info(`removed "${routePath}" for "${filePath}"`)
  }

  function setupWatcher(watcher: RoutesFolderWatcher) {
    logger.debug(`scanning files in ${watcher.src}`)

    return watcher
      .on('change', async (ctx) => {
        await updatePage(ctx)
        writeRoutes()
      })
      .on('add', async (ctx) => {
        await addPage(ctx, true)
        writeRoutes()
      })
      .on('unlink', (ctx) => {
        removePage(ctx)
        writeRoutes()
      })
  }

  function stopWatcher() {
    if (watchers.length) {
      logger.debug('🛑 stopping watcher')
      watchers.forEach((watcher) => watcher.close())
    }
  }

  function generateRoutes() {
    const importsMap = new ImportsMap()
    const routes = `export const routes = ${generateRouteRecord(routeTree, options, importsMap)}\n`
    // prepend it to the code
    return routes
  }

  let lastRoutes: string | undefined
  async function _writeRoutes() {
    logTree(routeTree, logger.info)
    const content = generateRoutes()
    if (lastRoutes !== content) {
      await fs.mkdir(dirname(options.output), { recursive: true })
      await fs.writeFile(options.output, content, 'utf-8')
      logger.debug('writeRoutes', 'wrote routes file')
      lastRoutes = content
    } else {
      logger.debug('writeRoutes', 'routes file not changed')
    }
  }

  // debounce of 100ms + throttle of 500ms
  // => Initially wait 100ms (renames are actually remove and add but we rather write once) (debounce)
  // subsequent calls after the first execution will wait 500ms-100ms to execute (throttling)

  const writeRoutes = throttle(_writeRoutes, 500, 100)

  return {
    scanPages,
    writeRoutes,
    stopWatcher,
    generateRoutes,
  }
}
