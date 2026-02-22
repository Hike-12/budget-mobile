import AsyncStorage from '@react-native-async-storage/async-storage';
import { createContext, useCallback, useContext, useState } from 'react';

const PrivacyContext = createContext({
    privacyMode: true,
    togglePrivacy: () => { },
    setPrivacyMode: () => { },
});

const STORAGE_KEY = 'privacyMode';

export function PrivacyProvider({ children }) {
    // Private by default
    const [privacyMode, setPrivacyMode] = useState(true);

    const togglePrivacy = useCallback(() => {
        setPrivacyMode(prev => {
            const next = !prev;
            AsyncStorage.setItem(STORAGE_KEY, String(next));
            return next;
        });
    }, []);

    const updatePrivacy = useCallback((val) => {
        setPrivacyMode(val);
        AsyncStorage.setItem(STORAGE_KEY, String(val));
    }, []);

    return (
        <PrivacyContext.Provider value={{ privacyMode, togglePrivacy, setPrivacyMode: updatePrivacy }}>
            {children}
        </PrivacyContext.Provider>
    );
}

export function usePrivacy() {
    return useContext(PrivacyContext);
}
