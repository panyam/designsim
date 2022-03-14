import { MessageType, Address, Send, Reply } from "../message";
import { Network } from "../network";
import { Storage } from "../storage";
import { ReplyLogger, TestSimulator } from "./mocks";

describe("Storage Tests", () => {
  test("Test Storage Read", () => {
    const source = new ReplyLogger("source");
    const dbnode = new Storage("db1");
    const net = new Network("net1");
    net.add(source);
    net.add(dbnode);

    // Test GET Send
    const world = new TestSimulator();
    world.randomFunc = (m, i) => {
      return Math.floor(0.99999 * m);
    };

    const sendread = new Send(source, 20, new Address(dbnode.name, "read"));
    source.forwardSend(sendread, world);
    world.runTillEnd();

    expect(world.injectedMessages.length).toBe(2);
    world.expectInjected(0, sendread);
    world.expectInjected(1, {
      type: MessageType.REPLY,
      source: dbnode,
      nextActor: source,
      responseTo: sendread,
      time: sendread.time + dbnode.readLatency,
      isError: false,
    });
  });

  test("Test Storage Write", () => {
    const world = new TestSimulator();
    world.randomFunc = (m, i) => {
      return Math.floor(0.99999 * m);
    };
    const source = new ReplyLogger("source");
    const dbnode = new Storage("db1");
    const net = new Network("net1");
    net.add(source);
    net.add(dbnode);

    // Test PUT Send
    const sendwrite = new Send(source, 20, new Address(dbnode.name, "write"));
    source.forwardSend(sendwrite, world);
    world.runTillEnd();

    expect(world.injectedMessages.length).toBe(2);
    world.expectInjected(0, sendwrite);
    world.expectInjected(1, {
      type: MessageType.REPLY,
      source: dbnode,
      nextActor: source,
      responseTo: sendwrite,
      time: sendwrite.time + dbnode.writeLatency,
      isError: false,
    });
  });

  test("Test Storage Errors", () => {
    const world = new TestSimulator();
    world.randomFunc = (m, i) => {
      return Math.floor(0.99999 * m);
    };
    const source = new ReplyLogger("source");
    const dbnode = new Storage("db1");
    const net = new Network("net1");
    net.add(source);
    net.add(dbnode);
    // Test Error Send
    const sendblah = new Send(source, 20, new Address(dbnode.name, "blah"));
    source.forwardSend(sendblah, world);
    world.runTillEnd();

    expect(world.injectedMessages.length).toBe(2);
    world.expectInjected(0, sendblah);
    world.expectInjected(1, {
      type: MessageType.REPLY,
      source: dbnode,
      nextActor: source,
      responseTo: sendblah,
      isError: true,
      errorReason: "Invalid method: blah",
    });
  });
});
