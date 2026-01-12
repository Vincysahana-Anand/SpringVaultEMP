import React, { useState } from 'react';
import {
  View,
  Text,
  Image,
  TextInput,
  StyleSheet,
  TouchableOpacity,
  Pressable,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  Alert,
} from 'react-native';
import MaterialCommunityIcons from '@react-native-vector-icons/material-design-icons';
import { getAuth, signInWithEmailAndPassword } from '@react-native-firebase/auth';
import { handleServiceError } from '../services/serviceErrorWrapper';
import DropletLoader from './DropletLoader';

const banner = require('../assets/banner.png');

export default function Login({ onForgot }: { onForgot?: () => void }) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [remember, setRemember] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleSignIn = async () => {
    setError('');
    if (!email || !password) {
      setError('Please enter both email and password.');
      return;
    }
    setLoading(true);
    try {
      await signInWithEmailAndPassword(getAuth(), email.trim(), password);
      setLoading(false);
      Alert.alert('Success', 'Signed in successfully');
      // TODO: navigate to the app's authenticated area
    } catch (e: any) {
      setLoading(false);
      const err = handleServiceError(e, 'login');
      setError(err.message);
    }
  };

  return (
    <KeyboardAvoidingView
      style={styles.flex}
      behavior={Platform.select({ ios: 'padding', android: undefined })}
    >
      <ScrollView contentContainerStyle={styles.container} keyboardShouldPersistTaps="handled">
        <Image source={banner} style={styles.banner} resizeMode="contain" />

        <View style={styles.card}>
          <Text style={styles.label}>Email Address</Text>
          <View style={styles.inputRow}>
            <MaterialCommunityIcons name="email-outline" size={20} color="#6b7280" />
            <TextInput
              style={styles.input}
              placeholder="you@example.com"
              placeholderTextColor="#9CA3AF"
              keyboardType="email-address"
              autoCapitalize="none"
              value={email}
              onChangeText={setEmail}
            />
          </View>

          <Text style={[styles.label, { marginTop: 16 }]}>Password</Text>
          <View style={styles.inputRow}>
            <MaterialCommunityIcons name="lock-outline" size={20} color="#6b7280" />
            <TextInput
              style={styles.input}
              placeholder="Enter your password"
              placeholderTextColor="#9CA3AF"
              secureTextEntry={!showPassword}
              value={password}
              onChangeText={setPassword}
            />
            <Pressable onPress={() => setShowPassword(s => !s)} style={styles.eyeBtn}>
              <MaterialCommunityIcons name={showPassword ? 'eye-off' : 'eye'} size={20} color="#6b7280" />
            </Pressable>
          </View>

          <View style={styles.rowBetween}>
            <Pressable style={styles.rememberRow} onPress={() => setRemember(r => !r)}>
              <View style={[styles.rememberBox, remember && styles.rememberBoxOn]}>
                {remember && <MaterialCommunityIcons name="check" size={14} color="#fff" />}
              </View>
              <Text style={styles.rememberText}>Remember me</Text>
            </Pressable>

            <TouchableOpacity onPress={() => onForgot && onForgot()}>
              <Text style={styles.forgot}>Forgot password?</Text>
            </TouchableOpacity>
          </View>

          {error ? <Text style={styles.errorText}>{error}</Text> : null}

          <TouchableOpacity style={styles.signinBtn} activeOpacity={0.8} onPress={handleSignIn} disabled={loading}>
            <Text style={styles.signinText}>Sign In</Text>
          </TouchableOpacity>

          <DropletLoader visible={loading} />

          <View style={styles.footerTextWrap}>
            <Text style={styles.footerText}>
              By signing in, you agree to our Terms of Service and Privacy Policy
            </Text>
          </View>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  container: {
    flexGrow: 1,
    alignItems: 'center',
    paddingVertical: 32,
    paddingHorizontal: 20,
    backgroundColor: '#fff',
  },
  banner: {
    width: 240,
    height: 120,
    marginBottom: 20,
  },
  card: {
    width: '100%',
    backgroundColor: '#fff',
    borderRadius: 10,
    padding: 20,
    shadowColor: '#000',
    shadowOpacity: 0.05,
    shadowOffset: { width: 0, height: 2 },
    shadowRadius: 6,
    elevation: 3,
  },
  label: {
    fontSize: 13,
    color: '#374151',
    marginBottom: 8,
    fontWeight: '600',
  },
  inputRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F8FAFC',
    borderRadius: 8,
    paddingHorizontal: 12,
    height: 48,
  },

  input: {
    flex: 1,
    height: '100%',
    color: '#111827',
  },
  eyeBtn: {
    padding: 8,
  },
  rowBetween: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 14,
  },
  rememberRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  rememberBox: {
    width: 18,
    height: 18,
    borderRadius: 4,
    borderWidth: 1,
    borderColor: '#CBD5E1',
    marginRight: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  rememberBoxOn: { backgroundColor: '#06b6d4', borderColor: '#06b6d4' },
  rememberText: { color: '#374151', fontSize: 14 },
  forgot: { color: '#0ea5b8', fontWeight: '600' },
  signinBtn: {
    marginTop: 18,
    backgroundColor: '#06b6d4',
    borderRadius: 8,
    height: 48,
    alignItems: 'center',
    justifyContent: 'center',
  },
  signinText: { color: '#fff', fontWeight: '700', fontSize: 16 },
  footerTextWrap: { marginTop: 20, borderTopWidth: 1, borderTopColor: '#EEF2F7', paddingTop: 16 },
  footerText: { color: '#9CA3AF', fontSize: 12, textAlign: 'center' },
  errorText: { color: '#DC2626', marginTop: 12, textAlign: 'center' },
});
