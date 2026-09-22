// Prints the machine's LAN IPv4, which LiveKit advertises as its ICE candidate: Firefox ignores
// loopback candidates, so 127.0.0.1 only works in Chrome. Falls back to 127.0.0.1 when offline.
import { networkInterfaces } from "node:os";

const lan = Object.values(networkInterfaces())
  .flat()
  .find((i) => i && i.family === "IPv4" && !i.internal);
console.log(lan?.address ?? "127.0.0.1");
