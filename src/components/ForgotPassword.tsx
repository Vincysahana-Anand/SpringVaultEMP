import React, { useState } from 'react';
import {
  View,
  Text,
  Image,
  TextInput,
  StyleSheet,
  TouchableOpacity,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
} from 'react-native';
import MaterialCommunityIcons from '@react-native-vector-icons/material-design-icons';
import { getAuth, sendPasswordResetEmail } from '@react-native-firebase/auth';
import { handleServiceError } from '../services/serviceErrorWrapper';
import DropletLoader from './DropletLoader';
import { showSuccess } from '../shared/feedback/messageBus';

const banner = require('../assets/banner.png');

export default function ForgotPassword({ onBack }: { onBack: () => void }) {
  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleSendCode = async () => {
    setError('');
    if (!email) {
      setError('Please enter your email address.');
      return;
    }
    setLoading(true);
    try {
      await sendPasswordResetEmail(getAuth(), email.trim());
      setLoading(false);
      showSuccess('A password reset email has been sent.');
      onBack();
    } catch (e: any) {
      setLoading(false);
      const err = handleServiceError(e, 'forgot-password');
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
          <Text style={styles.title}>Forgot Password?</Text>
          <Text style={styles.subtitle}>
            Enter your email address and we’ll send you a code to reset your password.
          </Text>

          <Text style={[styles.label, { marginTop: 20 }]}>Email Address</Text>
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

          {error ? <Text style={styles.errorText}>{error}</Text> : null}

          <TouchableOpacity style={styles.sendBtn} activeOpacity={0.8} onPress={handleSendCode} disabled={loading}>
            <Text style={styles.sendText}>Send Code</Text>
          </TouchableOpacity>

          <DropletLoader visible={loading} />

          <TouchableOpacity style={{ marginTop: 18 }} onPress={onBack}>
            <Text style={styles.backText}>Back to Sign In</Text>
          </TouchableOpacity>
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
  banner: { width: 260, height: 120, marginBottom: 12 },
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
    alignItems: 'center',
  },
  title: { fontSize: 22, fontWeight: '700', color: '#0f172a', marginTop: 8 },
  subtitle: { fontSize: 14, color: '#64748b', textAlign: 'center', marginTop: 8 },
  label: { alignSelf: 'flex-start', fontSize: 13, color: '#374151', marginBottom: 8, fontWeight: '600' },
  inputRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F8FAFC',
    borderRadius: 8,
    paddingHorizontal: 12,
    height: 48,
    width: '100%',
  },
  icon: { fontSize: 18, marginRight: 8 },
  input: { flex: 1, height: '100%', color: '#111827', fontSize: 15 },
  sendBtn: { marginTop: 18, backgroundColor: '#06b6d4', borderRadius: 8, height: 48, alignItems: 'center', justifyContent: 'center', width: '100%' },
  sendText: { color: '#fff', fontWeight: '700', fontSize: 16 },
  backText: { color: '#0ea5b8', fontWeight: '600' },
  errorText: { color: '#DC2626', marginTop: 12, textAlign: 'center' },
});