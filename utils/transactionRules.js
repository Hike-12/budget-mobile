import AsyncStorage from '@react-native-async-storage/async-storage';
import axios from 'axios';
import { API_URL } from '../constants/api';

export async function accountHeaders() {
  const token = await AsyncStorage.getItem('accountSession');
  return token ? { Authorization: `Bearer ${token}` } : {};
}

export async function transactionRulesRequest(kind, command, signal) {
  const { data } = await axios({
    url: `${API_URL}/api/transaction-rules`,
    params: { kind },
    method: command ? 'POST' : 'GET',
    data: command,
    timeout: 12000,
    headers: await accountHeaders(),
    signal,
  });
  return data;
}
