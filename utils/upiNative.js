import { requireOptionalNativeModule } from 'expo-modules-core';
import { PermissionsAndroid, Platform } from 'react-native';

export const upiNative = Platform.OS === 'android' ? requireOptionalNativeModule('UpiAlerts') : null;

const { READ_SMS, RECEIVE_SMS } = PermissionsAndroid.PERMISSIONS;

export async function requestCaptureSms() {
  const permissions = await PermissionsAndroid.requestMultiple([READ_SMS, RECEIVE_SMS]);
  return permissions[RECEIVE_SMS] === PermissionsAndroid.RESULTS.GRANTED;
}

export async function requestInboxAccess() {
  return await PermissionsAndroid.request(READ_SMS) === PermissionsAndroid.RESULTS.GRANTED;
}
