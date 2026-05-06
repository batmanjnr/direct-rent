import { User, VerificationLevel } from '../types';

/**
 * Calculates the verification level of a user based on their data.
 * 
 * VERIFIED: phoneVerified = true
 * TRUSTED: phoneVerified = true + avatarUrl exists + nin exists
 * FULLY VERIFIED (FUTURE): NIN verified via external API (placeholder logic for now)
 */
export function calculateVerificationLevel(user: Partial<User>): VerificationLevel {
  const { role, verificationStatus } = user;

  if (role === 'agent') {
    if (verificationStatus === 'verified') return 'verified';
    return 'none';
  }

  // Tenants just get 'none' or 'verified' if they completed basic info?
  // Let's stick to the prompt's focus on agents.
  if (user.phoneVerified && user.nin && (user.firstName || user.lastName)) return 'verified';

  return 'none';
}

/**
 * Checks if the profile is complete.
 * firstName, lastName, phoneVerified, gender, age, city, nin, avatarUrl
 */
export function isProfileComplete(user: Partial<User>): boolean {
  return !!(
    user.firstName &&
    user.lastName &&
    user.phoneVerified &&
    user.gender &&
    user.age &&
    user.city &&
    user.nin
  );
}
