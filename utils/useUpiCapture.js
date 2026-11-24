import AsyncStorage from '@react-native-async-storage/async-storage';
import { useCallback, useEffect, useRef, useState } from 'react';
import { AppState } from 'react-native';
import { fetchPendingBudgets, flushUpiAlerts, stageUpiAlerts } from './sync';
import { requestCaptureSms, requestInboxAccess, upiNative } from './upiNative';

export function useUpiCapture(user) {
    const [enabled, setEnabled] = useState(false);
    const [items, setItems] = useState([]);
    const [notificationAccess, setNotificationAccess] = useState(false);
    const [message, setMessage] = useState('');
    const activeRefresh = useRef(null);
    const settingKey = 'upi-auto-capture:' + user;

    useEffect(() => {
        if (!user) return;
        let cancelled = false;
        AsyncStorage.getItem(settingKey).then(value => {
            if (cancelled) return;
            setEnabled(value === 'true' && !!upiNative);
            upiNative?.setCaptureOwner(value === 'true' ? user : null);
        }).catch(() => setMessage('Could not load capture settings.'));
        return () => { cancelled = true; };
    }, [settingKey, user]);

    const refresh = useCallback(() => {
        if (!user) return Promise.resolve();
        if (activeRefresh.current?.user === user) return activeRefresh.current.promise;
        const promise = (async () => {
            if (upiNative) {
                const alerts = await upiNative.pendingAlerts(user);
                if (alerts.length) {
                    await stageUpiAlerts(user, alerts);
                    await upiNative.acknowledge(user, alerts.map(alert => alert.id));
                }
                setNotificationAccess(upiNative.hasNotificationAccess());
            }
            await flushUpiAlerts(user).catch(() => {});
            setItems(await fetchPendingBudgets(user));
        })().finally(() => {
            if (activeRefresh.current?.promise === promise) activeRefresh.current = null;
        });
        activeRefresh.current = { user, promise };
        return promise;
    }, [user]);

    useEffect(() => {
        if (!user) return;
        const check = () => refresh().catch(() => {});
        check();
        const subscription = AppState.addEventListener('change', state => {
            if (state === 'active') check();
        });
        const timer = setInterval(() => {
            if (AppState.currentState === 'active') check();
        }, enabled ? 8000 : 30000);
        return () => { subscription.remove(); clearInterval(timer); };
    }, [enabled, refresh, user]);

    async function setAutoCapture(next) {
        if (!user || !upiNative) {
            setMessage('Automatic capture needs the native Android build. You can paste a receipt here.');
            return;
        }
        try {
            const smsGranted = next ? await requestCaptureSms() : false;
            await AsyncStorage.setItem(settingKey, String(next));
            upiNative.setCaptureOwner(next ? user : null);
            setEnabled(next);
            setMessage(next && !smsGranted
                ? 'SMS access was denied. You can enable GPay notification access separately or paste a receipt.'
                : '');
        } catch {
            setMessage('Could not change automatic capture.');
        }
    }

    async function queue(alerts) {
        const added = await stageUpiAlerts(user, alerts);
        try {
            await flushUpiAlerts(user);
            setItems(await fetchPendingBudgets(user));
            return { added, offline: false };
        } catch {
            return { added, offline: true };
        }
    }

    async function scan() {
        if (!upiNative) return setMessage('Inbox scanning needs the native Android build. You can paste a receipt here.');
        try {
            if (!await requestInboxAccess()) return setMessage('Allow SMS access to scan your inbox.');
            const { added, offline } = await queue(await upiNative.scanRecentSms());
            setMessage(added ? (offline ? 'New alerts saved on this device. They will sync when you reconnect.' : added + ' new alerts added for review.') : 'No new UPI alerts found.');
        } catch {
            setMessage('Could not scan recent SMS. You can paste a receipt instead.');
        }
    }

    return { enabled, items, notificationAccess, message, refresh, setAutoCapture, scan, queue, setItems };
}
