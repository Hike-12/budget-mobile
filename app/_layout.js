import { Stack } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { useEffect, useRef } from "react";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import { ToastView, setToastRef } from "../components/Toast";
import Colors from "../constants/colors";

export default function Layout() {
  const toastRef = useRef(null);

  useEffect(() => {
    setToastRef(toastRef.current);
  }, []);

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <StatusBar style="light" />
      <Stack
        screenOptions={{
          headerStyle: { backgroundColor: Colors.dark },
          headerTintColor: Colors.accent,
          headerTitleStyle: { fontWeight: '600' },
          headerTitleAlign: 'center',
          headerShadowVisible: false,
          contentStyle: { backgroundColor: Colors.dark },
          animation: 'slide_from_right',
        }}
      />
      <ToastView ref={toastRef} />
    </GestureHandlerRootView>
  );
}