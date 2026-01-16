/**
 * Sample React Native App
 * https://github.com/facebook/react-native
 *
 * @format
 */

import React, { useEffect, useState } from 'react';
import { StatusBar, StyleSheet, useColorScheme, View, Text, Button, ActivityIndicator } from 'react-native';
import {
  SafeAreaProvider,
  useSafeAreaInsets,
} from 'react-native-safe-area-context';
import Login from './src/components/Login';
import ForgotPassword from './src/components/ForgotPassword';
import DropletLoader from './src/components/DropletLoader';
import OwnerDashboard from './src/components/OwnerDashboard';
import EmployeeDashboard from './src/components/EmployeeDashboard';
import CustomerDashboard from './src/components/CustomerDashboard';
import InactiveCustomer from './src/components/InactiveCustomer';
import { getFirestore, collection, query, where, limit, getDocs } from '@react-native-firebase/firestore';
import { handleServiceError } from './src/services/serviceErrorWrapper';
import { getAuth, onAuthStateChanged, signOut } from '@react-native-firebase/auth';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { GlobalMessageProvider } from './src/shared/feedback/GlobalMessageProvider';

function App() {
  const isDarkMode = useColorScheme() === 'dark';

  return (
    <SafeAreaProvider>
      <StatusBar barStyle={isDarkMode ? 'light-content' : 'dark-content'} />
      <GlobalMessageProvider>
        <AppContent />
      </GlobalMessageProvider>
    </SafeAreaProvider>
  );
}

function AppContent() {
  const safeAreaInsets = useSafeAreaInsets();
  const [initializing, setInitializing] = useState(true);
  const [user, setUser] = useState<any>(null);
  const [profile, setProfile] = useState<any>(null);
  const [profileLoading, setProfileLoading] = useState(false);
  const [profileError, setProfileError] = useState('');
  const [showForgot, setShowForgot] = useState(false);

  useEffect(() => {
    // Load cached user immediately to avoid brief login flash
    const loadCached = async () => {
      try {
        const raw = await AsyncStorage.getItem('user');
        if (raw) {
          setUser(JSON.parse(raw));
        }
      } catch (e) {
        // ignore
      }
    };
    loadCached();

    const subscriber = onAuthStateChanged(getAuth(), async (u: any) => {
      if (u) {
        const safeUser = { uid: u.uid, email: u.email };
        setUser(safeUser);
        setProfile(null);
        setProfileError('');
        setProfileLoading(true);
        try {
          // Fetch user profile from Firestore by email
          const db = getFirestore();
          const usersQuery = query(collection(db, 'users'), where('email', '==', u.email), limit(1));
          const snap = await getDocs(usersQuery);
          if (!snap.empty) {
            setProfile({ id: snap.docs[0].id, ...snap.docs[0].data() });
          } else {
            setProfileError('No user profile found.');
          }
        } catch (e) {
          const err = handleServiceError(e, 'fetchUserProfile');
          setProfileError(err.message);
        }
        setProfileLoading(false);
        try {
          await AsyncStorage.setItem('user', JSON.stringify(safeUser));
        } catch (e) {
          // ignore
        }
      } else {
        setUser(null);
        setProfile(null);
        setProfileError('');
        try {
          await AsyncStorage.removeItem('user');
        } catch (e) {
          // ignore
        }
      }
      if (initializing) setInitializing(false);
    });

    return subscriber; // unsubscribe on unmount
  }, []);

  const handleSignOut = async () => {
    try {
      await signOut(getAuth());
      await AsyncStorage.removeItem('user');
    } catch (e) {
      console.warn('Sign out error', e);
    }
  };

  if (initializing || profileLoading) {
    return (
      <View style={[styles.container, { alignItems: 'center', justifyContent: 'center' }]}> 
        <DropletLoader visible={true} size={120} />
      </View>
    );
  }

  if (!user) {
    return (
      <View style={styles.container}>
        {showForgot ? (
          <ForgotPassword onBack={() => setShowForgot(false)} />
        ) : (
          <Login onForgot={() => setShowForgot(true)} />
        )}
      </View>
    );
  }

  if (profileError) {
    return (
      <View style={[styles.container, { alignItems: 'center', justifyContent: 'center' }]}> 
        <Text style={{ color: 'red', fontSize: 16 }}>{profileError}</Text>
        <Button title="Sign out" onPress={handleSignOut} />
      </View>
    );
  }

  // Owner dashboard check
  if (profile && profile.role === 'Owner'&& profile.isActive) {
    return <OwnerDashboard />;
  } else

  // Employee dashboard check
  if (profile && profile.role === 'Employee' && profile.isActive) {
    return <EmployeeDashboard />;
  } else

  // Customer dashboard check
  if (profile && profile.role === 'Customer' && profile.isActive) {
      return <CustomerDashboard />;
  } else {
      return <InactiveCustomer />;
  }

  // Authenticated area
  return (
    <View style={[styles.container, { padding: 24 }]}> 
      <Text style={{ fontSize: 18, marginBottom: 12 }}>Welcome {user.email}</Text>
      <Button title="Sign out" onPress={handleSignOut} />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
});

export default App;
