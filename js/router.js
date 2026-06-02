/**
 * router.js — Hash-based SPA router
 *
 * Routes map '#route' → handler(param1, param2, ...)
 * e.g. '#lesson/06-loops' calls routes['lesson']('06-loops')
 *
 * Usage:
 *   import { Router } from './router.js';
 *   const router = new Router({
 *     home:   () => renderHome(),
 *     lesson: (id) => renderLesson(id),
 *     stats:  () => renderStats(),
 *   });
 */

export class Router {
  constructor(routes) {
    this.routes = routes;
    this._onHashChange = this._resolve.bind(this);
    window.addEventListener('hashchange', this._onHashChange);
    // Resolve immediately on construction
    this._resolve();
  }

  /** Navigate to a new hash route */
  navigate(path) {
    if (!path.startsWith('#')) path = '#' + path;
    window.location.hash = path;
  }

  /** Highlight the matching nav link */
  _updateNav(route) {
    document.querySelectorAll('[data-route]').forEach((el) => {
      el.classList.toggle('active', el.dataset.route === route);
    });
  }

  /** Parse current hash and call the matching handler */
  _resolve() {
    const raw   = window.location.hash || '#home';
    const parts = raw.slice(1).split('/');        // e.g. ['lesson', '06-loops']
    const route = parts[0] || 'home';
    const params = parts.slice(1);               // rest are params

    this._updateNav(route);

    const handler = this.routes[route] ?? this.routes['404'];
    if (handler) {
      handler(...params);
    } else {
      this.routes['home']?.();
    }
  }

  destroy() {
    window.removeEventListener('hashchange', this._onHashChange);
  }
}
