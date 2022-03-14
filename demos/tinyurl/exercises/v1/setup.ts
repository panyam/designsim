import ExercisePage from "../../../uilib/ExercisePage";
import { DBIndex } from "../../../../src/actors/dbnode";
import { Send, Reply } from "../../../../src/actors/message";
import { assert } from "../../../../src/utils/misc";

export function Setup(page: ExercisePage): void {
  const exercise = page.getExercise("basicV1");
  const generator = exercise.actorByPath("Client.Gen");
  const dbnode = exercise.actorByPath("TinyURL.TUDB");
  const readQPS = exercise.getMetrics("readQPS");
  const readTimeouts = exercise.getMetrics("readTimeouts");
  const writeQPS = exercise.getMetrics("writeQPS");
  const writeTimeouts = exercise.getMetrics("writeTimeouts");
  const readLatencies = exercise.getMetrics("readLatencies");
  const writeLatencies = exercise.getMetrics("writeLatencies");
  const dbGetLatencies = exercise.getMetrics("dbGetLatencies");
  const dbPutLatencies = exercise.getMetrics("dbPutLatencies");

  exercise.simulator.sendProcessed = (send: Send): void => {
    if (send.source == generator) {
      if (send.address.method == "create") {
        writeQPS.add(send.time);
      } else {
        readQPS.add(send.time);
      }
    }
  };

  exercise.simulator.replyProcessed = (reply: Reply): void => {
    if (reply.source == dbnode) {
      const timeTaken = (reply.time - reply.responseTo.time) / 1000000.0;
      const send = reply.responseTo;
      if (send.address.method == "get") {
        dbGetLatencies.add(reply.time, timeTaken);
      } else if (send.address.method == "put") {
        dbPutLatencies.add(reply.time, timeTaken);
      }
    } else if (reply.nextActor == generator) {
      const timeTaken = (reply.time - reply.responseTo.time) / 1000000.0;
      const send = reply.responseTo;
      if (send.address.method == "create") {
        if (reply.isError) writeTimeouts.add(reply.time);
        writeLatencies.add(reply.time, timeTaken);
      } else {
        if (reply.isError) readTimeouts.add(reply.time);
        readLatencies.add(reply.time, timeTaken);
      }
    }
  };

  exercise.customPropertyChanged = (name: string, value: number): boolean => {
    assert(exercise.system != null, "System MUST exist");
    if (name == "updateDiskAccessTime") {
      const TinyURLTable = exercise.actorByPath("TinyURL.TUDB.DBNode.TinyURLTable");
      const PKeyIndex = exercise.actorByPath("TinyURL.TUDB.DBNode.PKeyIndex");
      const LongURLIndex = exercise.actorByPath("TinyURL.TUDB.DBNode.LongURLIndex");

      (TinyURLTable as DBIndex).diskAccessTime = value;
      (PKeyIndex as DBIndex).diskAccessTime = value;
      (LongURLIndex as DBIndex).diskAccessTime = value;
      return true;
    }
    return false;
  };

  // setup
  // basic
}
