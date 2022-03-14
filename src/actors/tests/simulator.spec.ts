import { Network } from "../network";
import { Address, Send } from "../message";
import { Router } from "../router";
import { Call } from "../call";
import { Series } from "../series";
import { DBNode } from "../dbnode";
import { Simulator } from "../simulator";
import { ReplyLogger, SendEchoer } from "./mocks";

function TinyURL(name = "TinyURL"): Network {
  const TinyUrl = new Network(name);
  const tuweb = new Router("TUWeb");
  const tudb = new DBNode("TUDB");

  TinyUrl.add(tuweb);
  TinyUrl.add(tudb);

  tuweb.add(new Series("create").push(new Call("put", tudb.name, "put")));
  tuweb.add(new Series("resolve").push(new Call("get", tudb.name, "get")));

  TinyUrl.forwardInput("*", tuweb);

  return TinyUrl;
}

function IdGen(name = "IDGen"): Network {
  const IDGen = new Network(name);
  const idweb = new Router("IDGenWeb");
  const iddb = new DBNode("IDGenDB");

  IDGen.add(idweb);
  IDGen.add(iddb);
  // IDGen.connect(idweb.name, iddb.name);

  idweb.add(new Series("create").push(new Call("put", iddb.name, "put")));

  IDGen.forwardInput("*", idweb);

  return IDGen;
}

function FullTinyURL(name = "FullTinyUrl"): Network {
  // Empty System
  const TinyUrl = new Network(name);
  const tudb = new DBNode("TUDB");
  const tuweb = new Network("TUWeb");
  const idgen = IdGen();
  const tucreate = new Series("create").push(new Call("", tudb.name, "put"), new Call("", idgen.name, "create"));
  const turesolve = new Series("resolve").push(new Call("", tudb.name, "get"));

  tuweb.add(tucreate);
  tuweb.add(turesolve);

  TinyUrl.add(tuweb);
  TinyUrl.add(tudb);
  TinyUrl.add(idgen);
  // TinyUrl.connect(tuweb.name, tudb.name);
  // TinyUrl.connect(tuweb.name, idgen.name);

  tuweb.add(tucreate);
  tuweb.add(turesolve);
  tuweb.forwardInput("create", tucreate);
  tuweb.forwardInput("resolve", turesolve, "blah");

  TinyUrl.forwardInput("*", tuweb);

  return TinyUrl;
}

describe("Create the Tinyurl System", () => {
  test("Simulate its behavior with 5 create requests at different times", () => {
    // Step 1 - Declare the System
    const simulator = new Simulator();
    const TinyUrl = TinyURL();
    const generator = new Router("generator");

    simulator.reset();
    generator.forwardSend(new Send(generator, 10, new Address(TinyUrl.name, "create")), simulator);
    generator.forwardSend(new Send(generator, 20, new Address(TinyUrl.name, "create")), simulator);
    generator.forwardSend(new Send(generator, 50, new Address(TinyUrl.name, "create")), simulator);
    generator.forwardSend(new Send(generator, 100, new Address(TinyUrl.name, "create")), simulator);
    generator.forwardSend(new Send(generator, 75, new Address(TinyUrl.name, "create")), simulator);

    // simulator.step(1000, 1000);
  });
});

describe("Simulator Tests", () => {
  test("Basic Tests", () => {
    const sim = new Simulator();
    sim.reset();
    expect(sim.currTime).toBe(0);
  });

  test("momentAtTime", () => {
    const sim = new Simulator();
    const t1 = new ReplyLogger("t1");
    const send1 = new Send(t1, 10, new Address("a", "b"));
    sim.inject(send1);
    expect(sim.eventQueue.nextEventTime).toBe(10);
    // expect(() => sim.momentAtTime(5)).toThrowError("New message time in the past");
  });

  test("getNextMessage", () => {
    const sim = new Simulator();
    const t1 = new SendEchoer("t1");

    const send1 = new Send(t1, 0, new Address("a", "b"));
    const int1 = sim.requestInterruptIn(t1, 0);
    sim.inject(send1);

    expect(sim.eventQueue.getNextMessage()).toBe(int1);
    expect(sim.eventQueue.getNextMessage()).toBe(send1);
    expect(sim.eventQueue.getNextMessage()).toBe(null);
  });
});
