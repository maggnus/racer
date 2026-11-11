import { Model } from './Model';

declare module './Model' {
  interface Model {
    unbundle: (data: any) => void;
  }
}

Model.prototype.unbundle = function(data) {
  if (this.connection) this.connection.startBulk();

  // Re-create and subscribe queries; re-create documents associated with queries
  this._initQueries(data.queries);

  // Re-create other documents
  for (const collectionName in data.collections) {
    const collection = data.collections[collectionName];
    for (const id in collection) {
      this.getOrCreateDoc(collectionName, id, collection[id]);
    }
  }

  for (const contextId in data.contexts) {
    const contextData = data.contexts[contextId];
    const contextModel = this.context(contextId);
    // Re-init fetchedDocs counts
    for (const collectionName in contextData.fetchedDocs) {
      const collection = contextData.fetchedDocs[collectionName];
      for (const id in collection) {
        let count = collection[id];
        while (count--) {
          contextModel._context.fetchDoc(collectionName, id);
          this._fetchedDocs.increment(collectionName, id);
        }
      }
    }
    // Subscribe to document subscriptions
    for (const collectionName in contextData.subscribedDocs) {
      const collection = contextData.subscribedDocs[collectionName];
      for (const id in collection) {
        let count = collection[id];
        while (count--) {
          contextModel.subscribeDoc(collectionName, id);
        }
      }
    }
    // Re-init createdDocs counts
    for (const collectionName in contextData.createdDocs) {
      const collection = contextData.createdDocs[collectionName];
      for (const id in collection) {
        // Count value doesn't matter for tracking creates
        contextModel._context.createDoc(collectionName, id);
      }
    }
  }

  if (this.connection) this.connection.endBulk();

  // Re-create refs
  for (let i = 0; i < data.refs.length; i++) {
    const item = data.refs[i];
    this.ref(item[0], item[1]);
  }
  // Re-create refLists
  for (let i = 0; i < data.refLists.length; i++) {
    const item = data.refLists[i];
    this.refList(item[0], item[1], item[2], item[3]);
  }
  // Re-create fns
  for (let i = 0; i < data.fns.length; i++) {
    const item = data.fns[i];
    this.start(...item);
  }
  // Re-create filters
  for (let i = 0; i < data.filters.length; i++) {
    const item = data.filters[i];
    const filter = this._filters.add(item[1], item[2], item[3], item[4], item[5]);
    filter.ref(item[0]);
  }
};
