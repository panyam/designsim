import { Nullable } from "../types";
import { Actor, System } from "./base";
import { Property } from "../utils/properties";

export function pathUntil(start: Actor, end: Nullable<Actor> = null): string {
  let curr: any = start;
  let out = "";
  while (curr != end) {
    if (out != "") out = "." + out;
    out = curr.name + out;
    if (curr.parent == null) break;
    curr = curr.parent;
  }
  return out;
}

export function actorByPath(root: Actor, parts: string[], start = 0, end = -1): Nullable<Actor> {
  let curr: Nullable<Actor> = root;
  if (end < 0) end += parts.length;
  for (let i = start; i <= end; i++) {
    if (curr instanceof System) {
      curr = curr.get(parts[i]);
    } else {
      return null;
    }
  }
  return curr;
}

export function propertyByPath(root: Actor, propertyPath: string): [Nullable<Actor>, Nullable<Property>] {
  const parts = propertyPath.split(".");
  const actor = actorByPath(root, parts, 0, -2);
  let property: Nullable<Property> = null;
  if (actor != null) {
    property = actor.getProperty(parts[parts.length - 1]);
  }
  return [actor, property];
}
