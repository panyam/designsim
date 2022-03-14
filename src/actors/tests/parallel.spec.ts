import { Actor, OrderedSystem } from "../base";
import { MessageType, Address, Send, Reply } from "../message";
import { Network } from "../network";
import { Busy } from "../busy";
import { Parallel } from "../parallel";
import { SendEchoer, ReplyLogger, TestSimulator, MockSystem } from "./mocks";

describe("Parallel Actor Tests", () => {
  test("Test Parallel Actor processMessage", () => {
    const source = new ReplyLogger("source");
    const actor = new Parallel("par1");
    const b1 = new Busy("b1");
    const b2 = new Busy("b2");
    const b3 = new Busy("b3");
    actor.push(b1, b2, b3);

    const net = new Network("net1");
    net.add(source);
    net.add(actor);

    const send = new Send(source, 10, new Address(actor.name, ""));
    const world = new TestSimulator();
    source.forwardSend(send, world);
    world.runTillEnd();

    expect(world.injectedMessages.length).toBe(8);
    world.expectInjected(0, send);
    for (let i = 0; i < actor.childCount; i++) {
      const child = actor.childAt(i);
      world.expectInjected(i + 1, {
        type: MessageType.SEND,
        source: actor,
        nextActor: child,
        "address.method": "",
        time: send.time,
      });
    }

    for (let i = 0; i < actor.childCount; i++) {
      const child = actor.childAt(i) as Busy;
      world.expectInjected(i + 4, {
        type: MessageType.REPLY,
        source: child,
        nextActor: actor,
        time: send.time + child.waitTime,
      });
    }

    world.expectInjected(7, {
      type: MessageType.REPLY,
      source: actor,
      nextActor: source,
      time: send.time + b1.waitTime,
    });
  });
});
