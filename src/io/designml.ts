import { Nullable } from "../../src/types";
import parse from "parse-duration";
import { assert } from "../../src/utils/misc";
import { StrToDuration } from "../../src/utils/timeutils";
import { StrToSize } from "../../src/utils/sizes";
import { ensureAttr, getAttr, forEachChild } from "../../src/utils/dom";
import { ActorRef, Actor, System } from "../../src/actors/base";
import { Network } from "../../src/actors/network";
import { Busy } from "../../src/actors/busy";
import { Call } from "../../src/actors/call";
import { Decorator } from "../../src/actors/decorator";
import { Queue } from "../../src/actors/queue";
import { Timeout } from "../../src/actors/timeout";
import { Generator } from "../../src/actors/generator";
import { Router } from "../../src/actors/router";
import { DBNode, DBIndex, HashIndex, BTreeIndex, HeapFile, SortedFile } from "../../src/actors/dbnode";
import { Series } from "../../src/actors/series";
import { Parallel } from "../../src/actors/parallel";
import { LoadBalancer } from "../../src/actors/loadbalancer";

const elementProcessorMethods: { [key: string]: string } = {
  system: "processNetworkNode",
  network: "processNetworkNode",
  call: "processCallNode",
  queue: "processQueueNode",
  timeout: "processTimeoutNode",
  generator: "processGeneratorNode",
  series: "processSeriesNode",
  busy: "processBusyNode",
  disk: "processDiskNode",
  router: "processRouterNode",
  dbnode: "processDBNodeNode",
  btreeindex: "processBTreeIndexNode",
  hashindex: "processHashIndexNode",
  sortedfile: "processSortedFileNode",
  heapfile: "processHeapFileNode",
  parallel: "processParallelNode",
  loadbalancer: "processLoadBalancerNode",
};

const defaultSystemTagProcessors: any = {
  defs: "processDefsTagNode",
  use: "processUseTagNode",
  forward: "processForwardTagNode",
  connect: "processConnectTagNode",
};

const elementProcessors: { [key: string]: string } = {
  network: "NetworkNodeProcessor",
};

export class ModelLoader {
  private configs: any = {};
  private defs: any = {};
  private systemRoot: Network = new Network("root");

  constructor(configs?: any) {
    this.configs = configs || {};
  }

  static autoGenCounter = 0;
  private autoGenName(prefix: string) {
    return prefix + ++ModelLoader.autoGenCounter;
  }

  /**
   * Add a definition for a particular ID.  Definitions allow entries to
   * be referenced and reused without being duplicated.  Particularly useful
   * for pattern definitions for stroke and fill styles.
   *
   * @param {String}   id      ID of the entry being defined.
   * @param {Object}   value   Value of the entry being defined.
   * @returns {TypeOf<this>}   This instance.
   */
  setDef(actor: Actor, id: string, value: any) {
    actor.setDef(id, value);
    /*
    this.defs[actor.uuid] = this.defs[actor.uuid] || {};
    this.defs[actor.uuid][id] = value;
   */
  }

  /**
   * Returns the definition for a particular ID.
   * If the definition does not exist in this element, the parent (and so on) is looked
   * up until one is found or the root is reached.
   *
   * @param {String}  id  ID of the definition to be looked up.
   * @returns {Object}  Value of the definition within the closest ancestor, null if no entry found.
   */
  getDef(actor: Actor, id: string): any {
    return actor.getDef(id);
    /*
    while (true) {
      if (actor.uuid in this.defs && id in this.defs[actor.uuid]) {
        return this.defs[actor.uuid][id];
      } else if (actor.parent == null) {
        return null;
      } else {
        actor = actor.parent;
      }
    }
   */
  }

  processElement(root: Element, parent?: System): Nullable<Actor> {
    // Find the right "converter" for the root object
    const processor = this.getProcessorMethod(root.tagName);
    assert(processor != null, "Cannot find processor for node: " + root.tagName);
    return processor.bind(this)(root, parent || this.systemRoot);
  }

  getProcessorMethod(name: string) {
    const procName = elementProcessorMethods[name.toLowerCase()] as string;
    return (this as any)[procName] || null;
  }

  createActor<T extends Actor>(BC: any, parent: System, elem: Element, prefix: string, ...args: any): T {
    const name = getAttr(elem, "name") || this.autoGenName(prefix);
    const out = new BC(name, ...args) as T;
    this.initNode(out, parent, elem);
    return out;
  }

  initNode(node: Actor, parent: System, elem: Element): void {
    const vp = {} as any;
    vp.x = parseFloat(getAttr(elem, "x") || "0");
    vp.y = parseFloat(getAttr(elem, "y") || "0");
    vp.width = parseFloat(getAttr(elem, "width") || "0");
    vp.height = parseFloat(getAttr(elem, "height") || "0");
    vp.render = getAttr(elem, "render") || null;
    (node as any).viewParams = vp;
    node.parent = parent;
  }

  processGeneratorNode(elem: Element, parent: System): Actor {
    const out = this.createActor<Generator>(Generator, parent, elem, "call");
    const targetQPS = getAttr(elem, "targetQPS") || null;
    const rampRate = getAttr(elem, "rampRate") || null;
    if (targetQPS != null) out.targetQPS = parseInt(targetQPS);
    if (rampRate != null) out.rampRate = parseFloat(rampRate);
    forEachChild(elem, (child, _index) => {
      const tag = child.tagName.toLowerCase();
      if (tag != "traffic") throw new Error("Invalid tag: " + tag);
      const dest = ensureAttr(child, "dest");
      const method = ensureAttr(child, "method");
      const weight = parseInt(getAttr(child, "weight") || "1");
      out.add(dest, method, weight);
    });
    return out;
  }

  processCallNode(elem: Element, parent: System): Actor {
    const method = ensureAttr(elem, "method");
    const dest = ensureAttr(elem, "dest");
    const callLatency = getAttr(elem, "callLatency") || null;
    const out = this.createActor<Call>(Call, parent, elem, "call", dest, method);

    if (callLatency != null) out.callLatency = StrToDuration(callLatency);
    return out;
  }

  processBusyNode(elem: Element, parent: System): Actor {
    const out = this.createActor<Busy>(Busy, parent, elem, "busy");
    const waitTime = getAttr(elem, "waitTime") || null;
    const availability = getAttr(elem, "availability") || null;

    if (waitTime != null) out.waitTime = StrToDuration(waitTime);
    if (availability != null) out.availability = parseFloat(availability);
    return out;
  }

  // processDiskNode(elem: Element, parent: System): Actor {}
  processRouterNode(elem: Element, parent: System): Actor {
    const out = this.createActor<Router>(Router, parent, elem, "router");
    this.processSystemChildren(elem, out, defaultSystemTagProcessors, (actor, childElem) => {
      out.add(actor);
    });
    return out;
  }

  processDBNodeNode(elem: Element, parent: System): Actor {
    const out = this.createActor<DBNode>(DBNode, parent, elem, "db");
    const getLatency = getAttr(elem, "getLatency") || null;
    const putLatency = getAttr(elem, "putLatency") || null;
    if (getLatency != null) out.getLatency = StrToDuration(getLatency);
    if (putLatency != null) out.putLatency = parseFloat(putLatency);
    return out;
  }

  processDBIndexNode(node: DBIndex, elem: Element): Actor {
    const diskAccessTime = getAttr(elem, "diskAccessTime") || null;
    if (diskAccessTime != null) node.diskAccessTime = StrToDuration(diskAccessTime);
    const diskSize = getAttr(elem, "diskSize") || null;
    if (diskSize != null) node.diskSize = StrToSize(diskSize);
    const recordSize = getAttr(elem, "recordSize") || null;
    if (recordSize != null) node.recordSize = StrToSize(recordSize);
    const pageSize = getAttr(elem, "pageSize") || null;
    if (pageSize != null) node.pageSize = parseInt(pageSize);
    const recordProcessingTime = getAttr(elem, "recordProcessingTime") || null;
    if (recordProcessingTime != null) node.recordProcessingTime = parseInt(recordProcessingTime);
    return node;
  }

  processBTreeIndexNode(elem: Element, parent: System): Actor {
    const out = this.createActor<BTreeIndex>(BTreeIndex, parent, elem, "btree");
    return this.processDBIndexNode(out, elem);
  }

  processHashIndexNode(elem: Element, parent: System): Actor {
    const out = this.createActor<HashIndex>(HashIndex, parent, elem, "hash");
    return this.processDBIndexNode(out, elem);
  }

  processSortedFileNode(elem: Element, parent: System): Actor {
    const out = this.createActor<SortedFile>(SortedFile, parent, elem, "sortedfile");
    return this.processDBIndexNode(out, elem);
  }

  processHeapFileNode(elem: Element, parent: System): Actor {
    const out = this.createActor<HeapFile>(HeapFile, parent, elem, "heapfile");
    return this.processDBIndexNode(out, elem);
  }

  processLoadBalancerNode(elem: Element, parent: System): Actor {
    const out = this.createActor<LoadBalancer>(LoadBalancer, parent, elem, "lb");
    const forwardingLatency = getAttr(elem, "forwardingLatency") || null;
    if (forwardingLatency != null) out.forwardingLatency = StrToDuration(forwardingLatency);

    // now read targets
    forEachChild(elem, (child, _index) => {
      if (child.tagName.toLowerCase() == "target") {
        const targetName = ensureAttr(child, "name");
        out.add(targetName);
      }
    });
    return out;
  }
  processSeriesNode(elem: Element, parent: System): Actor {
    const out = this.createActor<Series>(Series, parent, elem, "series");
    this.processSystemChildren(elem, out, defaultSystemTagProcessors, (actor, childElem) => {
      out.push(actor);
    });
    return out;
  }

  processParallelNode(elem: Element, parent: System): Actor {
    const out = this.createActor<Parallel>(Parallel, parent, elem, "parallel");
    this.processSystemChildren(elem, out, defaultSystemTagProcessors, (actor, childElem) => {
      out.push(actor);
    });
    return out;
  }

  processNetworkNode(elem: Element, parent: System): Actor {
    const out = this.createActor<Network>(Network, parent, elem, "network");
    this.processSystemChildren(elem, out, defaultSystemTagProcessors, (actor, childElem) => {
      out.add(actor);
    });
    return out;
  }

  processSystemChildren(
    elem: Element,
    parent: System,
    tagProcessors: any,
    onActor: (actor: Actor, childElement: Element) => void,
  ) {
    forEachChild(elem, (child, index) => {
      const tag = child.tagName.toLowerCase();
      for (const tagName in tagProcessors) {
        if (tagName == tag) {
          const procName = tagProcessors[tagName];
          const procFunc = (this as any)[procName] || null;
          assert(procFunc != null, "Invalid Tag Processer: " + procName);
          const boundFunc = procFunc.bind(this);
          boundFunc(elem, parent, child, index, onActor);
          return;
        }
      }
      // we have a child actor so load and process it
      const actor = this.processElement(child, parent);
      if (actor == null) {
        throw new Error("Unable to load actor");
      }
      onActor(actor, child);
    });
  }

  createDecorator<T extends Decorator>(BC: any, parent: System, elem: Element, prefix: string, tagProcessors: any): T {
    const name = getAttr(elem, "name") || this.autoGenName(prefix);
    const out = new BC(name) as T;
    this.initNode(out, parent, elem);
    this.processSystemChildren(elem, out, tagProcessors, (actor, _childElem) => {
      out.target = actor;
    });
    return out;
  }

  processTimeoutNode(elem: Element, parent: System): Actor {
    const defaultTimeout = getAttr(elem, "defaultTimeout") || null;
    const out = this.createDecorator<Timeout>(Timeout, parent, elem, "timeout", {
      threshold: "processThresholdTagNode",
    });
    if (defaultTimeout != null) out.defaultTimeout = StrToDuration(defaultTimeout);
    return out;
  }

  processQueueNode(elem: Element, parent: System): Actor {
    const maxServers = getAttr(elem, "maxServers") || null;
    const maxQueueSize = getAttr(elem, "maxQueueSize") || null;
    const out = this.createDecorator<Queue>(Queue, parent, elem, "queue", {});

    if (maxServers != null) out.maxServers = parseInt(maxServers);
    if (maxQueueSize != null) out.maxQueueSize = parseInt(maxQueueSize);
    return out;
  }

  processDefsTagNode(
    elem: Element,
    parent: System,
    child: Element,
    _index: number,
    onActor: (actor: Actor, childElement: Element) => void,
  ) {
    // Instead of processing a child node - we just store the element as is
    // so we can process it again on use - this lets us do things like
    // setup viewParams and other things on a node which would otherwise
    // get lost if we create them now.
    forEachChild(child, (gchild, _index) => {
      const name = ensureAttr(gchild, "name");
      this.setDef(parent, name, gchild);
    });
  }

  processUseTagNode(
    elem: Element,
    parent: System,
    child: Element,
    _index: number,
    onActor: (actor: Actor, childElement: Element) => void,
  ) {
    const sourceRef = ensureAttr(child, "source");
    const newName = ensureAttr(child, "name");
    const actorElem = this.getDef(parent, sourceRef);
    actorElem.setAttribute("name", newName);
    const out = this.processElement(actorElem, parent);
    if (out == null) {
      throw new Error("Unable to process element.");
    }
    const newX = getAttr(child, "x") || null;
    const newY = getAttr(child, "y") || null;
    if (newX != null) {
      (out as any).viewParams.x = parseFloat(newX);
    }
    if (newY != null) {
      (out as any).viewParams.y = parseFloat(newY);
    }
    onActor(out, actorElem);
  }

  processForwardTagNode(
    elem: Element,
    parent: System,
    child: Element,
    _index: number,
    onActor: (actor: Actor, childElement: Element) => void,
  ) {
    const name = ensureAttr(child, "name");
    const target: ActorRef = ensureAttr(child, "to");
    const targetInput = getAttr(child, "method") || null;
    if ("forwardInput" in parent) {
      (parent["forwardInput"] as any)(name, target, targetInput);
    }
  }

  processConnectTagNode(
    elem: Element,
    parent: System,
    child: Element,
    _index: number,
    onActor: (actor: Actor, childElement: Element) => void,
  ) {
    // We are looking at connections - so get the "path" for this.
    // a connect needs 3 parts:
    // 1. Source Node
    // 2. Target Node
    // 3. "Side" from Source Node (Auto, Left, Top, Right, Bottom)
    // 4. "Side" on Target Node (Auto, Left, Top, Right, Bottom)
    // Using above we can draw the "connectors" going from
    // source to target
  }

  processThresholdTagNode(
    elem: Element,
    parent: System,
    child: Element,
    _index: number,
    onActor: (actor: Actor, childElement: Element) => void,
  ) {
    const dest = ensureAttr(child, "dest");
    const method = ensureAttr(child, "method");
    const time = parse(ensureAttr(child, "time"), "ns");
    if (time != null) {
      (parent as Timeout).addTimeout(dest, method, time);
    }
  }
}

/**
 * Utilities to load actors from a URL or an input stream.
 */
export function loadFromURL(
  url: string,
  configs: any,
  callback: (actor: Nullable<Actor>, element: Element) => void,
): void {
  url = url.trim();
  const startTime = Date.now();
  const loader = new ModelLoader(configs);
  $.get(url, function (data: any) {
    const result = loader.processElement(data.rootElement);
    result!.parent = null;
    const loadTime = Date.now() - startTime;
    console.log("Element loaded in: ", loadTime);
    callback(result, data.rootElement);
  });
}

export function loadFromString(input: string, configs: any = null): Nullable<Actor> {
  const domparser = new DOMParser();

  const doc = domparser.parseFromString(input, "text/xml");
  const loader = new ModelLoader();
  const result = loader.processElement(doc.documentElement);
  result!.parent = null;
  return result;
}
