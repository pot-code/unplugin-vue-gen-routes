import { defineConfig } from '@rsbuild/core'
import { pluginVue } from '@rsbuild/plugin-vue'
import VueGenRoutes from 'unplugin-vue-gen-routes/rspack'

export default defineConfig({
  plugins: [pluginVue()],
  tools: {
    rspack: {
      plugins: [VueGenRoutes({})],
    },
  },
})
