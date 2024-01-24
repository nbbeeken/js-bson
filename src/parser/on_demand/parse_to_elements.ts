import { BSONParseError } from '../../error';
import { type BSONString } from '../../string';
import { type BSONDataView } from '../../utils/data_view';

/** @public */
export type BSONElement = {
  type: number;
  name: BSONString;
  offset: number;
  length: number;
};

/** @public */
export function* parseToElements(
  bsonView: BSONDataView,
  startOffset = 0
): Generator<BSONElement, void, void> {
  if (bsonView.byteLength < 5) {
    throw new BSONParseError(`Input must be at least 5 bytes, got ${bsonView.byteLength} bytes`);
  }

  const documentSize = bsonView.getSize(startOffset);

  if (documentSize > bsonView.byteLength - startOffset) {
    throw new BSONParseError(
      `Parsed documentSize (${documentSize} bytes) does not match input byteLength (${bsonView.byteLength} bytes)`
    );
  }

  let offset = startOffset + 4;

  while (offset <= documentSize + startOffset) {
    const type = bsonView.uint8Array[offset];
    offset += 1;

    if (type === 0) {
      if (offset - startOffset !== documentSize) {
        throw new BSONParseError(`At ${offset} found invalid 0x00 type byte`);
      }
      return;
    }

    const name = bsonView.getCString(offset);
    offset += name.utf8.byteLength + 1;

    let length = -1;
    // double, date, long, timestamp
    if (type === 1 || type === 9 || type === 18 || type === 17) length = 8;
    else if (type === 16) length = 4; // int
    else if (type === 7) length = 12; // objectId
    else if (type === 19) length = 16; // decimal128
    else if (type === 8) length = 1; // boolean
    else if (type === 10 || type === 6 || type === 127 || type === 255) length = 0; // null, undefined, maxKey, minKey

    if (length === -1) {
      // Needs a size calculation
      if (type === 11) {
        // regex
        const patternString = bsonView.getCString(offset);
        length = patternString.utf8.byteLength + 1;
        const flagsString = bsonView.getCString(length + offset);
        length += flagsString.utf8.byteLength + 1;
      } else if (type === 3 || type === 4 || type === 15) {
        // object, array, code_w_scope
        length = bsonView.getSize(offset);
      } else {
        length = bsonView.getSize(offset) + 4;
        if (type === 5) length += 1; // binary subtype
        if (type === 12) length += 12; // dbPointer
      }
    }

    yield { type, name, offset, length };
    offset += length;
  }
}
