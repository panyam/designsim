import * as fs from "fs";
import { Nullable } from "../../types";
import { Actor } from "../../actors/base";
import { ModelLoader, loadFromString } from "../designml";

export function loadFromPath(path: string, configs: any = null): Nullable<Actor> {
  const contents = fs.readFileSync(path).toString();
  return loadFromString(contents, configs);
}
