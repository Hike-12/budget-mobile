import AsyncStorage from '@react-native-async-storage/async-storage';
import { createContext, useCallback, useContext, useEffect, useState } from 'react';

const PrivacyContext = createContext({
    privacyMode: true,
    togglePrivacy: () => { },
});

const STORAGE_KEY = 'privacyMode';

export function PrivacyProvider({ children }) {
    // ON by default
    const [privacyMode, setPrivacyMode] = useState(true);

    // Load saved preference on mount
    useEffect(() => {
        AsyncStorage.getItem(STORAGE_KEY).then(val => {
            if (val !== null) setPrivacyMode(val === 'true');
        });
    }, []);

    const togglePrivacy = useCallback(() => {
        setPrivacyMode(prev => {
            const next = !prev;
            AsyncStorage.setItem(STORAGE_KEY, String(next));
            return next;
        });
    }, []);

    return (
        <PrivacyContext.Provider value={{ privacyMode, togglePrivacy }}>
            {children}
        </PrivacyContext.Provider>
    );
}

export function usePrivacy() {
    return useContext(PrivacyContext);
}
