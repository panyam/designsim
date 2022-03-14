import { Processor, World } from "./base";
// import { QueuingProcessor } from "./queuing";
import { Send } from "./message";
import { property } from "../utils/properties";
import { Millis } from "../utils/timeutils";
import { KiloBytes, GigaBytes } from "../utils/sizes";

export class DBNode extends Processor {
  /**
   * How long does it take to forward a message?
   */
  @property({ defaultValue: Millis(50), minValue: 0, units: "ns" })
  putLatency: number = Millis(50);

  /**
   * How long does it take to forward a message?
   */
  @property({ defaultValue: Millis(10), minValue: 0, units: "ns" })
  getLatency: number = Millis(10);

  // Fraction of requests that can fail
  @property({ defaultValue: 0, minValue: 0, maxValue: 100, units: "%" })
  failureRate = 0;

  /**
   * Called to handle another message.
   * This Actor can either ignore this message, do something with it
   * and/or even create new messages for the future.
   */
  processSend(send: Send, world: World) {
    if (world.random(1000000) < this.failureRate * 10000) {
      this.replyToSend(send, world, 0, "Random Failure");
    } else if (send.address.method == "get") {
      this.replyToSend(send, world, this.getLatency);
    } else if (send.address.method == "put") {
      this.replyToSend(send, world, this.putLatency);
    } else {
      // invalid send
      this.replyToSend(send, world, 0, "Invalid method: " + send.address.method);
    }
  }
}

/**
 * Models DB indexes based on the cost model from Raghu Ramakrishnan's
 * Database Management Systems book.
 */
export abstract class DBIndex extends Processor {
  // Time to read one actor/record of data (~4kb) in ms
  @property({ defaultValue: Millis(10) })
  diskAccessTime: number = Millis(10);

  /**
   * Size of the disk hosting this index in kilobytes
   */
  @property()
  diskSize: number = GigaBytes(10);

  /**
   * Size of a page hosting a set of records this index in kilobytes
   */
  @property()
  pageSize: number = KiloBytes(1024);

  /**
   * Size of each record being hosted in the index.
   */
  @property()
  recordSize: number = KiloBytes(1);

  /**
   * Cost of processing a record of data once in memory.
   */
  @property()
  recordProcessingTime = 10; // nano seconds

  /**
   * Tells how many records currently exist on this index.
   */
  @property()
  currRecordCount = 0;

  /**
   * Tells how much overhead to leave in a page for indexes that need
   * a lot of updates.  Amount of free space is 1 - pageOccpancyRate.
   */
  @property()
  pageOccupancyRate = 0.67;

  /**
   * Number of records in a page.
   * So numRecordsPerPage = sizeof(Page) / sizeof(Record);
   */
  get recordsPerPage(): number {
    return Math.ceil(this.pageSize / this.recordSize);
  }

  /**
   * Maximum number of pages on the disk.
   */
  get maxNumPages(): number {
    return Math.floor(this.diskSize / this.pageSize);
  }

  /**
   * Maximum number of records that can be held.
   */
  get maxRecords(): number {
    return this.maxNumPages * this.recordsPerPage;
  }

  /**
   * Tells if the index is full and out of capacity.
   */
  get isFull(): boolean {
    return this.currRecordCount >= this.maxRecords;
  }

  get currNumPages(): number {
    return Math.ceil(this.currRecordCount / (this.recordsPerPage * this.pageOccupancyRate));
  }

  abstract rangeSearchLatency(numRecords: number): number;
  abstract get equalitySearchLatency(): number;
  abstract get scanLatency(): number;
  abstract get insertLatency(): number;
  abstract get deleteLatency(): number;

  /**
   * Called to handle another message.
   * This Actor can either ignore this message, do something with it
   * and/or even create new messages for the future.
   */
  processSend(send: Send, world: World): void {
    if (send.address.method == "insert") {
      this.replyToSend(send, world, this.insertLatency);
      if (this.currRecordCount < this.maxRecords) {
        this.currRecordCount++;
        this.recordAdded();
      }
    } else if (send.address.method == "deleteByOffset") {
      this.replyToSend(send, world, this.deleteLatency);
      if (this.currRecordCount > 1) {
        this.currRecordCount--;
        this.recordDeleted();
      }
    } else if (send.address.method == "scan") {
      this.replyToSend(send, world, this.scanLatency);
    } else if (send.address.method == "findEquals") {
      this.replyToSend(send, world, this.equalitySearchLatency);
    } else if (send.address.method == "rangeSearch") {
      this.replyToSend(send, world, this.rangeSearchLatency(1));
    } else {
      // invalid send
      this.replyToSend(send, world, 0, "Invalid method: " + send.address.method);
    }
  }

  recordAdded() {
    // Do nothing.
  }

  recordDeleted() {
    // Do nothing.
  }
}

export class HeapFile extends DBIndex {
  get scanLatency(): number {
    return this.currNumPages * this.diskAccessTime;
  }

  get equalitySearchLatency(): number {
    return (this.currNumPages * this.diskAccessTime) >> 1;
  }

  rangeSearchLatency(numRecords = 1): number {
    return this.currNumPages * this.diskAccessTime;
  }

  get insertLatency(): number {
    return 2 * this.diskAccessTime;
  }

  get deleteLatency(): number {
    return 2 * this.diskAccessTime;
  }
}

function log2(val: number): number {
  let count = 0;
  while (val > 0) {
    val >>= 1;
    count++;
  }
  return Math.max(1, count);
}

export class SortedFile extends DBIndex {
  get scanLatency(): number {
    return this.currNumPages * this.diskAccessTime;
  }

  get equalitySearchLatency(): number {
    return this.diskAccessTime * log2(this.currNumPages);
  }

  rangeSearchLatency(numRecords = 1): number {
    return this.diskAccessTime * (numRecords + log2(this.currNumPages));
  }

  get insertLatency(): number {
    return (
      this.equalitySearchLatency +
      this.currNumPages * (this.diskAccessTime + this.recordsPerPage * this.recordProcessingTime)
    );
  }

  get deleteLatency(): number {
    return (
      this.equalitySearchLatency +
      this.currNumPages * (this.diskAccessTime + this.recordsPerPage * this.recordProcessingTime)
    );
  }
}

const LOGF = Math.log2(100);
export class BTreeIndex extends DBIndex {
  // log (Num Records, Base F)
  private fanoutFactor = 4;

  recordAdded(): void {
    this.fanoutFactor = Math.log2(this.currNumPages) / LOGF;
  }

  recordDeleted(): void {
    this.fanoutFactor = Math.log2(this.currNumPages) / LOGF;
  }

  get scanLatency(): number {
    return this.currNumPages * this.diskAccessTime;
  }

  get equalitySearchLatency(): number {
    return this.diskAccessTime * (1 + this.fanoutFactor);
  }

  rangeSearchLatency(numRecords = 1): number {
    return this.diskAccessTime * (numRecords + this.fanoutFactor);
  }

  get insertLatency(): number {
    return (
      this.equalitySearchLatency +
      this.currNumPages * (this.diskAccessTime + this.recordsPerPage * this.recordProcessingTime)
    );
    return this.diskAccessTime * (3 + this.fanoutFactor);
  }

  get deleteLatency(): number {
    return this.equalitySearchLatency + 2 * this.diskAccessTime;
  }
}

export class HashIndex extends DBIndex {
  occupancyRate = 0.67;

  get scanLatency(): number {
    return this.currNumPages * this.diskAccessTime;
  }

  get equalitySearchLatency(): number {
    return 2 * this.diskAccessTime;
  }

  rangeSearchLatency(numRecords = 1): number {
    return this.diskAccessTime * this.currNumPages;
  }

  get insertLatency(): number {
    return 4 * this.diskAccessTime;
  }

  get deleteLatency(): number {
    return this.equalitySearchLatency + 2 * this.diskAccessTime;
  }
}
