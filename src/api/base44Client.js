import { createClient } from '@base44/sdk';
// import { getAccessToken } from '@base44/sdk/utils/auth-utils';

// Create a client with authentication required
export const base44 = createClient({
  appId: "683990ee99510900b3758665", 
  requiresAuth: true // Ensure authentication is required for all operations
});
