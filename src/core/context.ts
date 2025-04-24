import type { ResolvedOptions } from '../options'
import type { HandlerContext } from './RoutesFolderWatcher'
import type { TreeNode } from './tree'
import fs from 'node:fs'
import fg from 'fast-glob'
import { dirname, relative, resolve } from 'pathe'
import { generateRouteRecord } from '../codegen/generateRouteRecords'
import { DefaultLogger, NoopLogger } from '../utils/logger'
import { getRouteBlock } from './customBlock'
import { extractDefinePageMeta, extractDefinePageNameAndPath } from './definePage'
import { EditableTreeNode } from './extendRoutes'
import { resolveFolderOptions, RoutesFolderWatcher } from './RoutesFolderWatcher'
import { PrefixTree } from './tree'
import { asRoutePath, ImportsMap, logTree, throttle } from './utils'

export function createRoutesContext(options: ResolvedOptions) {
  const { routesFolder } = options

  const routeTree = new PrefixTree(options)
  const editableRoutes = new EditableTreeNode(routeTree)

  const logger = options.logs === false ? new NoopLogger() : new DefaultLogger(options.logs)

  let scanned = false
  const watchers: RoutesFolderWatcher[] = []

  async function scanPages() {
    if (options.extensions.length < 1) {
      throw new Error('"extensions" cannot be empty. Please specify at least one extension.')
    }

    // initial scan was already done
    if (scanned) {
      return
    }

    // get the initial list of pages
    await Promise.all(
      routesFolder
        .map((folder) => resolveFolderOptions(options, folder))
        .map((folder) => {
          watchers.push(setupWatcher(new RoutesFolderWatcher(folder)))

          // the ignore option must be relative to cwd or absolute
          const ignorePattern = folder.exclude.map((f) =>
            // if it starts with ** then it will work as expected
            f.startsWith('**') ? f : relative(folder.src, f),
          )

          return fg(folder.pattern, {
            cwd: folder.src,
            // TODO: do they return the symbolic link path or the original file?
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
      await options.extendRoute?.(route)
    }

    scanned = true
  }

  async function flushChangesToNode(node: TreeNode, filePath: string) {
    const content = fs.readFileSync(filePath, 'utf8')
    node.hasDefinePage ||= content.includes('definePage')
    const definedPageNameAndPath = extractDefinePageNameAndPath(content, filePath)
    const definedPageMeta = node.hasDefinePage ? extractDefinePageMeta(content, filePath) : {}
    const routeBlock = getRouteBlock(filePath, content, options)
    if (node.hasDefinePage && routeBlock) {
      logger.warn(`"${filePath}" has both "definePage" and "route" block, the "route" block will be ignored.`)
    }
    node.update(filePath, {
      ...routeBlock,
      ...definedPageNameAndPath,
      ...definedPageMeta,
    })
  }

  async function addPage({ filePath, routePath }: HandlerContext, triggerExtendRoute = false) {
    logger.info(`added "${routePath}" for "${filePath}"`)
    const node = routeTree.insert(routePath, filePath)
    await flushChangesToNode(node, filePath)

    if (triggerExtendRoute) {
      options.extendRoute?.(new EditableTreeNode(node))
    }
  }

  function updatePage({ filePath, routePath }: HandlerContext) {
    logger.info(`updated "${routePath}" for "${filePath}"`)
    const node = routeTree.getChild(filePath)
    if (!node) {
      logger.warn(`Cannot update "${filePath}": Not found.`)
      return
    }
    flushChangesToNode(node, filePath)
    options.extendRoute?.(new EditableTreeNode(node))
    // no need to manually trigger the update of vue-router/auto-routes because
    // the change of the vue file will trigger HMR
  }

  function removePage({ filePath, routePath }: HandlerContext) {
    logger.info(`remove "${routePath}" for "${filePath}"`)
    routeTree.removeChild(filePath)
  }

  function onFileChanges(id: string, event: 'create' | 'update' | 'delete') {
    watchers.forEach((watcher) => watcher.receive(id, event))
  }

  function setupWatcher(watcher: RoutesFolderWatcher) {
    logger.info(`handle file changes in ${watcher.src}`)

    return watcher
      .on('update', (ctx) => {
        updatePage(ctx)
      })
      .on('create', async (ctx) => {
        addPage(ctx, true)
      })
      .on('delete', (ctx) => {
        removePage(ctx)
      })
  }

  function generateRoutes() {
    const importsMap = new ImportsMap()
    const routes = `export const routes = ${generateRouteRecord(routeTree, options, importsMap)}\n`
    // prepend it to the code
    return routes
  }

  let lastRoutes: string | undefined
  function _writeRoutes() {
    logger.time('writeRoutes')

    logTree(routeTree, logger.info)
    const content = generateRoutes()
    if (lastRoutes !== content) {
      fs.mkdirSync(dirname(options.output), { recursive: true })
      fs.writeFileSync(options.output, content, 'utf-8')
      logger.timeLog('writeRoutes', 'wrote routes file')
      lastRoutes = content
    } else {
      logger.timeLog('writeRoutes', 'routes file not changed')
    }
    logger.timeEnd('writeRoutes')
  }

  // debounce of 100ms + throttle of 500ms
  // => Initially wait 100ms (renames are actually remove and add but we rather write once) (debounce)
  // subsequent calls after the first execution will wait 500ms-100ms to execute (throttling)

  const writeRoutes = throttle(_writeRoutes, 500, 0)

  return {
    scanPages,
    onFileChanges,
    writeRoutes,
    generateRoutes,
  }
}
