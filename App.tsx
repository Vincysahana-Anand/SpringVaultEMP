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
import { getFirestore, collection, query, where, limit, getDocs, doc, getDoc } from '@react-native-firebase/firestore';
import { handleServiceError } from './src/services/serviceErrorWrapper';
import { getAuth, onAuthStateChanged, signOut } from '@react-native-firebase/auth';
import { scanLegacyHistoryShape } from './src/services/firestoreHistoryMigration';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { GlobalMessageProvider } from './src/shared/feedback/GlobalMessageProvider';
import { User } from './src/types';

interface CachedUser {
  uid: string;
  email: string | null;
}

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
  const [user, setUser] = useState<CachedUser | null>(null);
  const [profile, setProfile] = useState<User | null>(null);
  const [profileLoading, setProfileLoading] = useState(false);
  const [profileError, setProfileError] = useState('');
  const [showForgot, setShowForgot] = useState(false);

  useEffect(() => {
    const warnIfLegacyHistoryShapeExists = async () => {
      try {
        const summary = await scanLegacyHistoryShape();
        if (
          summary.purchaseHistoryDocsWithLegacyPurchasesArray > 0
          || summary.dailyRecordDocsWithLegacyDateArrays > 0
        ) {
          console.warn(
            'Legacy Firestore history schema detected. ' +
            'Run scripts/firestore-production-migration.js with --mode=execute.',
            summary,
          );
        }
      } catch (error) {
        console.warn('Unable to scan Firestore legacy history schema:', error);
      }
    };

    void warnIfLegacyHistoryShapeExists();

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
          // Fetch user profile from Firestore.
          // Prefer lookup by UID, then fallback to common schemas (id==uid, email).
          const db = getFirestore();

          let found: any = null;

          // 1) users/{uid}
          if (u.uid) {
            const byUid = await getDoc(doc(db, 'users', u.uid));
            if (byUid.exists()) {
              found = { id: byUid.id, ...byUid.data() };
            }
          }

          // 2) users where id == uid (some apps store auth uid in a field)
          if (!found && u.uid) {
            const byIdField = await getDocs(query(collection(db, 'users'), where('id', '==', u.uid), limit(1)));
            if (!byIdField.empty) {
              found = { id: byIdField.docs[0].id, ...byIdField.docs[0].data() };
            }
          }

          // 3) users where email == auth email (exact)
          if (!found && u.email) {
            const byEmail = await getDocs(query(collection(db, 'users'), where('email', '==', u.email), limit(1)));
            if (!byEmail.empty) {
              found = { id: byEmail.docs[0].id, ...byEmail.docs[0].data() };
            }
          }

          // 4) users where email == normalized email (handles accidental casing/spaces)
          const normalizedEmail = String(u.email || '').trim().toLowerCase();
          if (!found && normalizedEmail) {
            const byEmailNorm = await getDocs(
              query(collection(db, 'users'), where('email', '==', normalizedEmail), limit(1))
            );
            if (!byEmailNorm.empty) {
              found = { id: byEmailNorm.docs[0].id, ...byEmailNorm.docs[0].data() };
            }
          }

          if (found) {
            setProfile(found);
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

}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
});

export default App;
