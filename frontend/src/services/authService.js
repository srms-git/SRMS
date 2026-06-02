import axios from 'axios';
import apiClient from '@/lib/apiClient';
import { applyServerPrivacy as applyCashierServerPrivacy } from '@/lib/cashierSettings';
import { applyServerPrivacy as applyOsgfaServerPrivacy } from '@/lib/osgfaSettings';
import { getApiClientBaseUrl, getApiSetupHint, isApiConfigured } from '@/lib/apiConfig';

const API_URL = getApiClientBaseUrl() ? `${getApiClientBaseUrl()}/auth` : '';

export const USER_UPDATED_EVENT = 'srms-user-updated';

function notifyUserUpdated() {
    window.dispatchEvent(new CustomEvent(USER_UPDATED_EVENT));
}

function toRequestError(error, fallbackMessage) {
    if (!isApiConfigured()) {
        return new Error(`API URL is not configured. ${getApiSetupHint()}`);
    }
    if (error.response?.status === 405) {
        return new Error(
            `API request was blocked (405). ${getApiSetupHint()}`,
        );
    }
    if (!error.response) {
        const isNetwork =
            error.code === 'ERR_NETWORK' ||
            String(error.message || '').toLowerCase().includes('network error');
        if (isNetwork) {
            return new Error(`Cannot reach the server. ${getApiSetupHint()}`);
        }
    }
    const message = error.response?.data?.message || error.message || fallbackMessage;
    return new Error(message);
}

const authService = {
    /**
     * Sends login credentials to the backend
     * @param {string} email 
     * @param {string} password 
     */
    login: async (email, password) => {
        if (!API_URL) {
            throw new Error(`API URL is not configured. ${getApiSetupHint()}`);
        }
        try {
            const response = await axios.post(`${API_URL}/login`, { email, password });
            
            // If we get a token back, save it to LocalStorage for session persistence
            if (response.data.token) {
                localStorage.setItem('token', response.data.token);
                // Saving user details allows the UI to display names/roles immediately
                localStorage.setItem('user', JSON.stringify(response.data.user));
                if (response.data.user?.cashierPrivacy) {
                    applyCashierServerPrivacy(response.data.user.cashierPrivacy);
                }
                if (response.data.user?.osgfaPrivacy) {
                    applyOsgfaServerPrivacy(response.data.user.osgfaPrivacy);
                }
            }
            
            return response.data;
        } catch (error) {
            throw toRequestError(error, 'Server connection failed');
        }
    },

    forgotPassword: async (email) => {
        try {
            const response = await axios.post(`${API_URL}/forgot-password`, { email });
            return response.data;
        } catch (error) {
            throw toRequestError(error, 'Unable to send reset email.');
        }
    },

    resetPassword: async ({ email, token, password }) => {
        try {
            const response = await axios.post(`${API_URL}/reset-password`, { email, token, password });
            return response.data;
        } catch (error) {
            throw toRequestError(error, 'Password reset failed.');
        }
    },

    /**
     * Clears local storage and logs the user out
     */
    logout: () => {
        localStorage.removeItem('token');
        localStorage.removeItem('user');
        // Optional: Force a redirect to login to clear any app state
        window.location.href = "/login";
    },

    /**
     * Helper to get the current logged-in user info
     */
    getCurrentUser: () => {
        const user = localStorage.getItem('user');
        return user ? JSON.parse(user) : null;
    },

    /**
     * Loads the authenticated user from the backend and refreshes local storage.
     */
    fetchProfile: async () => {
        try {
            const response = await apiClient.get('/auth/me');
            if (response.data?.user) {
                localStorage.setItem('user', JSON.stringify(response.data.user));
                if (response.data.user.cashierPrivacy) {
                    applyCashierServerPrivacy(response.data.user.cashierPrivacy);
                }
                if (response.data.user.osgfaPrivacy) {
                    applyOsgfaServerPrivacy(response.data.user.osgfaPrivacy);
                }
                notifyUserUpdated();
            }
            return response.data?.user ?? null;
        } catch (error) {
            throw toRequestError(error, 'Unable to load profile.');
        }
    },

    updateCashierPrivacy: async (privacy) => {
        try {
            const response = await apiClient.patch('/auth/cashier-privacy', { privacy });
            if (response.data?.user) {
                localStorage.setItem('user', JSON.stringify(response.data.user));
                notifyUserUpdated();
            }
            if (response.data?.privacy) {
                applyCashierServerPrivacy(response.data.privacy);
            }
            return response.data;
        } catch (error) {
            throw toRequestError(error, 'Unable to save privacy preferences.');
        }
    },

    updateOsgfaPrivacy: async (privacy) => {
        try {
            const response = await apiClient.patch('/auth/osgfa-privacy', { privacy });
            if (response.data?.user) {
                localStorage.setItem('user', JSON.stringify(response.data.user));
                notifyUserUpdated();
            }
            if (response.data?.privacy) {
                applyOsgfaServerPrivacy(response.data.privacy);
            }
            return response.data;
        } catch (error) {
            throw toRequestError(error, 'Unable to save privacy preferences.');
        }
    },

    /**
     * Updates profile name fields on the backend.
     */
    updateProfile: async ({ fullName, firstName, lastName }) => {
        try {
            const response = await apiClient.patch('/auth/profile', { fullName, firstName, lastName });
            if (response.data?.user) {
                localStorage.setItem('user', JSON.stringify(response.data.user));
                notifyUserUpdated();
            }
            return response.data;
        } catch (error) {
            throw toRequestError(error, 'Profile update failed.');
        }
    },

    requestPasswordChangeOtp: async ({ currentPassword }) => {
        try {
            const response = await apiClient.post('/auth/change-password/request-otp', {
                currentPassword,
            });
            return response.data;
        } catch (error) {
            throw toRequestError(error, 'Unable to send verification code.');
        }
    },

    changePassword: async ({ currentPassword, newPassword, otp }) => {
        try {
            const response = await apiClient.patch('/auth/change-password', {
                currentPassword,
                newPassword,
                otp,
            });
            return response.data;
        } catch (error) {
            throw toRequestError(error, 'Password change failed.');
        }
    },

    /**
     * Helper to get the stored JWT token for API headers
     */
    getToken: () => {
        return localStorage.getItem('token');
    },

    /**
     * Quick check if the user has a token
     */
    isAuthenticated: () => {
        return !!localStorage.getItem('token');
    }
};

export default authService;