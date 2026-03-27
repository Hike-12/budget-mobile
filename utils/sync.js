import AsyncStorage from '@react-native-async-storage/async-storage';
import axios from 'axios';
import { API_URL } from '../constants/api';

function sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}

function makeIdempotencyKey(action, user, stableId, version = '') {
    return `${action}:${String(user || '').toLowerCase()}:${stableId}:${version}`;
}

async function withRetry(task, { retries = 3, baseDelay = 300 } = {}) {
    let lastError;
    for (let i = 0; i < retries; i++) {
        try {
            return await task();
        } catch (error) {
            lastError = error;
            if (i < retries - 1) {
                await sleep(baseDelay * (2 ** i));
            }
        }
    }
    throw lastError;
}

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
 * Syncs the local unsynced queue with the remote server.
 * Returns the fresh server budget list on success, or null on failure.
 *
 * @param {string} user - username
 * @returns {Promise<Array|null>} the latest server budgets, or null
 */
export async function syncWithServer(user) {
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

    const serverByClientId = new Set(
        serverList.filter(b => b.clientId).map(b => b.clientId)
    );
    const serverById = new Set(
        serverList.filter(b => b._id).map(b => String(b._id))
    );

    const failedQueue = [];

    for (const change of unsynced) {
        try {
            if (change.action === 'add') {
                const clientId = change.budget._id;
                if (!serverByClientId.has(clientId)) {
                    const payload = {
                        ...change.budget,
                        clientId,
                        user: normalizedUser,
                        updatedAt: change.budget.updatedAt || new Date().toISOString(),
                    };
                    await withRetry(() => axios.post(`${API_URL}/api/budgets`, payload, {
                        headers: {
                            'X-Idempotency-Key': makeIdempotencyKey('add', normalizedUser, clientId, payload.updatedAt),
                        },
                    }));
                    serverByClientId.add(clientId);
                }
            } else if (change.action === 'edit') {
                const clientId = change.budget._id;
                const payload = {
                    ...change.budget,
                    clientId,
                    user: normalizedUser,
                    id: clientId,
                    updatedAt: change.budget.updatedAt || new Date().toISOString(),
                };
                await withRetry(() => axios.patch(`${API_URL}/api/budgets`, payload, {
                    headers: {
                        'X-Idempotency-Key': makeIdempotencyKey('edit', normalizedUser, clientId, payload.updatedAt),
                    },
                }));
            } else if (change.action === 'delete') {
                const stableId = change.id;
                const existsOnServer = serverByClientId.has(stableId) || serverById.has(String(stableId));

                // Deleting a non-existent entity is already a successful end state.
                if (!existsOnServer) {
                    continue;
                }

                await withRetry(() => axios.delete(`${API_URL}/api/budgets`, {
                    data: { id: stableId, clientId: stableId, user: normalizedUser },
                    headers: {
                        'X-Idempotency-Key': makeIdempotencyKey('delete', normalizedUser, stableId),
                    },
                }));

                serverByClientId.delete(stableId);
                serverById.delete(String(stableId));
            }
        } catch (error) {
            // Conflict means server has a newer update; keep server truth and drop local edit.
            if (error?.response?.status === 409 && change.action === 'edit') {
                continue;
            }
            // DELETE is idempotent: missing record means it's already deleted.
            if (error?.response?.status === 404 && change.action === 'delete') {
                continue;
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
