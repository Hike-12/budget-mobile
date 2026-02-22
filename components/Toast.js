import { Ionicons } from '@expo/vector-icons';
import React, { useCallback, useEffect, useRef } from 'react';
import { Animated, Platform, StatusBar, StyleSheet, Text } from 'react-native';
import Colors from '../constants/colors';

// --- Types & styling map ---
const VARIANTS = {
    success: { bg: Colors.green, icon: 'checkmark-circle-outline' },
    error: { bg: Colors.red, icon: 'close-circle-outline' },
    info: { bg: Colors.primary, icon: 'information-circle-outline' },
    warning: { bg: '#F59E0B', icon: 'warning-outline' },
};

// --- Singleton ref so Toast.show() works from anywhere ---
let _ref = null;

export function setToastRef(ref) {
    _ref = ref;
}

export const Toast = {
    show({ message, type = 'info', duration = 2800 }) {
        _ref?.show({ message, type, duration });
    },
};

// --- The actual component you mount once at the root ---
export const ToastView = React.forwardRef(function ToastView(_, ref) {
    const translateY = useRef(new Animated.Value(-80)).current;
    const opacity = useRef(new Animated.Value(0)).current;
    const [state, setState] = React.useState(null);
    const timerRef = useRef(null);

    const dismiss = useCallback(() => {
        Animated.parallel([
            Animated.timing(translateY, { toValue: -80, duration: 220, useNativeDriver: true }),
            Animated.timing(opacity, { toValue: 0, duration: 220, useNativeDriver: true }),
        ]).start(() => setState(null));
    }, [translateY, opacity]);

    React.useImperativeHandle(ref, () => ({
        show({ message, type, duration }) {
            if (timerRef.current) clearTimeout(timerRef.current);
            setState({ message, type });
            Animated.parallel([
                Animated.timing(translateY, { toValue: 0, duration: 300, useNativeDriver: true }),
                Animated.timing(opacity, { toValue: 1, duration: 300, useNativeDriver: true }),
            ]).start();
            timerRef.current = setTimeout(dismiss, duration);
        },
    }));

    useEffect(() => () => { if (timerRef.current) clearTimeout(timerRef.current); }, []);

    if (!state) return null;

    const variant = VARIANTS[state.type] || VARIANTS.info;

    return (
        <Animated.View
            style={[
                styles.container,
                { backgroundColor: variant.bg, transform: [{ translateY }], opacity },
            ]}
            pointerEvents="none"
        >
            <Ionicons name={variant.icon} size={18} color="#fff" />
            <Text style={styles.message}>{state.message}</Text>
        </Animated.View>
    );
});

const TOP_OFFSET = Platform.OS === 'ios' ? 60 : (StatusBar.currentHeight || 24) + 16;

const styles = StyleSheet.create({
    container: {
        position: 'absolute',
        top: TOP_OFFSET,
        left: 16,
        right: 16,
        zIndex: 9999,
        flexDirection: 'row',
        alignItems: 'center',
        paddingVertical: 12,
        paddingHorizontal: 16,
        borderRadius: 12,
        gap: 10,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.25,
        shadowRadius: 8,
        elevation: 12,
    },
    icon: {
        color: '#fff',
        fontSize: 13,
        fontWeight: '600',
    },
    message: {
        color: '#fff',
        fontSize: 13,
        fontWeight: '500',
        flex: 1,
    },
});
