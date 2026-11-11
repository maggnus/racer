import { EventListenerTree } from './EventListenerTree';
import { EventMapTree } from './EventMapTree';
import { Model } from './Model';

export interface RefListOptions {
  /**
   * If true, then objects from the source collection will be deleted if the
   * corresponding item is removed from the refList's output path.
   */
  deleteRemoved: boolean,
}

declare module './Model' {
  interface Model {
    refList(to: any, ids: any, options?: RefListOptions): RefList;
    refList(from: any, to: any, ids: any, options?: RefListOptions): RefList;
  }
}

Model.INITS.push(function(model) {
  const root = model.root;
  root._refLists = new RefLists();
  addListener(root, 'changeImmediate');
  addListener(root, 'loadImmediate');
  addListener(root, 'unloadImmediate');
  addListener(root, 'insertImmediate');
  addListener(root, 'removeImmediate');
  addListener(root, 'moveImmediate');
});

function addListener(model, type) {
  model.on(type, refListListener);
  function refListListener(segments, event) {
    const passed = event.passed;
    // Check for updates on or underneath paths
    let refLists = model._refLists.fromMap.getAffectedListeners(segments);
    for (let i = 0; i < refLists.length; i++) {
      const refList = refLists[i];
      if (passed.$refList !== refList) {
        patchFromEvent(segments, event, refList);
      }
    };
    refLists = model._refLists.toListeners.getAffectedListeners(segments);
    for (let i = 0; i < refLists.length; i++) {
      const refList = refLists[i];
      if (passed.$refList !== refList) {
        patchToEvent(segments, event, refList);
      }
    };
    refLists = model._refLists.idsListeners.getAffectedListeners(segments);
    for (let i = 0; i < refLists.length; i++) {
      const refList = refLists[i];
      if (passed.$refList !== refList) {
        patchIdsEvent(segments, event, refList);
      }
    }
  }
}

/**
 * @param {String} type
 * @param {Array} segments
 * @param {Event} event
 * @param {RefList} refList
 */
function patchFromEvent(segments, event, refList) {
  const type = event.type;
  const fromLength = refList.fromSegments.length;
  const segmentsLength = segments.length;
  const model = refList.model.pass(event.passed, true);

  // Mutation on the `from` output itself
  if (segmentsLength === fromLength) {
    if (type === 'insert') {
      const ids = setNewToValues(model, refList, event.values);
      model._insert(refList.idsSegments, event.index, ids);
      return;
    }

    if (type === 'remove') {
      const howMany = event.values.length;
      const ids = model._remove(refList.idsSegments, event.index, howMany);
      // Delete the appropriate items underneath `to` if the `deleteRemoved`
      // option was set true
      if (refList.deleteRemoved) {
        for (let i = 0; i < ids.length; i++) {
          const item = refList.itemById(ids[i]);
          model._del(refList.toSegmentsByItem(item));
        }
      }
      return;
    }

    if (type === 'move') {
      model._move(refList.idsSegments, event.from, event.to, event.howMany);
      return;
    }

    // Change of the entire output
    const values = (type === 'change') ?
      event.value : model._get(refList.fromSegments);
    // Set ids to empty list if output is set to null
    if (!values) {
      model._set(refList.idsSegments, []);
      return;
    }
    // If the entire output is set, create a list of ids based on the output,
    // and update the corresponding items
    const ids = setNewToValues(model, refList, values);
    model._set(refList.idsSegments, ids);
    return;
  }

  // If mutation is on a parent of `from`, we might need to re-create the
  // entire refList output
  if (segmentsLength < fromLength) {
    model._setArrayDiff(refList.fromSegments, refList.get());
    return;
  }

  const index = segments[fromLength];
  const value = model._get(refList.fromSegments.concat(index));
  const toSegments = refList.toSegmentsByItem(value);

  // Mutation underneath a child of the `from` object.
  if (segmentsLength > fromLength + 1) {
    throw new Error('Mutation on descendant of refList `from`' +
      ' should have been dereferenced: ' + segments.join('.'));
  }

  // Otherwise, mutation of a child of the `from` object

  // If changing the item itself, it will also have to be re-set on the
  // original object
  if (type === 'change') {
    model._set(toSegments, value);
    updateIdForValue(model, refList, index, value);
    return;
  }
  if (type === 'insert' || type === 'remove' || type === 'move') {
    throw new Error('Array mutation on child of refList `from`' +
      'should have been dereferenced: ' + segments.join('.'));
  }
}

/**
 * @private
 * @param {Model} model
 * @param {RefList} refList
 * @param {Array} values
 */
function setNewToValues(model, refList, values) {
  const ids = [];
  for (let i = 0; i < values.length; i++) {
    const value = values[i];
    let id = refList.idByItem(value);
    if (id === undefined && typeof value === 'object') {
      id = value.id = model.id();
    }
    const toSegments = refList.toSegmentsByItem(value);
    if (id === undefined || toSegments === undefined) {
      throw new Error('Unable to add item to refList: ' + value);
    }
    if (model._get(toSegments) !== value) {
      model._set(toSegments, value);
    }
    ids.push(id);
  }
  return ids;
}
function updateIdForValue(model, refList, index, value) {
  const id = refList.idByItem(value);
  const outSegments = refList.idsSegments.concat(index);
  model._set(outSegments, id);
}

function patchToEvent(segments, event, refList) {
  const type = event.type;
  const toLength = refList.toSegments.length;
  const segmentsLength = segments.length;
  const model = refList.model.pass(event.passed, true);

  // Mutation on the `to` object itself
  if (segmentsLength === toLength) {
    if (type === 'insert') {
      const values = event.values;
      for (let i = 0; i < values.length; i++) {
        const value = values[i];
        const indices = refList.indicesByItem(value);
        if (!indices) continue;
        for (let j = 0; j < indices.length; j++) {
          const outSegments = refList.fromSegments.concat(indices[j]);
          model._set(outSegments, value);
        }
      }
      return;
    }

    if (type === 'remove') {
      const removeIndex = event.index as number;
      const values = event.values;
      const howMany = values.length;
      for (let i = removeIndex, len = removeIndex + howMany; i < len; i++) {
        const indices = refList.indicesByItem(values[i]);
        if (!indices) continue;
        for (let j = 0, indicesLen = indices.length; j < indicesLen; j++) {
          const outSegments = refList.fromSegments.concat(indices[j]);
          model._set(outSegments, undefined);
        }
      }
      return;
    }

    if (type === 'move') {
      // Moving items in the `to` object should have no effect on the output
      return;
    }
  }

  // Mutation on or above the `to` object
  if (segmentsLength <= toLength) {
    // If the entire `to` object is updated, we need to re-create the
    // entire refList output and apply what is different
    model._setArrayDiff(refList.fromSegments, refList.get());
    return;
  }

  // Mutation underneath a child of the `to` object. The item will already
  // be up to date, since it is under an object reference. Just re-emit
  if (segmentsLength > toLength + 1) {
    const value = model._get(segments.slice(0, toLength + 1));
    const indices = refList.indicesByItem(value);
    if (!indices) return;
    const remaining = segments.slice(toLength + 1);
    const eventClone = event.clone();
    eventClone.passed = model._pass;
    for (let i = 0; i < indices.length; i++) {
      const index = indices[i];
      let dereferenced = refList.fromSegments.concat(index, remaining);
      dereferenced = model._dereference(dereferenced, null, refList);
      model._emitMutation(dereferenced, eventClone);
    }
    return;
  }

  // Otherwise, mutation of a child of the `to` object

  // If changing the item itself, it will also have to be re-set on the
  // array created by the refList
  if (type === 'change' || type === 'load' || type === 'unload') {
    const value = event.value;
    const previous = event.previous;
    const newIndices = refList.indicesByItem(value);
    const oldIndices = refList.indicesByItem(previous);
    if (!newIndices && !oldIndices) return;
    if (oldIndices && !equivalentArrays(oldIndices, newIndices)) {
      // The changed item used to refer to some indices, but no longer does
      for (let i = 0; i < oldIndices.length; i++) {
        const outSegments = refList.fromSegments.concat(oldIndices[i]);
        model._set(outSegments, undefined);
      }
    }
    if (newIndices) {
      for (let i = 0; i < newIndices.length; i++) {
        const outSegments = refList.fromSegments.concat(newIndices[i]);
        model._set(outSegments, value);
      }
    }
    return;
  }

  const value = model._get(segments.slice(0, toLength + 1));
  const indices = refList.indicesByItem(value);
  if (!indices) return;

  if (type === 'insert' || type === 'remove' || type === 'move') {
    // Array mutations will have already been updated via an object
    // reference, so only re-emit
    const eventClone = event.clone();
    eventClone.passed = model._pass;
    for (let i = 0; i < indices.length; i++) {
      let dereferenced = refList.fromSegments.concat(indices[i]);
      dereferenced = model._dereference(dereferenced, null, refList);
      model._emitMutation(dereferenced, eventClone);
    }
  }
}
function equivalentArrays(a, b) {
  if (!a || !b) return false;
  if (a.length !== b.length) return false;
  for (let i = 0; i < a.length; i++) {
    if (a[i] !== b[i]) return false;
  }
  return true;
}

function patchIdsEvent(segments, event, refList) {
  const type = event.type;
  const idsLength = refList.idsSegments.length;
  const segmentsLength = segments.length;
  const model = refList.model.pass(event.passed, true);

  // An array mutation of the ids should be mirrored with a like change in
  // the output array
  if (segmentsLength === idsLength) {
    if (type === 'insert') {
      const inserted = event.values;
      const values = [];
      for (let i = 0; i < inserted.length; i++) {
        const value = refList.itemById(inserted[i]);
        values.push(value);
      }
      model._insert(refList.fromSegments, event.index, values);
      return;
    }

    if (type === 'remove') {
      const howMany = event.values.length;
      model._remove(refList.fromSegments, event.index, howMany);
      return;
    }

    if (type === 'move') {
      model._move(refList.fromSegments, event.from, event.to, event.howMany);
      return;
    }
  }

  // Mutation on the `ids` list itself
  if (segmentsLength <= idsLength) {
    // If the entire `ids` array is updated, we need to re-create the
    // entire refList output and apply what is different
    model._setArrayDiff(refList.fromSegments, refList.get());
    return;
  }

  // Otherwise, direct mutation of a child in the `ids` object or mutation
  // underneath an item in the `ids` list. Update the item for the appropriate
  // id if it has changed
  const index = segments[idsLength];
  const id = refList.idByIndex(index);
  const item = refList.itemById(id);
  const itemSegments = refList.fromSegments.concat(index);
  if (model._get(itemSegments) !== item) {
    model._set(itemSegments, item);
  }
}

Model.prototype.refList = function() {
  let from, to, ids, options;
  if (arguments.length === 2) {
    to = arguments[0];
    ids = arguments[1];
  } else if (arguments.length === 3) {
    if (this.isPath(arguments[2])) {
      from = arguments[0];
      to = arguments[1];
      ids = arguments[2];
    } else {
      to = arguments[0];
      ids = arguments[1];
      options = arguments[2];
    }
  } else {
    from = arguments[0];
    to = arguments[1];
    ids = arguments[2];
    options = arguments[3];
  }
  const fromPath = this.path(from);
  let toPath;
  if (Array.isArray(to)) {
    toPath = [];
    for (let i = 0; i < to.length; i++) {
      toPath.push(this.path(to[i]));
    }
  } else {
    toPath = this.path(to);
  }
  const idsPath = this.path(ids);
  const refList = new RefList(this.root, fromPath, toPath, idsPath, options);
  this.root._refLists.remove(refList.fromSegments);
  refList.model._setArrayDiff(refList.fromSegments, refList.get());
  this.root._refLists.add(refList);
  return this.scope(fromPath);
};

export class RefList{
  model: Model;
  from: any;
  to: any;
  ids: string[];
  fromSegments: any;
  toSegments: any;
  idsSegments: any;
  options?: RefListOptions;
  deleteRemoved: boolean;

  constructor(model: Model, from, to, ids, options?: RefListOptions) {
    this.model = model && model.pass({$refList: this});
    this.from = from;
    this.to = to;
    this.ids = ids;
    this.fromSegments = from && from.split('.');
    this.toSegments = to && to.split('.');
    this.idsSegments = ids && ids.split('.');
    this.options = options;
    this.deleteRemoved = options && options.deleteRemoved;
  }

  // The default implementation assumes that the ids array is a flat list of
  // keys on the to object. Ideally, this mapping could be customized via
  // inheriting from RefList and overriding these methods without having to
  // modify the above event handling code.
  //
  // In the default refList implementation, `key` and `id` are equal.
  //
  // Terms in the below methods:
  //   `item`  - Object on the `to` path, which gets mirrored on the `from` path
  //   `key`   - The property under `to` at which an item is located
  //   `id`    - String or object in the array at the `ids` path
  //   `index` - The index of an id, which corresponds to an index on `from`
  get() {
    const ids = this.model._get(this.idsSegments);
    if (!ids) return [];
    const items = this.model._get(this.toSegments);
    const out = [];
    for (let i = 0; i < ids.length; i++) {
      const key = ids[i];
      out.push(items && items[key]);
    }
    return out;
  };

  dereference(segments, i) {
    const remaining = segments.slice(i + 1);
    const key = this.idByIndex(remaining[0]);
    if (key == null) return [];
    remaining[0] = key;
    return this.toSegments.concat(remaining);
  };

  toSegmentsByItem(item) {
    const key = this.idByItem(item);
    if (key === undefined) return;
    return this.toSegments.concat(key);
  };

  idByItem(item) {
    if (item && item.id) return item.id;
    const items = this.model._get(this.toSegments);
    for (const key in items) {
      if (item === items[key]) return key;
    }
  };

  indicesByItem(item) {
    const id = this.idByItem(item);
    const ids = this.model._get(this.idsSegments);
    if (!ids) return;
    let indices;
    let index = -1;
    for (;;) {
      index = ids.indexOf(id, index + 1);
      if (index === -1) break;
      if (indices) {
        indices.push(index);
      } else {
        indices = [index];
      }
    }
    return indices;
  };

  itemById(id: string) {
    return this.model._get(this.toSegments.concat(id));
  };

  idByIndex(index: number) {
    return this.model._get(this.idsSegments.concat(index));
  };
}

export class RefLists{
  fromMap: EventMapTree;
  toListeners: EventListenerTree;
  idsListeners: EventListenerTree;

  constructor() {
    this.fromMap = new EventMapTree();
    this.toListeners = new EventListenerTree();
    this.idsListeners = new EventListenerTree();
  }

  add(refList) {
    this.fromMap.setListener(refList.fromSegments, refList);
    this.toListeners.addListener(refList.toSegments, refList);
    this.idsListeners.addListener(refList.idsSegments, refList);
  };
  
  remove(fromSegments) {
    const refList = this.fromMap.deleteListener(fromSegments);
    if (!refList) return;
    this.toListeners.removeListener(refList.toSegments, refList);
    this.idsListeners.removeListener(refList.idsSegments, refList);
  };
  
  removeAll(segments) {
    const node = this.fromMap.deleteAllListeners(segments);
    if (node) {
      node.forEach(node => this._removeInputListeners(node));
    }
  };
  
  toJSON() {
    const out = [];
    this.fromMap.forEach(function(refList) {
      out.push([refList.from, refList.to, refList.ids, refList.options]);
    });
    return out;
  };

  _removeInputListeners(refList) {
    this.toListeners.removeListener(refList.toSegments, refList);
    this.idsListeners.removeListener(refList.idsSegments, refList);
  };
}
