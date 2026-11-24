import AsyncStorage from '@react-native-async-storage/async-storage';
import axios from 'axios';
import { API_URL } from '../constants/api';
import { captureKey, merchantKey, parseUpiAlert } from './smsParser';

/**
 * Adds a change to the unsynced queue, deduplicating by action+id.
 * @param {{ action: 'add'|'edit'|'delete', budget?: object, id?: string }} change
 */
export async function addToUnsyncedQueue(change) {
    const raw = await AsyncStorage.getItem('unsynced');
    const unsynced = raw ? JSON.parse(raw) : [];

    const changeKey = change.action === 'delete' ? change.id : change.budget?._id;
    const exists = unsynced.some(item => {
        const itemKey = item.action === 'delete' ? item.id : item.budget?._id;
        return item.action === change.action && itemKey === changeKey;
    });

    if (!exists) {
        unsynced.push(change);
        await AsyncStorage.setItem('unsynced', JSON.stringify(unsynced));
    }
}

/**
 * Deduplicates the unsynced queue so only the latest action per entity key survives.
 * @param {Array} queue - raw unsynced queue
 * @returns {Array} deduped queue (preserves original order)
 */
function dedupeQueue(queue) {
    const map = new Map();
    // Walk backwards so the latest entry wins
    for (let i = queue.length - 1; i >= 0; i--) {
        const c = queue[i];
        const key = c.action === 'delete' ? c.id : c.budget?._id;
        if (key && !map.has(key)) map.set(key, c);
    }
    return Array.from(map.values()).reverse();
}

/**
 * Module-level sync lock.  Prevents concurrent invocations of syncWithServer
 * from any caller (NetInfo listener, add-transaction, pull-to-refresh, etc.).
 * If a second call arrives while one is running, it awaits the in-flight one.
 */
let _syncPromise = null;

/**
 * Syncs the local unsynced queue with the remote server.
 * Returns the fresh server budget list on success, or null on failure.
 *
 * @param {string} user - username
 * @returns {Promise<Array|null>} the latest server budgets, or null
 */
export async function syncWithServer(user) {
    // If a sync is already in progress, piggyback onto it
    if (_syncPromise) return _syncPromise;
    _syncPromise = _syncWithServerInner(user);
    try {
        return await _syncPromise;
    } finally {
        _syncPromise = null;
    }
}

async function _syncWithServerInner(user) {
    if (!user) user = await AsyncStorage.getItem('username');
    if (!user) return null;

    const normalizedUser = String(user).toLowerCase().trim();

    const raw = await AsyncStorage.getItem('unsynced');
    let unsynced = raw ? JSON.parse(raw) : [];
    unsynced = dedupeQueue(unsynced);

    // Fetch current server state once — reused for dedup AND as the final truth
    let serverList;
    try {
        serverList = (await axios.get(`${API_URL}/api/budgets?user=${normalizedUser}`)).data || [];
    } catch {
        return null; // network issue — bail without losing queue
    }

    // Map from clientId → full server doc
    const serverByClientId = new Map(
        serverList.filter(b => b.clientId).map(b => [b.clientId, b])
    );
    // Map from _id → full server doc (for lookups by MongoDB _id)
    const serverById = new Map(
        serverList.filter(b => b._id).map(b => [String(b._id), b])
    );

    const failedQueue = [];
    const isConnectivityDrop = (error) => {
        return (
            error?.code === 'ERR_NETWORK' ||
            error?.code === 'ECONNABORTED' ||
            !error?.response
        );
    };

    for (let i = 0; i < unsynced.length; i++) {
        const change = unsynced[i];
        const clientId = change.action === 'delete' ? change.id : change.budget?._id;

        try {
            if (change.action === 'add') {
                if (!serverByClientId.has(clientId)) {
                    await axios.post(`${API_URL}/api/budgets`, {
                        ...change.budget,
                        clientId,
                        user: normalizedUser,
                        updatedAt: change.budget.updatedAt || new Date().toISOString(),
                    });
                    // Optimistically mark as synced so a subsequent edit in same cycle can find it.
                    // We don't have the server's _id yet, so edit will be skipped until next full sync.
                    serverByClientId.set(clientId, null);
                }
            } else if (change.action === 'edit') {
                let serverDoc = serverByClientId.get(clientId);
                if (!serverDoc && String(clientId).match(/^[0-9a-f]{24}$/i)) {
                    serverDoc = serverById.get(String(clientId));
                }
                if (serverDoc) {
                    await axios.patch(`${API_URL}/api/budgets`, {
                        ...change.budget,
                        id: serverDoc._id,
                        user: normalizedUser,
                        updatedAt: change.budget.updatedAt || new Date().toISOString(),
                    });
                }
            } else if (change.action === 'delete') {
                const stableId = change.id;
                const existsOnServer = serverByClientId.has(stableId) || serverById.has(String(stableId));

                // Deleting a non-existent entity is already a successful end state.
                if (!existsOnServer) {
                    continue;
                }

                await axios.delete(`${API_URL}/api/budgets`, {
                    data: { id: stableId, clientId: stableId, user: normalizedUser },
                });

                serverByClientId.delete(stableId);
                serverById.delete(String(stableId));
            }
        } catch (error) {
            // DELETE is idempotent: missing record means it's already deleted.
            if (error?.response?.status === 404 && change.action === 'delete') {
                continue;
            }
            if (isConnectivityDrop(error)) {
                failedQueue.push(change, ...unsynced.slice(i + 1));
                break;
            }
            failedQueue.push(change);
        }
    }

    await AsyncStorage.setItem('unsynced', JSON.stringify(failedQueue));

    // Only re-fetch if mutations were attempted so we get the true final state
    if (unsynced.length > 0) {
        try {
            serverList = (await axios.get(`${API_URL}/api/budgets?user=${normalizedUser}`)).data || [];
        } catch {
            // Keep the list from the earlier fetch
        }
    }

    await AsyncStorage.setItem('budgets', JSON.stringify(serverList));
    return serverList;
}

const captureStorageKey = (user) => 'upi-capture:' + user;
let captureWork = Promise.resolve();

function serializeCapture(work) {
    const result = captureWork.then(work);
    captureWork = result.catch(() => {});
    return result;
}

async function readCapture(user) {
    const raw = await AsyncStorage.getItem(captureStorageKey(user));
    return raw ? JSON.parse(raw) : { processed: {}, outbox: {}, categories: {} };
}

async function writeCapture(user, state) {
    await AsyncStorage.setItem(captureStorageKey(user), JSON.stringify(state));
}

export function stageUpiAlerts(user, alerts) {
    return serializeCapture(async () => {
        const state = await readCapture(user);
        let added = 0;
        for (const alert of alerts) {
            const item = parseUpiAlert(alert.body, alert.timestamp, state.categories);
            if (!item) continue;
            const key = captureKey(item, alert);
            if (Object.hasOwn(state.processed, key)) continue;
            state.processed[key] = 'queued';
            state.outbox[key] = { ...item, clientId: 'upi-' + key };
            added++;
        }
        if (added) await writeCapture(user, state);
        return added;
    });
}

export function flushUpiAlerts(user) {
    return serializeCapture(async () => {
        const state = await readCapture(user);
        for (const [key, item] of Object.entries(state.outbox)) {
            await axios.post(API_URL + '/api/budgets', {
                ...item,
                user,
                status: 'pending',
                source: 'sms_auto',
                updatedAt: new Date().toISOString(),
            }, { timeout: 8000 });
            delete state.outbox[key];
            state.processed[key] = 'submitted';
            await writeCapture(user, state);
        }
    });
}

export async function fetchPendingBudgets(user) {
    const { data } = await axios.get(API_URL + '/api/budgets', {
        params: { user, status: 'pending' },
        timeout: 8000,
    });
    return data.filter(item => item.status === 'pending');
}

export function reviewPendingBudget(user, item, edit) {
    return serializeCapture(async () => {
        const url = API_URL + '/api/budgets';
        const target = { user, id: item._id };
        const state = await readCapture(user);
        if (edit) {
            await axios.patch(url, { ...target, ...edit, status: 'verified' });
            state.categories[merchantKey(item.title)] = edit.category;
            state.categories[merchantKey(edit.title)] = edit.category;
        } else {
            await axios.delete(url, { data: { ...target, pendingOnly: true } });
        }
        const key = item.upiRefId || item.clientId?.replace(/^upi-/, '');
        if (key) {
            state.processed[key] = edit ? 'verified' : 'ignored';
            delete state.outbox[key];
        }
        await writeCapture(user, state);
    });
}
