import { ModelLoader, loadFromString } from "../designml";
import { Network } from "../../actors/network";
import { Busy } from "../../actors/busy";
import { Call } from "../../actors/call";
import { Router } from "../../actors/router";
import { DBNode } from "../../actors/dbnode";
import { Series } from "../../actors/series";
import { Parallel } from "../../actors/parallel";
import { LoadBalancer } from "../../actors/loadbalancer";

// Needed to run browser side items on node env
import { JSDOM } from "jsdom";
global.DOMParser = new JSDOM().window.DOMParser;
global.HTMLElement = new JSDOM().window.HTMLElement;

describe("Design ML Loader Tests", () => {
  test("getProcessorMethod", () => {
    expect(() =>
      loadFromString(`
      <hello name="test"/>
    `),
    ).toThrowError(new Error("Cannot find processor for node: hello"));
  });

  test("Test Defs", () => {
    const ml = new ModelLoader();
    const n1 = new Network("n1");
    const n2 = new Network("n2");
    ml.setDef(n1, "a", 1);
    ml.setDef(n2, "b", 2);
    expect(ml.getDef(n1, "a")).toBe(1);
    expect(ml.getDef(n2, "b")).toBe(2);
    expect(ml.getDef(n2, "a")).toBe(null);
    n1.add(n2);
    expect(ml.getDef(n2, "a")).toBe(1);
  });

  test("Network test should return Network with components", () => {
    const out = loadFromString(`
      <Network name="net1">
        <Busy name = "b1" waitTime = "90" />
        <Network name = "net2" >
          <Call name = "call1" method = "test" dest = "sometarget" />
        </Network>
      </Network>
    `) as Network;
    expect(out!.name).toBe("net1");
    expect(out!.childCount).toBe(2);
    expect((out!.get("b1") as Busy).waitTime).toBe(90);
    const net2 = out.get("net2") as Network;
    expect(net2!.childCount).toBe(1);
    const call = net2.get("call1") as Call;
    expect(call.address.method).toBe("test");
    expect(call.address.dest).toBe("sometarget");
  });

  test("processCallNode should return Call", () => {
    const out = loadFromString(`
      <Call method="get" dest="db1" callLatency = "50" />
    `) as Call;
    expect(out.address.method).toBe("get");
    expect(out.address.dest).toBe("db1");
    expect(out.callLatency).toBe(50);
  });

  test("processBusyNode should return Busy", () => {
    const out = loadFromString(`
      <Busy waitTime = "50" availability = "0.5" />
    `) as Busy;
    expect(out.waitTime).toBe(50);
    expect(out.availability).toBe(0.5);
  });

  test("processRouterNode should return Router", () => {
    const out = loadFromString(`
      <Router waitTime = "50" availability = "0.5" />
    `) as Router;
    expect(out).not.toBe(null);
  });

  test("processDBNodeNode should return DBNode", () => {
    const out = loadFromString(`
      <DBNode getLatency = "99" putLatency = "1234" />
    `) as DBNode;
    expect(out.getLatency).toBe(99);
    expect(out.putLatency).toBe(1234);
  });

  test("processLoadBalancerNode should return LoadBalancer", () => {
    const out = loadFromString(`
      <LoadBalancer forwardingLatency = "99" >
        <Target name = "s4" />
        <Target name = "s3" />
        <Target name = "s2" />
        <Target name = "s1" />
        <Target name = "s0" />
      </LoadBalancer>
    `) as LoadBalancer;
    expect(out.forwardingLatency).toBe(99);
    expect(out.targets.length).toBe(5);
    expect(out.targets[0]).toBe("s4");
    expect(out.targets[1]).toBe("s3");
    expect(out.targets[2]).toBe("s2");
    expect(out.targets[3]).toBe("s1");
    expect(out.targets[4]).toBe("s0");
  });

  test("processSeriesNode should return Series", () => {
    const out = loadFromString(`
      <Series forwardingLatency = "99" >
        <Busy weight = "40" waitTime = "10" />
        <Busy weight = "30" waitTime = "20" />
        <Busy weight = "20" waitTime = "30" />
        <Busy weight = "10" waitTime = "40" />
      </Series>
    `) as Series;
    expect(out.childCount).toBe(4);
    expect((out.childAt(0) as Busy).waitTime).toBe(10);
    expect((out.childAt(1) as Busy).waitTime).toBe(20);
    expect((out.childAt(2) as Busy).waitTime).toBe(30);
    expect((out.childAt(3) as Busy).waitTime).toBe(40);
  });

  test("processParallelNode should return Parallel", () => {
    const out = loadFromString(`
      <Parallel forwardingLatency = "99" >
        <Busy weight = "40" waitTime = "10" />
        <Busy weight = "30" waitTime = "20" />
        <Busy weight = "20" waitTime = "30" />
        <Busy weight = "10" waitTime = "40" />
      </Parallel>
    `) as Parallel;
    expect(out.childCount).toBe(4);
    expect((out.childAt(0) as Busy).waitTime).toBe(10);
    expect((out.childAt(1) as Busy).waitTime).toBe(20);
    expect((out.childAt(2) as Busy).waitTime).toBe(30);
    expect((out.childAt(3) as Busy).waitTime).toBe(40);
  });
});
