import { BSONError } from '../error';
import { BSONString } from '../string';

/** @public */
export class BSONDataView extends DataView {
  uint8Array: Uint8Array;

  private constructor(input: Uint8Array) {
    super(input.buffer, input.byteOffset, input.byteLength);
    this.uint8Array = input;
  }

  static fromUint8Array(input: Uint8Array): BSONDataView {
    return new BSONDataView(input);
  }

  /** Gets a little-endian int 32 and validates that it is positive */
  getSize(byteOffset: number) {
    const int32 = this.getInt32(byteOffset, true);
    if (int32 < 0) {
      throw new BSONError(`BSON size cannot be negative: ${int32} at ${byteOffset}`);
    }
    return int32;
  }

  getCString(byteOffset: number): BSONString {
    return BSONString.fromNullTerminatedBytes(this.uint8Array, byteOffset);
  }
}
