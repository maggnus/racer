import { type Segments } from '../types';
import { FastMap } from './FastMap';

/**
 * Construct a tree root when invoked without any arguments. Children nodes are
 * constructred internally as needed on calls to addListener()
 *
 * @param {EventMapTree} [parent]
 * @param {string} [segment]
 */
export class EventMapTree {
  parent?: EventMapTree;
  segment?: string;
  children: any;
  listener: any;

  constructor(parent?: EventMapTree, segment?: string) {
    this.parent = parent;
    this.segment = segment;
    this.children = null;
    this.listener = null;
  }

  /**
   * Remove the reference to this node from its parent so that it can be garbage
   * collected. This is called internally when all listener to a node
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
      if (parent.listener == null) {
        parent.destroy();
      }
      return;
    }
    // For the root node, reset any references to listener or children
    this.children = null;
    this.listener = null;
  };

  /**
   * Get a node for a path if it exists
   *
   * @param  {string[]} segments
   * @return {EventMapTree|undefined}
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
   * parents in a lazy manner and return the node for the path
   *
   * @param  {string[]} segments
   * @return {EventMapTree}
   */
  _getOrCreateChild(segments: Segments) {
    let node: EventMapTree = this;
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
        node = new EventMapTree(node, segment.toString());
        children.set(segment, node);
      }
    }
    return node;
  };

  /**
   * Assign a listener to a path location. Listener may be any type of value.
   * Return the previous listener value if any
   *
   * @param  {string[]} segments
   * @param  {*} listener
   * @return {*} previous
   */
  setListener(segments: Segments, listener) {
    const node = this._getOrCreateChild(segments);
    const previous = node.listener;
    node.listener = listener;
    return previous;
  };

  /**
   * Remove the listener at a path location and return it
   *
   * @param  {string[]} segments
   * @return {*} previous
   */
  deleteListener(segments: Segments) {
    const node = this._getChild(segments);
    if (!node) return;
    const previous = node.listener;
    node.listener = null;
    if (!node.children) {
      node.destroy();
    }
    return previous;
  };

  /**
   * Remove all listeners and descendent listeners for a path location. Return the
   * node for the path location if any
   *
   * @param  {string[]} segments
   * @return {EventMapTree}
   */
  deleteAllListeners(segments: Segments) {
    const node = this._getChild(segments);
    if (node) {
      node.destroy();
    }
    return node;
  };

  /**
   * Return the direct listener to `segments` if any
   *
   * @param  {string[]} segments
   * @return {*} listeners
   */
  getListener(segments: Segments) {
    const node = this._getChild(segments);
    return (node) ? node.listener : null;
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
  getAffectedListeners(segments) {
    const listeners = [];
    const node = pushAncestorListeners(listeners, segments, this);
    if (node) {
      pushDescendantListeners(listeners, node);
    }
    return listeners;
  };

  /**
   * Call the callback with each listener to the node and its decendants
   *
   * @param {EventMapTree} node
   * @param {Function} callback
   */
  forEach(callback) {
    forListener(this, callback);
    forDescendantListeners(this, callback);
  };
}

/**
 * Push node's direct listener onto the passed in array if not null
 *
 * @param {Array} listeners
 * @param {EventMapTree} node
 */
function pushListener(listeners, node) {
  if (node.listener != null) {
    listeners.push(node.listener);
  }
}

/**
 * Push listeners for each ancestor node and the node at `segments` onto the
 * passed in array. Return the node at `segments` if it exists
 *
 * @param  {Array} listeners
 * @param  {string[]} segments
 * @param  {EventMapTree} node
 * @return {EventMapTree|undefined}
 */
function pushAncestorListeners(listeners, segments, node) {
  pushListener(listeners, node);
  for (let i = 0, len = segments.length; i < len; i++) {
    const children = node.children;
    if (!children) return;
    const segment = segments[i];
    node = children.values[segment];
    if (!node) return;
    pushListener(listeners, node);
  }
  return node;
}

/**
 * Push listeners for each of the node's children and their recursive children
 * onto the passed in array
 *
 * @param {Array} listeners
 * @param {EventMapTree} node
 */
function pushDescendantListeners(listeners, node) {
  if (!node.children) return;
  const values = node.children.values;
  for (const key in values) {
    const child = values[key];
    pushListener(listeners, child);
    pushDescendantListeners(listeners, child);
  }
}

/**
 * Call the callback with the node's direct listener if not null
 *
 * @param {EventMapTree} node
 * @param {Function} callback
 */
function forListener(node, callback) {
  const listener = node.listener;
  if (listener != null) {
    callback(listener);
  }
}

/**
 * Call the callback with each listener value for each of the node's children
 * and their recursive children
 *
 * @param {EventMapTree} node
 * @param {Function} callback
 */
function forDescendantListeners(node, callback) {
  if (!node.children) return;
  const values = node.children.values;
  for (const key in values) {
    const child = values[key];
    forListener(child, callback);
    forDescendantListeners(child, callback);
  }
}
