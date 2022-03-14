import { Message, Send, Reply } from "./message";
import { World, Actor } from "./base";
import { Network } from "./network";
import { assert } from "../utils/misc";

/**
 * A system that only handles API requests.
 */
export class Router extends Network {
  public add(child: Actor): this {
    super.add(child);
    this.forwardInput(child.name, child);
    return this;
  }
}
