// src/services/userService.ts

import { deleteApp, getApp, initializeApp } from '@react-native-firebase/app';
import { createUserWithEmailAndPassword, getAuth, signOut as signOutAuth } from '@react-native-firebase/auth';
import {
    addDoc,
    collection,
    deleteDoc,
    doc,
    getDocs,
    getFirestore,
    orderBy,
    query,
    serverTimestamp,
    setDoc,
    updateDoc,
} from '@react-native-firebase/firestore';
import type { FirebaseFirestoreTypes } from '@react-native-firebase/firestore';
import { handleServiceError, ServiceError } from './serviceErrorWrapper';
import type { User } from '../types';

export type { User } from '../types';

const usersCollection = collection(getFirestore(), 'users');

export type CreateUserInput = {
    name: string;
    email: string;
    phone: string;
    role: string;
    password: string;
    isActive?: boolean;
    isAdmin?: boolean;
};

const SECONDARY_APP_NAME = 'SpringVaultEMP-secondary-auth';

const normalizeEmail = (email: string) => String(email || '').trim().toLowerCase();

const resolveFirebaseApp = async (maybeApp: any) => {
    // RNFB initializeApp may return a FirebaseApp or a Promise<FirebaseApp> depending on version.
    if (maybeApp && typeof maybeApp.then === 'function') {
        return await maybeApp;
    }
    return maybeApp;
};

const getSecondaryAuth = async () => {
    try {
        const existingApp = getApp(SECONDARY_APP_NAME);
        return { app: existingApp, secondaryAuth: getAuth(existingApp) };
    } catch (e) {
        // If the named app doesn't exist, initialize it with the default app's options.
        const defaultOptions = getApp().options;
        const app = await resolveFirebaseApp(initializeApp(defaultOptions, SECONDARY_APP_NAME));
        return { app, secondaryAuth: getAuth(app) };
    }
};

const cleanupSecondaryApp = async () => {
    try {
        const app = getApp(SECONDARY_APP_NAME);
        try {
            await signOutAuth(getAuth(app));
        } catch {
            // ignore
        }
        // Deleting is optional; it helps avoid any chance of session cross-talk.
        await deleteApp(app);
    } catch {
        // ignore
    }
};

const removeUndefined = <T extends Record<string, any>>(obj: T): T => {
    const next: any = {};
    Object.keys(obj).forEach((key) => {
        if (obj[key] !== undefined) next[key] = obj[key];
    });
    return next;
};

// Get all users
export const getUsers = async (): Promise<User[] | ServiceError> => {
    try {
        const snapshot = await getDocs(query(usersCollection, orderBy('name')));
        return snapshot.docs.map((d: FirebaseFirestoreTypes.QueryDocumentSnapshot) => ({ id: d.id, ...(d.data() as any) } as User));
    } catch (error) {
        return handleServiceError(error, 'getUsers');
    }
};

// Create Firebase Auth user + Firestore profile without affecting current session.
// Stores profile at users/{uid} so App.tsx can find it immediately.
export const createUserWithAuthAndProfile = async (input: CreateUserInput): Promise<string | ServiceError> => {
    const name = String(input.name || '').trim();
    const email = normalizeEmail(input.email);
    const phone = String(input.phone || '').trim();
    const role = String(input.role || '').trim();
    const password = String(input.password || '');
    const isActive = input.isActive ?? true;
    const isAdmin = input.isAdmin ?? role.toLowerCase() === 'owner';

    try {
        const { app, secondaryAuth } = await getSecondaryAuth();
        const cred = await createUserWithEmailAndPassword(secondaryAuth, email, password);
        const uid = cred.user.uid;

        try {
            await setDoc(
                doc(getFirestore(), 'users', uid),
                {
                    name,
                    email,
                    phone,
                    role,
                    isActive,
                    isAdmin,
                    createdAt: serverTimestamp(),
                    updatedAt: serverTimestamp(),
                },
                { merge: true }
            );
        } catch (e) {
            // Best-effort rollback: delete the created auth user.
            try {
                await cred.user.delete();
            } catch {
                // ignore
            }
            throw e;
        } finally {
            try {
                await signOutAuth(secondaryAuth);
            } catch {
                // ignore
            }
            try {
                await deleteApp(app);
            } catch {
                // ignore
            }
        }

        return uid;
    } catch (error) {
        await cleanupSecondaryApp();
        return handleServiceError(error, 'createUserWithAuthAndProfile');
    }
};

// Add new user with explicit fields — no undefined!
export const addUser = async (user: User): Promise<string | ServiceError> => {
    try {
        const newUser = {
            name: user.name.trim(),
            email: normalizeEmail(user.email),
            phone: user.phone.trim(),
            isAdmin: user.isAdmin ?? false,
            isActive: user.isActive ?? true,
            role: user.role ?? null,
            createdAt: serverTimestamp(),
            updatedAt: serverTimestamp(),
        };
        const docRef = await addDoc(usersCollection, newUser);
        return docRef.id;
    } catch (error) {
        return handleServiceError(error, 'addUser');
    }
};

// Update existing user
export const updateUser = async (id: string, data: Partial<User>): Promise<true | ServiceError> => {
    try {
        await updateDoc(
            doc(getFirestore(), 'users', id),
            removeUndefined({
                ...data,
                name: data.name?.trim(),
                email: data.email ? normalizeEmail(data.email) : undefined,
                phone: data.phone?.trim(),
                updatedAt: serverTimestamp(),
            })
        );
        return true;
    } catch (error) {
        return handleServiceError(error, 'updateUser');
    }
};

// Delete user
export const deleteUser = async (id: string): Promise<true | ServiceError> => {
    try {
        await deleteDoc(doc(getFirestore(), 'users', id));
        return true;
    } catch (error) {
        return handleServiceError(error, 'deleteUser');
    }
};
