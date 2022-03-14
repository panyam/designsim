import { Nullable } from "../types";
import { ActorRef, World, Actor, System } from "./base";
import { Address, Send } from "./message";
import { assert } from "../utils/misc";

export class Network extends System {
  // The list of child actors in this system.  A actor can only
  // belong to one System
  private children = new Map<string, Actor>();

  /**
   * List of forwards to help us route messages
   */
  forwards: { input: string; target: Actor; targetInput: Nullable<string> }[] = [];

  /**
   * Setup a forwarding rule for a method by the given name to a
   * method in a target within this child.
   */
  forwardInput(input: string, target: ActorRef, targetInput: Nullable<string> = null) {
    if (typeof target === "string") {
      if (!this.has(target)) {
        throw new Error("Cannot find child actor: " + target);
      }
      target = this.get(target)!;
    } else if (target.parent != this) {
      throw new Error(target.name + " is not a child");
    }
    this.forwards.push({
      input: input,
      target: target,
      targetInput: targetInput,
    });
  }

  /**
   * Get a child actor by its name if it exists.
   */
  get(name: string): Nullable<Actor> {
    return this.children.get(name) || null;
  }

  /**
   * Returns the number of children in this system.
   */
  get childCount(): number {
    return this.children.size;
  }

  getChildren(): IterableIterator<Actor> {
    return this.children.values();
  }

  /**
   * Tells if this sytem has a child by name or instance.
   */
  has(child: ActorRef): boolean {
    if (typeof child !== "string") child = child.name;
    return this.children.has(child);
  }

  /**
   * Adds a new actor to this sytem.
   * If another actor (with the same name) already exists or if the
   * actor is an ancestor of this sytem then an Exception is thrown.
   */
  add(child: Actor) {
    this.validateChildBeforeAdding(child);
    child.parent = this;
    this.children.set(child.name, child);
  }

  remove(child: Actor): boolean {
    const name = child.name;
    if (child.parent != this) return false;
    child.parent = null;
    this.children.delete(name);

    // Remove all outgoing edges from the child
    this.removeConnections(name);
    return true;
  }

  /**
   * Clones this System along with all its children and its linkecionts.
   */
  copyTo(out: this) {
    for (const [name, child] of this.children) {
      out.add(child.clone(name));
    }
    this.copyConnections(out);
  }

  routeSendToChild(send: Send, world: World): boolean {
    for (const forward of this.forwards) {
      if (forward.input == "*" || forward.input == send.address.method) {
        // found a match
        const newMethod = forward.targetInput || send.address.method;
        const next = send.spawn(this, world.currTime, new Address(send.address.dest, newMethod));
        next.setNextActor(forward.target);
        this.forwardSend(next, world);
        return true;
      }
    }
    return false;
  }

  // Maintains the connection between two actors within this System.
  // private connections: StringMap<StringMap<boolean>> = {};

  removeConnections(name: string) {
    /*
    delete this.connections[name];

    // Remove all incoming edges to the child
    for (const source in this.connections) {
      const srcmap = this.connections[source];
      if (name in srcmap) {
        delete srcmap[name];
      }
    }
    */
  }

  copyConnections(out: this) {
    /*
    for (const source in this.connections) {
      const srcmap = this.connections[source];
      out.connections[source] = {};
      for (const dest in srcmap) {
        if (srcmap[dest]) {
          out.connections[source][dest] = true;
        }
      }
    }
 */
  }

  /**
   * Adds a new link to this sytem between two actors.
   * If a link between the two actor already exists then an error is
   * thrown.
   */
  /*
  connect(source: string, dest: string, bidir = true) {
    if (source == dest) {
      if (source == "") {
        throw new Error("Links cannot 'short circuit' a System");
      } else {
        throw new Error(`Cannot link a Actor (${source}) to itself`);
      }
    }
    if (source != "" && !this.children.has(source)) {
      throw new Error("Source is not a child of this System");
    }
    if (dest != "" && !this.children.has(dest)) {
      throw new Error("Dest is not a child of this System");
    }
    this.connections[source] = this.connections[source] || {};
    this.connections[source][dest] = true;
    if (bidir) {
      this.connections[dest] = this.connections[dest] || {};
      this.connections[dest][source] = true;
    }
  }
 */

  /**
   * Remove the connection between a source and destination actor.
   */
  /*
  disconnect(source: string, dest: string, bidir = true) {
    delete (this.connections[source] || {})[dest];
    if (bidir) {
      this.disconnect(dest, source, false);
    }
  }
 */

  /**
   * Tells if there is a connection from a source actor to a destination
   * actor.
   */
  /*
  isConnected(src: string, dest: string): boolean {
    return (this.connections[src] || {})[dest] || false;
  }
 */
}
