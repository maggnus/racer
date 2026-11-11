# Unreleased

#### Changes from racer 2.3.1

- Requires Node.js 22 or newer. The code is compiled for ES2022 instead of ES5.
- `sharedb` is a peer dependency, supporting versions 4 to 7. ShareDB 1 to 3 are no longer supported.
- The `uuid` and `util` dependencies are gone. `model.id()` creates UUIDs with `crypto.getRandomValues`.
- `fast-deep-equal` is updated to version 3.
- `ModelCollections` is a dictionary of collections, as it was used. Its `docs` property declaration is gone.
- Tests run on Mocha 12 and Chai 6, and ESLint is configured with the flat config and typescript-eslint.

# v2.1.0 (Fri May 24 2024)

#### 🚀 Enhancement

- Add methods getOrDefault and getOrThrow [#307](https://github.com/derbyjs/racer/pull/307) ([@craigbeck](https://github.com/craigbeck))
- Add getValues method for fetching array of docs from collection [#306](https://github.com/derbyjs/racer/pull/306) ([@craigbeck](https://github.com/craigbeck))

#### 🐛 Bug Fix

- Resolve `addPromised` with new doc `id` [#305](https://github.com/derbyjs/racer/pull/305) ([@craigbeck](https://github.com/craigbeck))

#### ⚠️ Pushed to `master`

- Ignore .env file ([@craigbeck](https://github.com/craigbeck))

#### Authors: 1

- Craig Beck ([@craigbeck](https://github.com/craigbeck))

---

# v2.1.0 (Fri May 24 2024)

#### 🚀 Enhancement

- Add methods getOrDefault and getOrThrow [#307](https://github.com/derbyjs/racer/pull/307) ([@craigbeck](https://github.com/craigbeck))
- Add getValues method for fetching array of docs from collection [#306](https://github.com/derbyjs/racer/pull/306) ([@craigbeck](https://github.com/craigbeck))

#### 🐛 Bug Fix

- Resolve `addPromised` with new doc `id` [#305](https://github.com/derbyjs/racer/pull/305) ([@craigbeck](https://github.com/craigbeck))

#### Authors: 1

- Craig Beck ([@craigbeck](https://github.com/craigbeck))
