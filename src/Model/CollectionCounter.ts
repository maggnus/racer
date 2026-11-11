export class CollectionCounter {
  collections: Record<string, CounterMap>;
  size: number;

  constructor() {
    this.reset();
  }

  reset() {
    // A map of CounterMaps
    this.collections = {};
    // The number of id keys in the collections map
    this.size = 0;
  };

  get(collectionName: string, id: string) {
    const collection = this.collections[collectionName];
    return (collection && collection.counts[id]) || 0;
  };

  increment(collectionName: string, id: string) {
    let collection = this.collections[collectionName];
    if (!collection) {
      collection = this.collections[collectionName] = new CounterMap();
      this.size++;
    }
    return collection.increment(id);
  };

  decrement(collectionName: string, id: string) {
    const collection = this.collections[collectionName];
    if (!collection) return 0;
    const count = collection.decrement(id);
    if (collection.size < 1) {
      delete this.collections[collectionName];
      this.size--;
    }
    return count;
  };

  toJSON() {
    // Serialize to the contained count data if any
    if (this.size > 0) {
      const out = {};
      for (const collectionName in this.collections) {
        out[collectionName] = this.collections[collectionName].counts;
      }
      return out;
    }
    return;
  };
}

export class CounterMap {
  counts: Record<string, number>;
  size: number;

  constructor() {
    this.counts = {};
    this.size = 0;
  }

  increment(key: string): number {
    const count = this.counts[key] || 0;
    if (count === 0) {
      this.size++;
    }
    return this.counts[key] = count + 1;
  };

  decrement(key: string): number {
    const count = this.counts[key] || 0;
    if (count > 1) {
      return this.counts[key] = count - 1;
    }
    if (count === 1) {
      delete this.counts[key];
      this.size--;
    }
    return 0;
  };
}
