import { jest } from "@jest/globals";

/** jest.fn() with no type argument infers `never` parameters, which breaks mockResolvedValue. */
const mock = () => jest.fn<(...args: any[]) => any>();

const serverRule = { findMany: mock(), deleteMany: mock(), createMany: mock() };
const tx = { serverRule };
const withUser = jest.fn(async (_userId: string, fn: (t: unknown) => unknown) => fn(tx));
const getMember = mock();
const requirePermission = mock();
const record = mock();

jest.unstable_mockModule("../../lib/prisma.js", () => ({ prisma: {}, withUser }));
jest.unstable_mockModule("../servers/servers.services.js", () => ({ getMember, requirePermission }));
jest.unstable_mockModule("../audit/audit.services.js", () => ({ record }));

const rules = await import("./rules.services.js");

const SERVER = "33333333-3333-3333-3333-333333333333";
const USER = "11111111-1111-1111-1111-111111111111";
const forbidden = () => Object.assign(new Error("forbidden"), { status: 403 });

beforeEach(() => {
  jest.clearAllMocks();
  getMember.mockResolvedValue({ id: "m1" });
  requirePermission.mockResolvedValue(0n);
});

describe("list", () => {
  it("returns the rules in order to a member", async () => {
    serverRule.findMany.mockResolvedValue([{ id: "r1", serverId: SERVER, position: 0, content: "Sem spam", createdAt: new Date() }]);

    await expect(rules.list(SERVER, USER)).resolves.toEqual([{ id: "r1", position: 0, content: "Sem spam" }]);
    expect(withUser).toHaveBeenCalledWith(USER, expect.any(Function));
  });

  it("403s someone outside the server", async () => {
    getMember.mockRejectedValue(forbidden());

    await expect(rules.list(SERVER, USER)).rejects.toMatchObject({ status: 403 });
    expect(serverRule.findMany).not.toHaveBeenCalled();
  });
});

describe("replace", () => {
  it("swaps the whole list, positions follow the array, and logs rules_update", async () => {
    serverRule.findMany.mockResolvedValue([]);

    await rules.replace(SERVER, USER, { rules: ["Respeito", "Sem spam"] });

    expect(serverRule.deleteMany).toHaveBeenCalledWith({ where: { serverId: SERVER } });
    expect(serverRule.createMany).toHaveBeenCalledWith({
      data: [
        { serverId: SERVER, position: 0, content: "Respeito" },
        { serverId: SERVER, position: 1, content: "Sem spam" },
      ],
    });
    expect(record).toHaveBeenCalledWith(tx, expect.objectContaining({ action: "rules_update", actorId: USER }));
  });

  it("403s without MANAGE_SERVER and changes nothing", async () => {
    requirePermission.mockRejectedValue(forbidden());

    await expect(rules.replace(SERVER, USER, { rules: ["x"] })).rejects.toMatchObject({ status: 403 });
    expect(requirePermission).toHaveBeenCalledWith(SERVER, USER, "MANAGE_SERVER");
    expect(serverRule.deleteMany).not.toHaveBeenCalled();
  });
});
