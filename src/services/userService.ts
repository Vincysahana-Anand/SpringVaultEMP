// src/services/userService.ts

import firestore from '@react-native-firebase/firestore';
import { handleServiceError, ServiceError } from './serviceErrorWrapper';

export interface User {
    id?: string;
    name: string;
    email: string;
    phone: string;
    isAdmin: boolean;
    isActive: boolean;
    role?: string;
}

const usersCollection = firestore().collection("users");

// Get all users
export const getUsers = async (): Promise<User[] | ServiceError> => {
    try {
        const snapshot = await usersCollection.get();
        // console.log(`Fetched ${snapshot.size} users`);
        return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as User));
    } catch (error) {
        return handleServiceError(error, 'getUsers');
    }
};

// Add new user with explicit fields — no undefined!
export const addUser = async (user: User): Promise<string | ServiceError> => {
    try {
        const newUser = {
            name: user.name.trim(),
            email: user.email.trim(),
            phone: user.phone.trim(),
            isAdmin: user.isAdmin ?? false,
            isActive: user.isActive ?? true,
            role: user.role ?? null,
        };
        const docRef = await usersCollection.add(newUser);
        return docRef.id;
    } catch (error) {
        return handleServiceError(error, 'addUser');
    }
};

// Update existing user
export const updateUser = async (id: string, data: Partial<User>): Promise<true | ServiceError> => {
    try {
        await usersCollection.doc(id).update({
            ...data,
            name: data.name?.trim(),
            email: data.email?.trim(),
            phone: data.phone?.trim(),
        });
        return true;
    } catch (error) {
        return handleServiceError(error, 'updateUser');
    }
};

// Delete user
export const deleteUser = async (id: string): Promise<true | ServiceError> => {
    try {
        await usersCollection.doc(id).delete();
        return true;
    } catch (error) {
        return handleServiceError(error, 'deleteUser');
    }
};
