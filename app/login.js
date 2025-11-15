import { useState } from 'react';
import { View, Text, TextInput, TouchableOpacity, StyleSheet, Alert, KeyboardAvoidingView, ScrollView, Platform } from 'react-native';
import { useRouter } from 'expo-router';
import axios from 'axios';
import Colors from '../constants/colors';
import AsyncStorage from '@react-native-async-storage/async-storage';
import NetInfo from '@react-native-community/netinfo';

const API_URL = 'https://budget-tracker-aliqyaan.vercel.app';

export default function LoginScreen() {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const router = useRouter();

  async function handleLogin() {
    const netState = await NetInfo.fetch();
    if (netState.isConnected) {
      // Online: normal login
      try {
        const res = await axios.post(`${API_URL}/api/login`, { username, password });
        if (res.data.success) {
          await AsyncStorage.setItem('username', username);
          await AsyncStorage.setItem('password', password); // Save password for offline login
          // Fetch budgets and save locally for offline
          const budgetsRes = await axios.get(`${API_URL}/api/budgets?user=${username}`);
          await AsyncStorage.setItem('budgets', JSON.stringify(budgetsRes.data));
          router.replace('/dashboard');
        } else {
          Alert.alert('Error', 'Invalid credentials');
        }
      } catch (error) {
        Alert.alert('Error', 'Login failed');
      }
    } else {
      // Offline: check local credentials
      const savedUsername = await AsyncStorage.getItem('username');
      const savedPassword = await AsyncStorage.getItem('password');
      if (username === savedUsername && password === savedPassword) {
        router.replace('/dashboard');
      } else {
        Alert.alert('Error', 'Offline login failed. Please login online at least once.');
      }
    }
  }

  return (
    <KeyboardAvoidingView
      style={{ flex: 1 }}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      keyboardVerticalOffset={80}
    >
      <ScrollView contentContainerStyle={{ flexGrow: 1, justifyContent: 'center' }}>
        <View style={styles.container}>
          <Text style={styles.title}>Budgetly</Text>
          <TextInput
            style={styles.input}
            placeholder="Username"
            placeholderTextColor={Colors.secondary}
            value={username}
            onChangeText={setUsername}
          />
          <TextInput
            style={styles.input}
            placeholder="Password"
            placeholderTextColor={Colors.secondary}
            secureTextEntry
            value={password}
            onChangeText={setPassword}
          />
          <TouchableOpacity style={styles.button} onPress={handleLogin}>
            <Text style={styles.buttonText}>Login</Text>
          </TouchableOpacity>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, justifyContent: 'center', padding: 20, backgroundColor: Colors.dark },
  title: { fontSize: 32, fontWeight: 'bold', color: Colors.accent, marginBottom: 40, textAlign: 'center' },
  input: { backgroundColor: Colors.primary + '20', borderColor: Colors.secondary, borderWidth: 1, borderRadius: 10, padding: 15, color: Colors.accent, marginBottom: 15 },
  button: { backgroundColor: Colors.primary, padding: 15, borderRadius: 10, alignItems: 'center' },
  buttonText: { color: Colors.dark, fontWeight: 'bold', fontSize: 16 },
});