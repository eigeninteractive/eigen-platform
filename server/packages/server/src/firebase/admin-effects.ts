import { deleteFirebaseAccount } from "../auth/admin.js";
import { readServiceAccount, type ServiceAccount } from "../google/oauth.js";
import type { NotificationMessage } from "../notify/fcm.js";
import { pushToUser } from "../notify/push.js";

/** A deployment error raised when server-side Firebase credentials are absent. */
export class FirebaseAdminConfigurationError extends Error {
  constructor() {
    super("Firebase Admin is not configured; set FIREBASE_PROJECT_ID, FIREBASE_CLIENT_EMAIL, and FIREBASE_PRIVATE_KEY");
    this.name = "FirebaseAdminConfigurationError";
  }
}

/** The Firebase Admin effects used by authenticated engine paths. */
export interface FirebaseAdminEffects {
  /** Send one notification through the engine's registered-device store. */
  notifyUser(d1: D1Database, userId: string, message: NotificationMessage): Promise<void>;
  /** Permanently delete one Firebase Authentication account. */
  deleteAccount(userId: string): Promise<void>;
}

/** Bind Firebase Admin effects to a validated service account. */
export function createFirebaseAdminEffects(serviceAccount: ServiceAccount, webAppOrigin?: string): FirebaseAdminEffects {
  return {
    notifyUser: (d1, userId, message) => pushToUser(d1, serviceAccount, userId, message, webAppOrigin),
    deleteAccount: (userId) => deleteFirebaseAccount(serviceAccount, userId),
  };
}

function webNotificationOrigin(env: unknown): string | undefined {
  const value = (env as Record<string, unknown>).WEB_APP_ORIGIN;
  if (typeof value !== "string" || value.length === 0) return undefined;
  const url = new URL(value);
  // Firebase accepts only secure click-action URLs. Local HTTP development
  // still receives notifications, but omits click-through.
  return url.protocol === "https:" ? url.origin : undefined;
}

/** Resolve the required Firebase Admin effects from a Worker environment. */
export function firebaseAdminFromEnv(env: unknown): FirebaseAdminEffects {
  const serviceAccount = readServiceAccount(env);
  if (serviceAccount === null) throw new FirebaseAdminConfigurationError();
  return createFirebaseAdminEffects(serviceAccount, webNotificationOrigin(env));
}
