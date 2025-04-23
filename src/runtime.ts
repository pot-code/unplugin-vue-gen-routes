import type { RouteRecordRaw } from 'vue-router'

/**
 * Defines properties of the route for the current page component.
 *
 * @param route - route information to be added to this page
 */
export const definePage = (route: DefinePage) => route

/**
 * Type to define a page. Can be augmented to add custom properties.
 */
export interface DefinePage extends Partial<Omit<RouteRecordRaw, 'children' | 'components' | 'component'>> {}
