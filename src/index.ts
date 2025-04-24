import type { UnpluginFactory } from 'unplugin'
import type { Options } from './types'
import fs from 'node:fs'
import { dirname, join } from 'node:path'
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

  // write the routes file before build
  // or the compile will fail if the routes file is not found
  const content = ctx.generateRoutes()
  fs.mkdirSync(dirname(resolvedOptions.output), { recursive: true })
  fs.writeFileSync(resolvedOptions.output, content, 'utf-8')

  return {
    name: 'unplugin-vue-gen-routes',
    enforce: 'pre',
    async buildStart() {
      await ctx.scanPages()
      ctx.writeRoutes()
    },
    watchChange(id, change) {
      ctx.onFileChanges(id, change.event)
    },
    transformInclude(id) {
      return filterPageComponents(id)
    },
    transform(code, id) {
      return definePageTransform(code, id)
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
