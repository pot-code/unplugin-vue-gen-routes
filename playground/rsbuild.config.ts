import { defineConfig } from '@rsbuild/core'
import { pluginVue } from '@rsbuild/plugin-vue'
import VueGenRoutes from '../src/rspack'

export default defineConfig({
  plugins: [pluginVue()],
  tools: {
    rspack: {
      plugins: [VueGenRoutes({})],
    },
  },
})
