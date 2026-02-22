import { Ionicons } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import NetInfo from '@react-native-community/netinfo';
import axios from 'axios';
import { Stack, useRouter } from 'expo-router';
import { useCallback, useState } from 'react';
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { Toast } from '../components/Toast';
import { API_URL } from '../constants/api';
import Colors from '../constants/colors';

export default function LoginScreen() {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const router = useRouter();

  const handleLogin = useCallback(async () => {
    if (!username.trim() || !password.trim()) {
      Toast.show({ message: 'Please enter both username and password.', type: 'warning' });
      return;
    }

    setLoading(true);
    try {
      const netState = await NetInfo.fetch();

      if (netState.isConnected) {
        const res = await axios.post(`${API_URL}/api/login`, { username, password });

        if (res.data.success) {
          await AsyncStorage.setItem('username', username);
          await AsyncStorage.setItem('password', password);
          const budgetsRes = await axios.get(`${API_URL}/api/budgets?user=${username}`);
          await AsyncStorage.setItem('budgets', JSON.stringify(budgetsRes.data));
          Toast.show({ message: 'Welcome back!', type: 'success' });
          router.replace('/dashboard');
        } else {
          Toast.show({ message: 'Invalid username or password.', type: 'error' });
        }
      } else {
        const savedUsername = await AsyncStorage.getItem('username');
        const savedPassword = await AsyncStorage.getItem('password');
        if (username === savedUsername && password === savedPassword) {
          Toast.show({ message: 'Signed in offline.', type: 'info' });
          router.replace('/dashboard');
        } else {
          Toast.show({ message: 'Please log in online at least once.', type: 'error' });
        }
      }
    } catch {
      Toast.show({ message: 'Login failed. Check your connection.', type: 'error' });
    } finally {
      setLoading(false);
    }
  }, [username, password, router]);

  return (
    <KeyboardAvoidingView
      style={{ flex: 1 }}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      keyboardVerticalOffset={80}
    >
      <ScrollView
        contentContainerStyle={{ flexGrow: 1, justifyContent: 'center' }}
        keyboardShouldPersistTaps="handled"
      >
        <Stack.Screen options={{ title: 'Login' }} />
        <View style={styles.container}>
          <Text style={styles.title}>Budgetly</Text>
          <Text style={styles.subtitle}>Track your finances</Text>

          <TextInput
            style={styles.input}
            placeholder="Username"
            placeholderTextColor={Colors.secondary}
            value={username}
            onChangeText={setUsername}
            autoCapitalize="none"
            autoCorrect={false}
            returnKeyType="next"
            editable={!loading}
          />

          {/* Password field with eye toggle */}
          <View style={styles.passwordContainer}>
            <TextInput
              style={styles.passwordInput}
              placeholder="Password"
              placeholderTextColor={Colors.secondary}
              secureTextEntry={!showPassword}
              value={password}
              onChangeText={setPassword}
              returnKeyType="done"
              onSubmitEditing={handleLogin}
              editable={!loading}
            />
            <TouchableOpacity
              style={styles.eyeButton}
              onPress={() => setShowPassword(v => !v)}
              activeOpacity={0.6}
              hitSlop={10}
            >
              <Ionicons
                name={showPassword ? 'eye-off' : 'eye'}
                size={20}
                color={Colors.secondary}
              />
            </TouchableOpacity>
          </View>

          <TouchableOpacity
            style={[styles.button, loading && styles.buttonDisabled]}
            onPress={handleLogin}
            disabled={loading}
            activeOpacity={0.8}
          >
            {loading
              ? <ActivityIndicator color={Colors.dark} size="small" />
              : <Text style={styles.buttonText}>Login</Text>
            }
          </TouchableOpacity>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'center',
    padding: 24,
    backgroundColor: Colors.dark,
  },
  title: {
    fontSize: 32,
    fontWeight: '600',
    color: Colors.accent,
    marginBottom: 6,
    textAlign: 'center',
  },
  subtitle: {
    fontSize: 14,
    color: Colors.secondary,
    textAlign: 'center',
    marginBottom: 40,
  },
  input: {
    backgroundColor: Colors.primary + '20',
    borderColor: Colors.secondary,
    borderWidth: 1,
    borderRadius: 10,
    padding: 15,
    color: Colors.accent,
    marginBottom: 15,
    fontSize: 16,
  },
  passwordContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.primary + '20',
    borderColor: Colors.secondary,
    borderWidth: 1,
    borderRadius: 10,
    marginBottom: 15,
    paddingRight: 12,
  },
  passwordInput: {
    flex: 1,
    padding: 15,
    color: Colors.accent,
    fontSize: 16,
  },
  eyeButton: {
    paddingLeft: 8,
    justifyContent: 'center',
    alignItems: 'center',
  },
  eyeIcon: {
    fontSize: 18,
  },
  button: {
    backgroundColor: Colors.primary,
    padding: 16,
    borderRadius: 10,
    alignItems: 'center',
    minHeight: 50,
    justifyContent: 'center',
  },
  buttonDisabled: {
    opacity: 0.7,
  },
  buttonText: {
    color: Colors.dark,
    fontWeight: '600',
    fontSize: 16,
  },
});