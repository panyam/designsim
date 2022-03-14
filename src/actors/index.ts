import * as Core from "./base";
import * as Messages from "./message";
import { Busy } from "./busy";
import { Call } from "./call";
import { DBNode } from "./dbnode";
import { LoadBalancer } from "./loadbalancer";
import { Router } from "./router";
import { Series } from "./series";
import { Parallel } from "./parallel";
import { Storage } from "./storage";

export default {
  Core: Core,
  Messages: Messages,
  Bundle: {
    Busy: Busy,
    Call: Call,
    DBNode: DBNode,
    LoadBalancer: LoadBalancer,
    Router: Router,
    Series: Series,
    Parallel: Parallel,
    Storage: Storage,
  },
};
