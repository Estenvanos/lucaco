import { jest } from "@jest/globals";
import { DEFAULT_PERMISSIONS, PERMISSIONS } from "../../lib/constants.js";

/** jest.fn() with no type argument infers `never` parameters, which breaks mockResolvedValue. */
const mock = () => jest.fn<(...args: any[]) => any>();

const role = { findMany: mock(), findUnique: mock(), create: mock(), update: mock(), delete: mock() };
const serverMember = { findUnique: mock() };
const memberRole = { upsert: mock(), deleteMany: mock() };

const requirePermission = jest.fn<(s: string, u: string, p: string) => Promise<bigint>>();
const has = jest.fn<(p: bigint, name: keyof typeof PERMISSIONS) => boolean>();

jest.unstable_mockModule("../../lib/prisma.js", () => ({ prisma: { role, serverMember, memberRole } }));
jest.unstable_mockModule("../servers/servers.services.js", () => ({
  requirePermission,
  has,
  getMember: jest.fn(async () => ({ id: "m1" })),
}));

const roles = await import("./roles.services.js");

const SERVER = "33333333-3333-3333-3333-333333333333";
const USER = "11111111-1111-1111-1111-111111111111";
const ROLE = "44444444-4444-4444-4444-444444444444";
const MEMBER = "55555555-5555-5555-5555-555555555555";

const roleRow = (over: Record<string, unknown> = {}) => ({
  id: ROLE,
  serverId: SERVER,
  name: "DJ",
  color: null,
  permissions: PERMISSIONS.STREAM,
  position: 0,
  isDefault: false,
  createdAt: new Date(),
  ...over,
});

/** Default: the caller is an administrator, so grants are allowed. */
beforeEach(() => {
  requirePermission.mockResolvedValue(PERMISSIONS.ADMINISTRATOR);
  has.mockReturnValue(true);
});

describe("toPublicRole", () => {
  it("exposes permissions as names, since BigInt is not JSON-serializable", () => {
    const publicRole = roles.toPublicRole(roleRow({ permissions: DEFAULT_PERMISSIONS }));

    expect(publicRole.permissions).toEqual(expect.arrayContaining(["CONNECT", "STREAM", "SEND_MESSAGES"]));
    expect(publicRole.permissions).not.toContain("MANAGE_ROLES");
    expect(JSON.stringify(publicRole)).toContain("CONNECT");
  });

  it("returns an empty list for a role with no permissions", () => {
    expect(roles.toPublicRole(roleRow({ permissions: 0n })).permissions).toEqual([]);
  });
});

describe("create", () => {
  it("converts names into the stored bitfield", async () => {
    role.create.mockResolvedValue(roleRow());

    await roles.create(SERVER, USER, { name: "DJ", permissions: ["CONNECT", "STREAM"] });

    expect(role.create).toHaveBeenCalledWith({
      data: {
        serverId: SERVER,
        name: "DJ",
        color: null,
        position: 0,
        permissions: PERMISSIONS.CONNECT | PERMISSIONS.STREAM,
      },
    });
  });

  it("requires MANAGE_ROLES", async () => {
    requirePermission.mockRejectedValue(Object.assign(new Error("Missing permission: MANAGE_ROLES"), { status: 403 }));

    await expect(roles.create(SERVER, USER, { name: "x", permissions: [] })).rejects.toMatchObject({ status: 403 });
    expect(role.create).not.toHaveBeenCalled();
  });

  // The escalation guard: holding MANAGE_ROLES must not let anyone mint ADMINISTRATOR.
  it("refuses to grant a permission the caller does not hold", async () => {
    requirePermission.mockResolvedValue(PERMISSIONS.MANAGE_ROLES);
    has.mockImplementation((_p, name) => name === "MANAGE_ROLES");

    await expect(
      roles.create(SERVER, USER, { name: "root", permissions: ["ADMINISTRATOR"] }),
    ).rejects.toMatchObject({ status: 403, message: "Cannot grant: ADMINISTRATOR" });
    expect(role.create).not.toHaveBeenCalled();
  });
});

describe("update", () => {
  it("keeps @everyone's name", async () => {
    role.findUnique.mockResolvedValue(roleRow({ isDefault: true, name: "@everyone" }));

    await expect(roles.update(SERVER, ROLE, USER, { name: "outro" })).rejects.toMatchObject({ status: 409 });
    expect(role.update).not.toHaveBeenCalled();
  });

  it("still allows changing @everyone's permissions", async () => {
    role.findUnique.mockResolvedValue(roleRow({ isDefault: true, name: "@everyone" }));
    role.update.mockResolvedValue(roleRow({ isDefault: true, permissions: PERMISSIONS.CONNECT }));

    await roles.update(SERVER, ROLE, USER, { permissions: ["CONNECT"] });

    expect(role.update).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ permissions: PERMISSIONS.CONNECT }) }),
    );
  });

  it("404s when the role belongs to another server", async () => {
    role.findUnique.mockResolvedValue(roleRow({ serverId: "99999999-9999-9999-9999-999999999999" }));

    await expect(roles.update(SERVER, ROLE, USER, { name: "x" })).rejects.toMatchObject({ status: 404 });
  });
});

describe("remove", () => {
  it("never deletes @everyone", async () => {
    role.findUnique.mockResolvedValue(roleRow({ isDefault: true }));

    await expect(roles.remove(SERVER, ROLE, USER)).rejects.toMatchObject({ status: 409 });
    expect(role.delete).not.toHaveBeenCalled();
  });
});

describe("assign", () => {
  it("links member and role once (upsert), so a repeat is not an error", async () => {
    role.findUnique.mockResolvedValue(roleRow());
    serverMember.findUnique.mockResolvedValue({ id: MEMBER, serverId: SERVER });

    await roles.assign(SERVER, ROLE, MEMBER, USER);

    expect(memberRole.upsert).toHaveBeenCalledWith({
      where: { memberId_roleId: { memberId: MEMBER, roleId: ROLE } },
      create: { memberId: MEMBER, roleId: ROLE },
      update: {},
    });
  });

  it("refuses a member from another server", async () => {
    role.findUnique.mockResolvedValue(roleRow());
    serverMember.findUnique.mockResolvedValue({ id: MEMBER, serverId: "99999999-9999-9999-9999-999999999999" });

    await expect(roles.assign(SERVER, ROLE, MEMBER, USER)).rejects.toMatchObject({ status: 404 });
    expect(memberRole.upsert).not.toHaveBeenCalled();
  });

  it("refuses assigning a role whose permissions the caller lacks", async () => {
    role.findUnique.mockResolvedValue(roleRow({ permissions: PERMISSIONS.ADMINISTRATOR }));
    requirePermission.mockResolvedValue(PERMISSIONS.MANAGE_ROLES);
    has.mockImplementation((_p, name) => name === "MANAGE_ROLES");

    await expect(roles.assign(SERVER, ROLE, MEMBER, USER)).rejects.toMatchObject({ status: 403 });
    expect(memberRole.upsert).not.toHaveBeenCalled();
  });
});
