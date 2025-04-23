import { createWebHistory, createRouter } from 'vue-router'

import { routes } from './routes.gen'

const router = createRouter({
  history: createWebHistory(),
  routes,
})

export default router
