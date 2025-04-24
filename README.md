# unplugin vue route generator

A powerful route generator plugin for Vue.js applications using [unplugin](https://unplugin.unjs.io/). This plugin automatically generates Vue Router routes based on your file-based routing structure.

## Features

- Automatic route generation from file structure
- Support for dynamic routes
- TypeScript support
- Hot module replacement (HMR) support
- Customizable route configuration
- Integration with rspack/webpack/rollup build system

## Installation

```bash
# Using pnpm
pnpm add -D Unplugin-vue-gen-routes

# Using npm
npm install -D Unplugin-vue-gen-routes

# Using yarn
yarn add -D Unplugin-vue-gen-routes
```

## Usage

1. Configure the plugin in your rsbuild configuration:

```ts
import { defineConfig } from '@rsbuild/core'
import { pluginVue } from '@rsbuild/plugin-vue'
import VueGenRoutes from 'unplugin-vue-gen-routes/rspack'

export default defineConfig({
  plugins: [pluginVue()],
  tools: {
    rspack: {
      plugins: [VueGenRoutes()],
    },
  },
})

```

2. Create your Vue components following the file-based routing convention:

```
src/
  pages/
    index.vue        # / route
    about.vue        # /about route
    users/
      [id].vue       # /users/:id dynamic route
      index.vue      # /users route
```

## Configuration Options

The plugin accepts the following configuration options:

```ts
interface Options {
  // Directory containing your route components
  pagesDir?: string

  // File extensions to consider as route components
  extensions?: string[]

  // Custom route configuration
  routes?: RouteConfig[]

  // Output file for the generated routes, defaults to 'src/router/routes.gen.ts'
  output?: string
}
```

## Development

```bash
# Install dependencies
pnpm install

# Build the project
pnpm build

# Run tests
pnpm test

# Development mode with watch
pnpm dev
```

## License

MIT © [pot-code](https://github.com/pot-code)

## Contributing

Contributions are welcome! Please feel free to submit a Pull Request.

## Credits

This plugin is inspired by [unplugin-vue-router](https://github.com/posva/unplugin-vue-router).
