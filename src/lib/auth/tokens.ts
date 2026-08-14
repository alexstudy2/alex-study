import { createHash, randomBytes } from "node:crypto";
export const createResetToken = () => randomBytes(32).toString("hex");
export const hashResetToken = (token: string) => createHash("sha256").update(token).digest("hex");
