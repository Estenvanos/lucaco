import type { Server } from "socket.io";
import { SOCKET_EVENTS } from "../../lib/constants.js";
import { on } from "../../lib/socket.js";
import * as voiceController from "./voice.controller.js";

export function registerVoiceSocket(io: Server) {
  io.on("connection", (socket) => {
    on(io, socket, SOCKET_EVENTS.voiceJoin, voiceController.join);
    on(io, socket, SOCKET_EVENTS.voiceLeave, voiceController.leave);
    on(io, socket, SOCKET_EVENTS.voiceSignal, voiceController.signal);
    on(io, socket, SOCKET_EVENTS.voiceScreen, voiceController.screen);
    socket.on("disconnecting", () => voiceController.leave(io, socket));
  });
}
