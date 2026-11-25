import assert from 'node:assert/strict';
import { registerHooks } from 'node:module';
import { test } from 'node:test';

const mocks = new Map([
    ['@react-native-async-storage/async-storage', 'export default globalThis.syncTest.storage'],
    ['axios', 'export default globalThis.syncTest.http'],
    ['../constants/api', 'export const API_URL = "https://budget.test"'],
    ['./transactionRules', 'export const accountHeaders = async () => ({ Authorization: "Bearer test" })'],
    ['./smsParser', 'export * from ' + JSON.stringify(new URL('../utils/smsParser.js', import.meta.url).href)],
]);
const hooks = registerHooks({
    resolve(specifier, context, nextResolve) {
        if (mocks.has(specifier)) {
            return { url: 'data:text/javascript,' + encodeURIComponent(mocks.get(specifier)), shortCircuit: true };
        }
        return nextResolve(specifier, context);
    },
});

const storage = new Map();
const http = {};
globalThis.syncTest = {
    storage: {
        getItem: async key => storage.get(key),
        setItem: async (key, value) => storage.set(key, value),
    },
    http,
};
const { addToUnsyncedQueue, syncWithServer } = await import('../utils/sync.js');
hooks.deregister();
delete globalThis.syncTest;

test('a delete queued during a refresh survives and runs on the next sync', async () => {
    const entry = { _id: '111111111111111111111111', source: 'quick' };
    const started = Promise.withResolvers();
    const finishRefresh = Promise.withResolvers();
    http.get = () => {
        started.resolve();
        return finishRefresh.promise;
    };
    const refreshing = syncWithServer('tester');
    await started.promise;
    const queued = addToUnsyncedQueue({ action: 'delete', id: entry._id });
    finishRefresh.resolve({ data: [entry] });
    await refreshing;
    await queued;

    http.delete = async (url, { data }) => {
        assert.equal(data.id, entry._id);
        http.get = async () => { throw new Error('Refresh failed'); };
    };
    assert.deepEqual(await syncWithServer('tester'), []);
    assert.deepEqual(JSON.parse(storage.get('budgets')), []);
    assert.deepEqual(JSON.parse(storage.get('unsynced')), []);
});

test('a recurring entry stays hidden locally until its delete syncs', async () => {
    const entry = { _id: '222222222222222222222222', source: 'recurring' };
    let serverList = [entry];
    http.get = async () => ({ data: serverList });
    http.delete = async () => { throw new Error('Connection lost'); };
    await addToUnsyncedQueue({ action: 'delete', id: entry._id });
    assert.deepEqual(await syncWithServer('tester'), []);
    assert.equal(JSON.parse(storage.get('unsynced')).length, 1);

    http.delete = async () => { serverList = []; };
    assert.deepEqual(await syncWithServer('tester'), []);
    assert.deepEqual(JSON.parse(storage.get('unsynced')), []);
    assert.deepEqual(await syncWithServer('tester'), []);
});
