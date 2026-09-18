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
    on(io, socket, SOCKET_EVENTS.voiceWatch, voiceController.watch);
    on(io, socket, SOCKET_EVENTS.voiceUnwatch, voiceController.unwatch);
    on(io, socket, SOCKET_EVENTS.voiceStreamWatch, voiceController.watchStream);
    on(io, socket, SOCKET_EVENTS.voiceStreamUnwatch, voiceController.unwatchStream);
    socket.on("disconnecting", () => voiceController.leave(io, socket));
  });
}
