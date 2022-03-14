import { Network } from "../network";
import { MessageType, Address, Send, Reply } from "../message";
import { Generator } from "../generator";
import { Busy } from "../busy";
import { TestSimulator } from "./mocks";

describe("Network Actor Tests", () => {
  test("Test Forwarding", () => {
    const net = new Network("test");
    const b1 = new Busy("b1");
    expect(() => net.forwardInput("in1", "b1", "childin1")).toThrowError("Cannot find child actor: " + b1.name);
    expect(() => net.forwardInput("in1", b1, "childin1")).toThrowError("b1 is not a child");
    net.add(b1);
    net.forwardInput("in1", "b1", "childin1");
    expect(net.forwards.length == 1);
    expect(net.forwards[0].input == "in1");
    expect(net.forwards[0].target == b1);
    expect(net.forwards[0].targetInput == "childin1");
  });

  test("Child Validation Before Adding", () => {
    const net1 = new Network("test1");
    const net2 = new Network("test2");
    const net = new Network("test");
    net1.add(net);
    expect(() => net2.add(net)).toThrowError(
      "Child (test) already belongs to another System (test1).  Remove it first or clone it",
    );
  });

  test("Test Adding and Getting", () => {
    const net = new Network("test");
    const b1 = new Busy("b1");
    expect(net.has("b1")).toBe(false);
    net.add(b1);
    expect(net.childCount).toBe(1);
    expect(net.has("b1")).toBe(true);
    expect(net.get("b1")).toBe(b1);

    expect(() => net.add(b1)).toThrow();
  });

  test("Test Adding Failures", () => {
    const net1 = new Network("test1");
    const net = new Network("test");
    net1.add(net);
    expect(() => net.add(net1)).toThrowError("Child (test1) is already an ancestor of this System (test)");
  });

  test("Test Removeal", () => {
    const net = new Network("test");
    const b1 = new Busy("b1");
    net.add(b1);
    expect(net.has(b1)).toBe(true);
    expect(net.remove(b1)).toBe(true);
    expect(net.has(b1)).toBe(false);
  });

  test("Test Routing Send to Child", () => {
    const world = new TestSimulator();
    const net = new Network("test");
    const b1 = new Busy("b1");
    net.add(b1);
    net.forwardInput("in1", "b1", "childin1");
    net.forwardInput("*", "b1", "childin2");

    const gen = new Generator("gen1");
    const send1 = new Send(gen, 0, new Address(net.name, "in1")).setNextActor(net);
    const send2 = new Send(gen, 0, new Address(net.name, "in2")).setNextActor(net);
    expect(net.routeSendToChild(send1, world)).toBe(true);
    expect(net.routeSendToChild(send2, world)).toBe(true);
    expect(world.injectedMessages.length).toBe(2);
    expect(world.injectedMessages[0].type).toBe(MessageType.SEND);
    expect(world.injectedMessages[0].source).toBe(net);
    expect((world.injectedMessages[0] as Send).nextActor).toBe(b1);
    expect((world.injectedMessages[0] as Send).address.method).toBe("childin1");

    expect(world.injectedMessages[1].type).toBe(MessageType.SEND);
    expect(world.injectedMessages[1].source).toBe(net);
    expect((world.injectedMessages[1] as Send).nextActor).toBe(b1);
    expect((world.injectedMessages[1] as Send).address.method).toBe("childin2");
  });

  test("Test Missing Route", () => {
    const world = new TestSimulator();
    const net = new Network("test");

    const gen = new Generator("gen1");
    const send1 = new Send(gen, 0, new Address(net.name, "in1")).setNextActor(net);
    expect(net.routeSendToChild(send1, world)).toBe(false);
    expect(world.injectedMessages.length).toBe(0);

    net.processSend(send1, world);
    expect(world.injectedMessages.length).toBe(1);
    expect(world.injectedMessages[0].type).toBe(MessageType.REPLY);
    expect(world.injectedMessages[0].source).toBe(net);
    expect((world.injectedMessages[0] as Reply).nextActor).toBe(gen);
    expect((world.injectedMessages[0] as Reply).isError).toBe(true);
    expect((world.injectedMessages[0] as Reply).errorReason).toBe("No destination found.");
  });
});
