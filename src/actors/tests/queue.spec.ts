import { Address, Send } from "../message";
import { Network } from "../network";
import { Queue } from "../queue";
import { SendEchoer, ReplyLogger, TestSimulator } from "./mocks";

describe("Queue Tests", () => {
  test("Basic Tests", () => {
    const net = new Network("net1");
    const source = new ReplyLogger("source");
    const target = new SendEchoer("target");
    const queue = new Queue("q1");
    queue.target = target;

    net.add(source);
    net.add(queue);

    const world = new TestSimulator();
    for (let i = 0; i < 5; i++) {
      source.forwardSend(new Send(source, 0, new Address("q1", "")), world);
    }

    world.runTillEnd();
    const d = queue.diagnostics;
    expect(d.numActiveServers).toBe(0);
    expect(d.queueSize).toBe(0);
  });
});
