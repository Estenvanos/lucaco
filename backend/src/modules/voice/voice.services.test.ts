import { jest } from "@jest/globals";
import * as voice from "./voice.services.js";

/** jest.fn() with no type argument infers `never` parameters, which breaks mockResolvedValue. */
const mock = () => jest.fn<(...args: any[]) => any>();

type FakeSocket = {
  id: string;
  data: Record<string, unknown>;
  join: jest.Mock;
  leave: jest.Mock;
  to: jest.Mock;
  emit: jest.Mock;
};

const emit = mock();

function socket(id: string, data: Record<string, unknown> = {}): FakeSocket {
  return {
    id,
    data: { userId: `user-${id}`, username: `name-${id}`, ...data },
    join: mock(),
    leave: mock(),
    to: jest.fn(() => ({ emit })),
    emit,
  };
}

/** Enough of the Socket.IO server surface for the room bookkeeping under test. */
function server(sockets: FakeSocket[], roomMembers: FakeSocket[] = []) {
  return {
    sockets: { sockets: new Map(sockets.map((s) => [s.id, s])) },
    in: jest.fn(() => ({ fetchSockets: jest.fn(async () => roomMembers) })),
    to: jest.fn(() => ({ emit })),
  } as never;
}

describe("join", () => {
  it("returns the peers already in the room and announces the newcomer", async () => {
    const newcomer = socket("a");
    const present = socket("b", { roomId: "sala", sharing: true });
    const io = server([newcomer], [present]);

    const peers = await voice.join(io, "a", "sala");

    expect(peers).toEqual([{ socketId: "b", userId: "user-b", username: "name-b", sharing: true }]);
    expect(newcomer.join).toHaveBeenCalledWith("voice:sala");
    expect(newcomer.data.roomId).toBe("sala");
    expect(emit).toHaveBeenCalledWith(
      "voice:peer-joined",
      expect.objectContaining({ socketId: "a", sharing: false }),
    );
  });

  it("leaves the previous room first, so a socket is never in two rooms", async () => {
    const moving = socket("a", { roomId: "antiga" });
    const io = server([moving]);

    await voice.join(io, "a", "nova");

    expect(moving.leave).toHaveBeenCalledWith("voice:antiga");
    expect(moving.join).toHaveBeenCalledWith("voice:nova");
    expect(moving.data.roomId).toBe("nova");
  });
});

describe("leave", () => {
  it("clears the room and the sharing flag", async () => {
    const leaving = socket("a", { roomId: "sala", sharing: true });

    await voice.leave(server([leaving]), "a");

    expect(leaving.leave).toHaveBeenCalledWith("voice:sala");
    expect(leaving.data.roomId).toBeUndefined();
    expect(leaving.data.sharing).toBe(false);
    expect(emit).toHaveBeenCalledWith("voice:peer-left", { socketId: "a" });
  });

  it("is a no-op for a socket that never joined", async () => {
    const idle = socket("a");

    await voice.leave(server([idle]), "a");

    expect(idle.leave).not.toHaveBeenCalled();
  });
});

describe("setSharing", () => {
  it("stores the state and broadcasts it to the room", () => {
    const sharer = socket("a", { roomId: "sala" });

    expect(voice.setSharing(server([sharer]), "a", true)).toBe(true);
    expect(sharer.data.sharing).toBe(true);
    expect(emit).toHaveBeenCalledWith("voice:screen", { socketId: "a", sharing: true });
  });

  it("fails when the socket is not in a room, which the controller turns into 409", () => {
    const idle = socket("a");

    expect(voice.setSharing(server([idle]), "a", true)).toBe(false);
    expect(emit).not.toHaveBeenCalled();
  });
});

describe("canSignal", () => {
  it("allows signaling only between sockets in the same room", () => {
    const a = socket("a", { roomId: "sala" });
    const b = socket("b", { roomId: "sala" });
    const c = socket("c", { roomId: "outra" });
    const d = socket("d");
    const io = server([a, b, c, d]);

    expect(voice.canSignal(io, "a", "b")).toBe(true);
    expect(voice.canSignal(io, "a", "c")).toBe(false);
    expect(voice.canSignal(io, "a", "d")).toBe(false);
    expect(voice.canSignal(io, "d", "a")).toBe(false);
    expect(voice.canSignal(io, "a", "unknown")).toBe(false);
  });
});
