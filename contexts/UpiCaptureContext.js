import AsyncStorage from '@react-native-async-storage/async-storage';
import { usePathname } from 'expo-router';
import { createContext, useContext, useEffect, useState } from 'react';
import { useUpiCapture } from '../utils/useUpiCapture';

const CaptureContext = createContext(null);
const signedInRoutes = new Set(['/dashboard', '/settings', '/add-transaction', '/quick-transactions', '/recurring-transactions']);

export function UpiCaptureProvider({ children }) {
  const signedInRoute = signedInRoutes.has(usePathname());
  const [user, setUser] = useState(null);

  useEffect(() => {
    if (!signedInRoute) {
      setUser(null);
      return;
    }
    let active = true;
    AsyncStorage.getItem('username').then(value => {
      if (active) setUser(value || null);
    }).catch(() => {});
    return () => { active = false; };
  }, [signedInRoute]);

  const capture = useUpiCapture(signedInRoute ? user : null);
  return (
    <CaptureContext.Provider value={{ user: signedInRoute ? user : null, capture }}>
      {children}
    </CaptureContext.Provider>
  );
}

export function useCaptureSession() {
  return useContext(CaptureContext);
}
