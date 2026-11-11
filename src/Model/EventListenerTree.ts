import { type Path, type Segments } from '../types';
import { FastMap } from './FastMap';

/**
 * Construct a tree root when invoked without any arguments. Children nodes are
 * constructred internally as needed on calls to addListener()
 *
 * @param {EventListenerTree} [parent]
 * @param {string} [segment]
 */
export class EventListenerTree {
  parent?: any;
  segment?: Path;
  children: any;
  listeners: any;

  constructor(parent?: any, segment?: Path) {
    this.parent = parent;
    this.segment = segment;
    this.children = null;
    this.listeners = null;
  }
  /**
   * Remove the reference to this node from its parent so that it can be garbage
   * collected. This is called internally when all listeners to a node
   * are removed
   */
  destroy() {
    // For all non-root nodes, remove the reference to the node
    const parent = this.parent;
    if (parent) {
      // Remove reference to this node from its parent
      const children = parent.children;
      if (children) {
        children.del(this.segment);
        if (children.size > 0) return;
        parent.children = null;
      }
      // Destroy parent if it no longer has any dependents
      if (!parent.listeners) {
        parent.destroy();
      }
      return;
    }
    // For the root node, reset any references to listeners or children
    this.children = null;
    this.listeners = null;
  };

  /**
   * Get a node for a path if it exists
   *
   * @param  {string[]} segments
   * @return {EventListenerTree|undefined}
   */
  _getChild(segments: Segments) {
    let node = this;
    for (let i = 0, len = segments.length; i < len; i++) {
      const children = node.children;
      if (!children) return;
      const segment = segments[i];
      node = children.values[segment];
      if (!node) return;
    }
    return node;
  };

  /**
   * If a path already has a node, return it. Otherwise, create the node and
   * ancestors in a lazy manner. Return the node for the path
   *
   * @param  {string[]} segments
   * @return {EventListenerTree}
   */
  _getOrCreateChild(segments: Segments) {
    let node: EventListenerTree = this;
    for (let i = 0, len = segments.length; i < len; i++) {
      let children = node.children;
      if (!children) {
        children = node.children = new FastMap();
      }
      const segment = segments[i];
      const next = children.values[segment];
      if (next) {
        node = next;
      } else {
        node = new EventListenerTree(node, segment);
        children.set(segment, node);
      }
    }
    return node;
  };

  /**
   * Add a listener to a path location. Listener should be unique per path
   * location, and calling twice with the same segments and listener value has no
   * effect. Unlike EventEmitter, listener may be any type of value
   *
   * @param  {string[]} segments
   * @param  {*} listener
   * @return {EventListenerTree}
   */
  addListener(segments: Segments, listener) {
    const node = this._getOrCreateChild(segments);
    const listeners = node.listeners;
    if (listeners) {
      const i = listeners.indexOf(listener);
      if (i === -1) {
        listeners.push(listener);
      }
    } else {
      node.listeners = [listener];
    }
    return node;
  };

  /**
   * Remove a listener from a path location
   *
   * @param {string[]} segments
   * @param {*} listener
   */
  removeListener(segments: Segments, listener) {
    const node = this._getChild(segments);
    if (node) {
      node.removeOwnListener(listener);
    }
  };

  /**
   * Remove a listener from the current node
   *
   * @param {*} listener
   */
  removeOwnListener(listener) {
    const listeners = this.listeners;
    if (!listeners) return;
    if (listeners.length === 1) {
      if (listeners[0] === listener) {
        this.listeners = null;
        if (!this.children) {
          this.destroy();
        }
      }
      return;
    }
    const i = listeners.indexOf(listener);
    if (i > -1) {
      listeners.splice(i, 1);
    }
  };

  /**
   * Remove all listeners and descendent listeners for a path location
   *
   * @param {string[]} segments
   */
  removeAllListeners(segments: Segments) {
    const node = this._getChild(segments);
    if (node) {
      node.destroy();
    }
  };

  /**
   * Return direct listeners to `segments`
   *
   * @param  {string[]} segments
   * @return {Array} listeners
   */
  getListeners(segments: Segments) {
    const node = this._getChild(segments);
    return (node && node.listeners) ? node.listeners.slice() : [];
  };

  /**
   * Return an array with each of the listeners that may be affected by a change
   * to `segments`. These are:
   *   1. Listeners to each node from the root to the node for `segments`
   *   2. Listeners to all descendent nodes under `segments`
   *
   * @param  {string[]} segments
   * @return {Array} listeners
   */
  getAffectedListeners(segments: Segments) {
    const listeners = [];
    const node = pushAncestorListeners(listeners, segments, this);
    if (node) {
      pushDescendantListeners(listeners, node);
    }
    return listeners;
  };

  /**
   * Return an array with each of the listeners to descendent nodes, not
   * including listeners to `segments` itself
   *
   * @param  {string[]} segments
   * @return {Array} listeners
   */
  getDescendantListeners(segments: Segments) {
    const listeners = [];
    const node = this._getChild(segments);
    if (node) {
      pushDescendantListeners(listeners, node);
    }
    return listeners;
  };

  /**
   * Return an array with each of the listeners to descendent nodes, not
   * including listeners to this node itself
   *
   * @return {Array} listeners
   */
  getOwnDescendantListeners() {
    const listeners = [];
    pushDescendantListeners(listeners, this);
    return listeners;
  };

  /**
   * Return an array with each of the listeners to `segments`, including
   * treating wildcard segments ('*') and remainder segments ('**') as matches
   *
   * @param  {string[]} segments
   * @return {Array} listeners
   */
  getWildcardListeners(segments: Segments) {
    const listeners = [];
    pushWildcardListeners(listeners, this, segments, 0);
    return listeners;
  };
}

/**
 * Push listeners matching `segments`, wildcards ('*'), and remainders ('**')
 * onto passed in array. Start from segments index passed in for branching
 * recursion without needing to modify segments array
 *
 * @param {Array} listeners
 * @param {EventListenerTree} node
 * @param {string[]} segments
 * @param {integer} start
 */
function pushWildcardListeners(listeners, node, segments, start) {
  for (let i = start, len = segments.length; i < len; i++) {
    const children = node.children;
    if (!children) return;
    pushRemainderListeners(listeners, node);
    const wildcardNode = children.values['*'];
    if (wildcardNode) {
      pushWildcardListeners(listeners, wildcardNode, segments, i + 1);
    }
    const segment = segments[i];
    node = children.values[segment];
    if (!node) return;
  }
  if (node.children) {
    pushRemainderListeners(listeners, node);
  }
  pushListeners(listeners, node);
};

/**
 * Push listeners to the '**' onto the passed in array
 *
 * @param {Array} listeners
 * @param {EventListenerTree} node
 */
function pushRemainderListeners(listeners, node) {
  const remainderNode = node.children.values['**'];
  if (remainderNode) {
    pushListeners(listeners, remainderNode);
  }
}

/**
 * Push direct listeners onto the passed in array
 *
 * @param {Array} listeners
 * @param {EventListenerTree} node
 */
function pushListeners(listeners, node) {
  const nodeListeners = node.listeners;
  if (!nodeListeners) return;
  for (let i = 0, len = nodeListeners.length; i < len; i++) {
    listeners.push(nodeListeners[i]);
  }
}

/**
 * Push listeners for each ancestor node and the node at `segments` onto the
 * passed in array. Return the node at `segments` if it exists
 *
 * @param  {Array} listeners
 * @param  {string[]} segments
 * @param  {EventListenerTree} node
 * @return {EventListenerTree|undefined}
 */
function pushAncestorListeners(listeners, segments, node) {
  pushListeners(listeners, node);
  for (let i = 0, len = segments.length; i < len; i++) {
    const children = node.children;
    if (!children) return;
    const segment = segments[i];
    node = children.values[segment];
    if (!node) return;
    pushListeners(listeners, node);
  }
  return node;
}

/**
 * Push listeners for each of the node's children and their recursive children
 * onto the passed in array
 *
 * @param {Array} listeners
 * @param {EventListenerTree} node
 */
function pushDescendantListeners(listeners, node) {
  if (!node.children) return;
  const values = node.children.values;
  for (const key in values) {
    const child = values[key];
    pushListeners(listeners, child);
    pushDescendantListeners(listeners, child);
  }
}
