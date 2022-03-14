import { Link, System } from "../src/basic/base";
import { Request } from "../src/basic/request";
import { Server } from "../src/basic/component/server";
import { DBServer } from "../src/basic/component/storage/dbserver";
import { Call } from "../src/basic/instruction/call";
import { Forward } from "../src/basic/instruction/forward";
import { Series } from "../src/basic/instruction/series";

export function TinyURL(name = "TinyURL") {
  // Empty System
  const TinyUrl = new System(name);
  const tuweb = new Server("TUWeb");
  const tudb = new DBServer("TUDB");
  const link1 = new Link("link1");

  TinyUrl.add(tuweb);
  TinyUrl.add(tudb);
  TinyUrl.connect("TUWeb", "TUDB", link1);

  TinyUrl.on("*", new Forward("TUWeb"));
  tuweb.on("create", new Call(new Request("put"), "TUDB"));
  tuweb.on("resolve", new Call(new Request("get"), "TUDB"));
  return TinyUrl;
}

export function IdGen(name = "IdGen") {
  const IdGen = new System(name);
  const idgweb = new Server("IdgWeb");
  const idgdb = new DBServer("IdgDB");
  const link = new Link("link");

  IdGen.add(idgweb);
  IdGen.add(idgdb);
  IdGen.connect("IdgWeb", "IdgDB", link);

  IdGen.on("*", new Forward("IdgWeb"));
  idgweb.on("create", new Call(new Request("put"), "IdgDB"));
  return IdGen;
}

export function FullTinyURL(name = "FullTinyUrl") {
  // Empty System
  const TinyUrl = new System(name);
  const tuweb = new Server("TUWeb");
  const tudb = new DBServer("TUDB");
  const link1 = new Link("link");
  const link2 = new Link("link1");
  const idgen = IdGen();

  TinyUrl.add(tuweb);
  TinyUrl.add(tudb);
  TinyUrl.add(idgen);
  TinyUrl.connect("TUWeb", "TUDB", link1);
  TinyUrl.connect("TUWeb", idgen, link2);

  TinyUrl.on("*", new Forward("TUWeb"));
  tuweb.on("create", new Series(new Call(new Request("put"), "TUDB"), new Call(new Request("create"), idgen.name)));
  tuweb.on("resolve", new Call(new Request("get"), "TUDB"));

  return TinyUrl;
}
