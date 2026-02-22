import AsyncStorage from '@react-native-async-storage/async-storage';
import axios from 'axios';
import { API_URL } from '../constants/api';

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

    const raw = await AsyncStorage.getItem('unsynced');
    let unsynced = raw ? JSON.parse(raw) : [];
    unsynced = dedupeQueue(unsynced);

    // Fetch current server state once — reused for dedup AND as the final truth
    let serverList;
    try {
        serverList = (await axios.get(`${API_URL}/api/budgets?user=${user}`)).data || [];
    } catch {
        return null; // network issue — bail without losing queue
    }

    const serverByClientId = new Set(
        serverList.filter(b => b.clientId).map(b => b.clientId)
    );

    const failedQueue = [];

    for (const change of unsynced) {
        try {
            if (change.action === 'add') {
                const clientId = change.budget._id;
                if (!serverByClientId.has(clientId)) {
                    await axios.post(`${API_URL}/api/budgets`, { ...change.budget, clientId, user });
                    serverByClientId.add(clientId);
                }
            } else if (change.action === 'edit') {
                const clientId = change.budget._id;
                await axios.patch(`${API_URL}/api/budgets`, {
                    ...change.budget,
                    clientId,
                    user,
                    id: clientId,
                });
            } else if (change.action === 'delete') {
                await axios.delete(`${API_URL}/api/budgets`, {
                    data: { id: change.id, clientId: change.id, user },
                });
            }
        } catch {
            failedQueue.push(change);
        }
    }

    await AsyncStorage.setItem('unsynced', JSON.stringify(failedQueue));

    // Only re-fetch if mutations were attempted so we get the true final state
    if (unsynced.length > 0) {
        try {
            serverList = (await axios.get(`${API_URL}/api/budgets?user=${user}`)).data || [];
        } catch {
            // Keep the list from the earlier fetch
        }
    }

    await AsyncStorage.setItem('budgets', JSON.stringify(serverList));
    return serverList;
}
