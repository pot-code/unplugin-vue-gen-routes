import type { UnpluginFactory } from 'unplugin'
import type { Options } from './types'
import { join } from 'node:path'
import { createUnplugin } from 'unplugin'
import { createRoutesContext } from './core/context'
import { definePageTransform } from './core/definePage'
import { appendExtensionListToPattern } from './core/utils'
import { mergeAllExtensions, resolveOptions } from './options'
import createFilter from './utils/filter'

export { EditableTreeNode } from './core/extendRoutes'

export const unpluginFactory: UnpluginFactory<Options | undefined> = (options = {}) => {
  const resolvedOptions = resolveOptions(options)
  const ctx = createRoutesContext(resolvedOptions)

  // create the transform filter to detect `definePage()` inside page component
  const pageFilePattern = appendExtensionListToPattern(
    resolvedOptions.filePatterns,
    mergeAllExtensions(resolvedOptions),
  )

  // this is a larger filter that includes a bit too many files
  // the RouteFolderWatcher will filter it down to the actual files
  const filterPageComponents = createFilter(
    resolvedOptions.routesFolder.flatMap((routeOption) =>
      pageFilePattern.map((pattern) => join(routeOption.src, pattern)),
    ),
    resolvedOptions.exclude,
  )

  return {
    name: 'unplugin-vue-gen-routes',
    enforce: 'pre',
    transformInclude(id) {
      return filterPageComponents(id)
    },
    transform(code, id) {
      return definePageTransform(code, id)
    },
    rspack(compiler) {
      compiler.hooks.beforeCompile.tapAsync('unplugin-vue-gen-routes', () => ctx.scanPages(false))
      compiler.hooks.watchRun.tapAsync('unplugin-vue-gen-routes', () => ctx.scanPages())
    },
    webpack(compiler) {
      compiler.hooks.beforeCompile.tapAsync('unplugin-vue-gen-routes', () => ctx.scanPages(false))
      compiler.hooks.watchRun.tapAsync('unplugin-vue-gen-routes', () => ctx.scanPages())
    },
    rollup: {
      buildStart() {
        return ctx.scanPages(this.meta.watchMode)
      },
    },
  }
}

export { createRoutesContext }
// Route Tree and edition
export { createTreeNodeValue } from './core/treeNodeValue'

export { getFileBasedRouteName, getPascalCaseRouteName } from './core/utils'
export type * from './types'

export const unplugin = /* #__PURE__ */ createUnplugin(unpluginFactory)

export default unplugin
