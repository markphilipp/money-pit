import { betterAuth } from 'better-auth';
import { authOptions } from '@/auth';

export const auth = betterAuth(authOptions());
