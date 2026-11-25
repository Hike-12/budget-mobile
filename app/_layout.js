import { Stack } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { useEffect, useRef } from "react";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import { ToastView, setToastRef } from "../components/Toast";
import Colors from "../constants/colors";
import { PrivacyProvider } from "../contexts/PrivacyContext";
import { UpiCaptureProvider } from "../contexts/UpiCaptureContext";

export default function Layout() {
  const toastRef = useRef(null);

  useEffect(() => {
    setToastRef(toastRef.current);
  }, []);

  return (
    <PrivacyProvider>
      <GestureHandlerRootView style={{ flex: 1 }}>
        <StatusBar style="light" />
        <UpiCaptureProvider>
          <Stack
            screenOptions={{
              headerStyle: { backgroundColor: Colors.dark },
              headerTintColor: Colors.accent,
              headerTitleStyle: { fontWeight: '600' },
              headerTitleAlign: 'center',
              headerShadowVisible: false,
              navigationBarHidden: true,
              contentStyle: { backgroundColor: Colors.dark },
              animation: 'slide_from_right',
            }}
          />
        </UpiCaptureProvider>
        <ToastView ref={toastRef} />
      </GestureHandlerRootView>
    </PrivacyProvider>
  );
}
