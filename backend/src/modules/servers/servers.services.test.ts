import { jest } from "@jest/globals";
import { DEFAULT_PERMISSIONS, PERMISSIONS } from "../../lib/constants.js";

/** jest.fn() with no type argument infers `never` parameters, which breaks mockResolvedValue. */
const mock = () => jest.fn<(...args: any[]) => any>();

const server = { create: mock(), findUnique: mock(), findMany: mock(), update: mock(), delete: mock() };
const serverMember = { create: mock(), findUnique: mock(), findMany: mock(), delete: mock() };
const role = { create: mock(), findFirst: mock() };
const prisma = {
  server,
  serverMember,
  role,
  $transaction: jest.fn(async (fn: (tx: unknown) => unknown) => fn({ server, serverMember, role })),
};

jest.unstable_mockModule("../../lib/prisma.js", () => ({ prisma }));
jest.unstable_mockModule("../../lib/storage.js", () => ({ signedGetUrl: jest.fn(async (k: string) => `signed:${k}`) }));
jest.unstable_mockModule("../images/images.services.js", () => ({ store: mock(), remove: mock() }));

const servers = await import("./servers.services.js");

const OWNER = "11111111-1111-1111-1111-111111111111";
const MEMBER = "22222222-2222-2222-2222-222222222222";
const SERVER = "33333333-3333-3333-3333-333333333333";

const serverRow = { id: SERVER, ownerId: OWNER, name: "Sala", iconUrl: null, createdAt: new Date() };

describe("has", () => {
  it("grants only the requested bit", () => {
    expect(servers.has(PERMISSIONS.CONNECT, "CONNECT")).toBe(true);
    expect(servers.has(PERMISSIONS.CONNECT, "STREAM")).toBe(false);
    expect(servers.has(0n, "CONNECT")).toBe(false);
  });

  it("treats ADMINISTRATOR as every permission", () => {
    for (const name of Object.keys(PERMISSIONS) as (keyof typeof PERMISSIONS)[]) {
      expect(servers.has(PERMISSIONS.ADMINISTRATOR, name)).toBe(true);
    }
  });

  it("gives @everyone voice and streaming but nothing administrative", () => {
    expect(servers.has(DEFAULT_PERMISSIONS, "CONNECT")).toBe(true);
    expect(servers.has(DEFAULT_PERMISSIONS, "STREAM")).toBe(true);
    expect(servers.has(DEFAULT_PERMISSIONS, "MANAGE_ROLES")).toBe(false);
    expect(servers.has(DEFAULT_PERMISSIONS, "ADMINISTRATOR")).toBe(false);
  });
});

describe("create", () => {
  it("creates server, @everyone and the owner membership in one transaction", async () => {
    server.create.mockResolvedValue(serverRow);

    await servers.create(OWNER, { name: "Sala" });

    expect(prisma.$transaction).toHaveBeenCalled();
    expect(role.create).toHaveBeenCalledWith({
      data: { serverId: SERVER, name: "@everyone", permissions: DEFAULT_PERMISSIONS, isDefault: true },
    });
    expect(serverMember.create).toHaveBeenCalledWith({ data: { serverId: SERVER, userId: OWNER } });
  });
});

describe("permissionsFor", () => {
  it("makes the owner an administrator without reading roles", async () => {
    server.findUnique.mockResolvedValue(serverRow);

    await expect(servers.permissionsFor(SERVER, OWNER)).resolves.toBe(PERMISSIONS.ADMINISTRATOR);
    expect(role.findFirst).not.toHaveBeenCalled();
  });

  it("ORs @everyone with every role the member holds", async () => {
    server.findUnique.mockResolvedValue(serverRow);
    serverMember.findUnique.mockResolvedValue({
      id: "m1",
      roles: [{ role: { permissions: PERMISSIONS.MANAGE_ROLES } }, { role: { permissions: PERMISSIONS.KICK_MEMBERS } }],
    });
    role.findFirst.mockResolvedValue({ permissions: DEFAULT_PERMISSIONS });

    const permissions = await servers.permissionsFor(SERVER, MEMBER);

    expect(servers.has(permissions, "CONNECT")).toBe(true);
    expect(servers.has(permissions, "MANAGE_ROLES")).toBe(true);
    expect(servers.has(permissions, "KICK_MEMBERS")).toBe(true);
    expect(servers.has(permissions, "MANAGE_SERVER")).toBe(false);
  });

  it("rejects a non-member with 403", async () => {
    server.findUnique.mockResolvedValue(serverRow);
    serverMember.findUnique.mockResolvedValue(null);

    await expect(servers.permissionsFor(SERVER, MEMBER)).rejects.toMatchObject({ status: 403 });
  });
});

describe("requirePermission", () => {
  it("passes for a member that holds it and 403s otherwise", async () => {
    server.findUnique.mockResolvedValue(serverRow);
    serverMember.findUnique.mockResolvedValue({ id: "m1", roles: [] });
    role.findFirst.mockResolvedValue({ permissions: DEFAULT_PERMISSIONS });

    await expect(servers.requirePermission(SERVER, MEMBER, "CONNECT")).resolves.toBe(DEFAULT_PERMISSIONS);
    await expect(servers.requirePermission(SERVER, MEMBER, "MANAGE_ROLES")).rejects.toMatchObject({
      status: 403,
      message: "Missing permission: MANAGE_ROLES",
    });
  });
});

describe("leave", () => {
  it("refuses to strand a server without its owner", async () => {
    server.findUnique.mockResolvedValue(serverRow);

    await expect(servers.leave(SERVER, OWNER)).rejects.toMatchObject({ status: 409 });
    expect(serverMember.delete).not.toHaveBeenCalled();
  });

  it("removes a regular member", async () => {
    server.findUnique.mockResolvedValue(serverRow);
    serverMember.findUnique.mockResolvedValue({ id: "m1", roles: [] });

    await servers.leave(SERVER, MEMBER);

    expect(serverMember.delete).toHaveBeenCalledWith({
      where: { serverId_userId: { serverId: SERVER, userId: MEMBER } },
    });
  });
});

describe("getById", () => {
  it("404s for an unknown server", async () => {
    server.findUnique.mockResolvedValue(null);
    await expect(servers.getById(SERVER)).rejects.toMatchObject({ status: 404 });
  });
});

describe("toPublicServer", () => {
  it("signs the icon key and leaves null alone", async () => {
    await expect(servers.toPublicServer({ ...serverRow, iconUrl: "images/servers/x.webp" })).resolves.toMatchObject({
      iconUrl: "signed:images/servers/x.webp",
    });
    await expect(servers.toPublicServer(serverRow)).resolves.toMatchObject({ iconUrl: null });
  });
});
