import { Network } from "../network";
import { Address, Send } from "../message";
import { Timeout } from "../timeout";
import { SendEchoer, ReplyLogger, TestSimulator } from "./mocks";

describe("Timeout Tests", () => {
  test("Basic Tests", () => {
    const net = new Network("net1");
    const source = new ReplyLogger("source");
    const timeout = new Timeout("q1");
    const target = new SendEchoer("target");
    const world = new TestSimulator();
    net.add(timeout);
    net.add(target);
    timeout.target = source;

    for (let i = 0; i < 5; i++) {
      source.forwardSend(new Send(source, 0, new Address("target", "test")), world);
    }

    world.runTillEnd();
    const d = timeout.diagnostics;
    expect(d.queueSize).toBe(0);
  });
});
