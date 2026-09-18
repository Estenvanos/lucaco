import { PERMISSIONS, type PermissionName } from "./constants.js";

/** Pure bitfield <-> name conversion, shared by servers, roles and channels. */
export const toBitfield = (names: readonly PermissionName[]) =>
  names.reduce((acc, n) => acc | PERMISSIONS[n], 0n);

/** BigInt is not JSON-serializable, so permissions leave the API as names. */
export const toNames = (permissions: bigint) =>
  (Object.keys(PERMISSIONS) as PermissionName[]).filter((n) => (permissions & PERMISSIONS[n]) !== 0n);
