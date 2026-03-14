import bcrypt from "bcrypt";
import { SignJWT, jwtVerify } from "jose";

const SALT_ROUNDS = 10;
const JWT_SECRET_RAW = process.env.JWT_SECRET;
if (
  process.env.NODE_ENV === "production" &&
  (!JWT_SECRET_RAW || JWT_SECRET_RAW === "your-secret-key-change-in-production")
) {
  throw new Error("JWT_SECRET must be set to a strong value in production");
}
const JWT_SECRET = new TextEncoder().encode(
  JWT_SECRET_RAW || "your-secret-key-change-in-production"
);

/**
 * Hash a password using bcrypt
 */
export async function hashPassword(password: string): Promise<string> {
  return bcrypt.hash(password, SALT_ROUNDS);
}

/**
 * Verify a password against a hash
 */
export async function verifyPassword(password: string, hash: string): Promise<boolean> {
  return bcrypt.compare(password, hash);
}

/**
 * Create a JWT token for a user
 */
export async function createToken(userId: number, email: string): Promise<string> {
  return new SignJWT({ userId, email })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime("7d")
    .sign(JWT_SECRET);
}

/**
 * Verify and decode a JWT token
 */
export async function verifyToken(token: string): Promise<{ userId: number; email: string } | null> {
  try {
    const { payload } = await jwtVerify(token, JWT_SECRET);
    return payload as { userId: number; email: string };
  } catch {
    return null;
  }
}
