/**
 * Contexts are useful for keeping track of the origin of subscribes.
 */

import { Model } from './Model';
import { CollectionCounter } from './CollectionCounter';

declare module './Model' {
  interface Model<T> {
    /**
     * Creates a new child model with a specific named data-loading context. The
     * child model has the same scoped path as this model.
     *
     * Contexts are used to track counts of fetches and subscribes, so that all
     * data relating to a context can be unloaded all at once, without having to
     * manually track loaded data.
     *
     * Contexts are in a global namespace for each root model, so calling
     * `model.context(contextId)` from two different places will return child
     * models that both refer to the same context.
     *
     * @param contextId - context id
     *
     * @see https://derbyjs.github.io/derby/models/contexts
     */
    context(contextId: string): ChildModel<T>;
    /**
     * Get the named context or create a new named context if it doesnt exist.
     * 
     * @param contextId context id
     * 
     * @see https://derbyjs.github.io/derby/models/contexts
     */
    getOrCreateContext(contextId: string): Context;
    /**
     * Set the named context to use for this model.
     * 
     * @param contextId context id
     * 
     * @see https://derbyjs.github.io/derby/models/contexts
     */
    setContext(contextId: string): void;
    
    /**
     * Unloads data for this model's context, or for a specific named context.
     *
     * @param contextId - optional context to unload; defaults to this model's context
     *
     * @see https://derbyjs.github.io/derby/models/contexts
     */
    unload(contextId?: string): void;

    /**
     * Unloads data for all model contexts.
     *
     * @see https://derbyjs.github.io/derby/models/contexts
     */
    unloadAll(): void;

    _contexts: Contexts;
  }
}

Model.INITS.push(function(model) {
  model.root._contexts = new Contexts();
  model.root.setContext('root');
});

Model.prototype.context = function(contextId) {
  const model = this._child();
  model.setContext(contextId);
  return model;
};

Model.prototype.setContext = function(contextId) {
  this._context = this.getOrCreateContext(contextId);
};

Model.prototype.getOrCreateContext = function(contextId) {
  const context = this.root._contexts[contextId] ||
    (this.root._contexts[contextId] = new Context(this, contextId));
  return context;
};

Model.prototype.unload = function(contextId) {
  const context = (contextId) ? this.root._contexts[contextId] : this._context;
  if (context) context.unload();
};

Model.prototype.unloadAll = function() {
  const contexts = this.root._contexts;
  for (const key in contexts) {
    const currentContext = contexts[key];
    if (Object.hasOwn(contexts, key)) {
      currentContext.unload();
    }
  }
};

export class Contexts {
  toJSON() {
    const out: Record<string, any> = {};
    const contexts = this;
    for (const key in contexts) {
      const currentContext = contexts[key];
      if (currentContext instanceof Context) {
        out[key] = currentContext.toJSON();
      }
    }
    return out;
  };
}

class FetchedQueries { }
class SubscribedQueries { }

export class Context {
  model: Model;
  id: string;
  fetchedDocs: CollectionCounter;
  subscribedDocs: CollectionCounter;
  createdDocs: CollectionCounter;
  fetchedQueries: FetchedQueries;
  subscribedQueries: SubscribedQueries;

  constructor(model: Model, id: string) {
    this.model = model;
    this.id = id;
    this.fetchedDocs = new CollectionCounter();
    this.subscribedDocs = new CollectionCounter();
    this.createdDocs = new CollectionCounter();
    this.fetchedQueries = new FetchedQueries();
    this.subscribedQueries = new SubscribedQueries();
  }

  toJSON() {
    const fetchedDocs = this.fetchedDocs.toJSON();
    const subscribedDocs = this.subscribedDocs.toJSON();
    const createdDocs = this.createdDocs.toJSON();
    if (!fetchedDocs && !subscribedDocs && !createdDocs) return;
    return {
      fetchedDocs: fetchedDocs,
      subscribedDocs: subscribedDocs,
      createdDocs: createdDocs
    };
  };

  fetchDoc(collectionName, id) {
    this.fetchedDocs.increment(collectionName, id);
  };
  subscribeDoc(collectionName, id) {
    this.subscribedDocs.increment(collectionName, id);
  };
  unfetchDoc(collectionName, id) {
    this.fetchedDocs.decrement(collectionName, id);
  };
  unsubscribeDoc(collectionName, id) {
    this.subscribedDocs.decrement(collectionName, id);
  };
  createDoc(collectionName, id) {
    this.createdDocs.increment(collectionName, id);
  };
  fetchQuery(query) {
    mapIncrement(this.fetchedQueries, query.hash);
  };
  subscribeQuery(query) {
    mapIncrement(this.subscribedQueries, query.hash);
  };
  unfetchQuery(query) {
    mapDecrement(this.fetchedQueries, query.hash);
  };
  unsubscribeQuery(query) {
    mapDecrement(this.subscribedQueries, query.hash);
  };

  unload() {
    const model = this.model;
    for (const hash in this.fetchedQueries) {
      const query = model.root._queries.map[hash];
      if (!query) continue;
      let count = this.fetchedQueries[hash];
      while (count--) query.unfetch();
    }
    for (const hash in this.subscribedQueries) {
      const query = model.root._queries.map[hash];
      if (!query) continue;
      let count = this.subscribedQueries[hash];
      while (count--) query.unsubscribe();
    }
    for (const collectionName in this.fetchedDocs.collections) {
      const collection = this.fetchedDocs.collections[collectionName];
      for (const id in collection.counts) {
        let count = collection.counts[id];
        while (count--) model.unfetchDoc(collectionName, id);
      }
    }
    for (const collectionName in this.subscribedDocs.collections) {
      const collection = this.subscribedDocs.collections[collectionName];
      for (const id in collection.counts) {
        let count = collection.counts[id];
        while (count--) model.unsubscribeDoc(collectionName, id);
      }
    }
    for (const collectionName in this.createdDocs.collections) {
      const collection = this.createdDocs.collections[collectionName];
      for (const id in collection.counts) {
        model._maybeUnloadDoc(collectionName, id);
      }
    }
    this.createdDocs.reset();
  };
}
function mapIncrement(map, key) {
  map[key] = (map[key] || 0) + 1;
}
function mapDecrement(map, key) {
  if (map[key]) map[key]--;
  if (!map[key]) delete map[key];
}
