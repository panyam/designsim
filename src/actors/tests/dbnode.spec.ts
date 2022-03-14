import { MessageType, Address, Send } from "../message";
import { Network } from "../network";
import { DBNode } from "../dbnode";
import { ReplyLogger, TestSimulator } from "./mocks";

describe("DBNode Tests", () => {
  test("Test DBNode GET", () => {
    const source = new ReplyLogger("source");
    const dbnode = new DBNode("db1");
    const net = new Network("net1");
    net.add(source);
    net.add(dbnode);

    // Test GET Send
    const world = new TestSimulator();
    world.randomFunc = (m, i) => {
      return Math.floor(0.99999 * m);
    };

    const sendget = new Send(source, 20, new Address(dbnode.name, "get"));
    source.forwardSend(sendget, world);
    world.runTillEnd();

    expect(world.injectedMessages.length).toBe(2);
    world.expectInjected(0, sendget);
    world.expectInjected(1, {
      type: MessageType.REPLY,
      source: dbnode,
      nextActor: source,
      responseTo: sendget,
      time: sendget.time + dbnode.getLatency,
      isError: false,
    });
  });

  test("Test DBNode PUT", () => {
    const world = new TestSimulator();
    world.randomFunc = (m, i) => {
      return Math.floor(0.99999 * m);
    };
    const source = new ReplyLogger("source");
    const dbnode = new DBNode("db1");
    const net = new Network("net1");
    net.add(source);
    net.add(dbnode);

    // Test PUT Send
    const sendput = new Send(source, 20, new Address(dbnode.name, "put"));
    source.forwardSend(sendput, world);
    world.runTillEnd();

    expect(world.injectedMessages.length).toBe(2);
    world.expectInjected(0, sendput);
    world.expectInjected(1, {
      type: MessageType.REPLY,
      source: dbnode,
      nextActor: source,
      responseTo: sendput,
      time: sendput.time + dbnode.putLatency,
      isError: false,
    });
  });

  test("Test DBNode Errors", () => {
    const world = new TestSimulator();
    world.randomFunc = (m, i) => {
      return Math.floor(0.99999 * m);
    };
    const source = new ReplyLogger("source");
    const dbnode = new DBNode("db1");
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
