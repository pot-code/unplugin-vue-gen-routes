export const routes = [
  {
    path: '/',
    name: '/',
    component: () => import('D:/opensource/unplugin-vue-gen-routes/playground/src/pages/index.vue'),
    /* no children */
  },
  {
    path: '/system',
    /* internal name: '/system' */
    /* no component */
    children: [
      {
        path: 'department',
        name: '/system/department',
        component: () => import('D:/opensource/unplugin-vue-gen-routes/playground/src/pages/system/department.vue'),
        /* no children */
        meta: {
          "title": "departments",
          "layout": false
        }
      },
      {
        path: 'user',
        name: '/system/user',
        component: () => import('D:/opensource/unplugin-vue-gen-routes/playground/src/pages/system/user.vue'),
        /* no children */
        meta: {
          "title": "user",
          "layout": false
        }
      }
    ],
  }
]
