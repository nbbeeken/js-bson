import { Binary } from '../../binary';
import { Code } from '../../code';
import { BSONType as MQLBSONType } from '../../constants';
import { DBRef } from '../../db_ref';
import { Decimal128 } from '../../decimal128';
import { Double } from '../../double';
import { BSONParseError } from '../../error';
import { Int32 } from '../../int_32';
import { Long } from '../../long';
import { MaxKey } from '../../max_key';
import { MinKey } from '../../min_key';
import { ObjectId } from '../../objectid';
import { BSONRegExp } from '../../regexp';
import { Timestamp } from '../../timestamp';
import { ByteUtils } from '../../utils/byte_utils';
import { type BSONDataView } from '../../utils/data_view';
import { type BSONElement } from './parse_to_elements';

// Fix minKey to be unsigned.
const BSONType = { ...MQLBSONType, minKey: 255 };

/**
 * Corpus Defaults:
 * - `promoteBuffers = false;`
 * - `promoteLongs   = true;`
 * - `promoteValues  = false;`
 * - `useBigInt64    = false;`
 * - `bsonRegExp     = true;`
 * - `validation     = { utf8: true };`
 */
export function toType(bsonView: BSONDataView, element: BSONElement) {
  switch (true) {
    case element.type === BSONType.double:
      return new Double(bsonView.getFloat64(element.offset, true));

    case element.type === BSONType.long: {
      const value = bsonView.getBigInt64(element.offset, true);
      return new Long(value);
    }

    case element.type === BSONType.timestamp: {
      const value = bsonView.getBigInt64(element.offset, true);
      return new Timestamp(value);
    }

    case element.type === BSONType.date: {
      return new Date(Number(bsonView.getBigInt64(element.offset, true)));
    }

    case element.type === BSONType.int:
      return new Int32(bsonView.getInt32(element.offset, true));

    case element.type === BSONType.bool: {
      const booleanInt = bsonView.getUint8(element.offset);
      if (booleanInt === 1) return true;
      else if (booleanInt === 0) return false;
      else throw new BSONParseError(`boolean cannot be a value other than 1 or 0: ${booleanInt}`);
    }

    case element.type === BSONType.decimal:
      return new Decimal128(bsonView.uint8Array.subarray(element.offset, element.offset + 16));

    case element.type === BSONType.objectId:
      return new ObjectId(bsonView.uint8Array.subarray(element.offset, element.offset + 12));

    case element.type === BSONType.null:
    case element.type === BSONType.undefined:
      return null;

    case element.type === BSONType.symbol: {
      const start = element.offset + 4;
      const end = start + bsonView.getSize(element.offset) - 1;
      return ByteUtils.toUTF8(bsonView.uint8Array, start, end, false);
    }

    case element.type === BSONType.string: {
      const start = element.offset + 4;
      const end = start + bsonView.getSize(element.offset) - 1;
      return ByteUtils.toUTF8(bsonView.uint8Array, start, end, false);
    }

    case element.type === BSONType.javascript: {
      const start = element.offset + 4;
      const end = start + bsonView.getSize(element.offset) - 1;
      // TODO should be validated string
      return new Code(ByteUtils.toUTF8(bsonView.uint8Array, start, end, false));
    }

    case element.type === BSONType.minKey:
      return new MinKey();
    case element.type === BSONType.maxKey:
      return new MaxKey();

    case element.type === BSONType.binData: {
      const totalBinarySize = bsonView.getSize(element.offset);
      const subType = bsonView.getUint8(element.offset + 4);

      if (subType === 2) {
        const subType2BinarySize = bsonView.getSize(element.offset + 1 + 4);
        if (subType2BinarySize < 0)
          throw new BSONParseError('Negative binary type element size found for subtype 0x02');
        if (subType2BinarySize > totalBinarySize - 4)
          throw new BSONParseError('Binary type with subtype 0x02 contains too long binary size');
        if (subType2BinarySize < totalBinarySize - 4)
          throw new BSONParseError('Binary type with subtype 0x02 contains too short binary size');
        return new Binary(
          bsonView.uint8Array.subarray(
            element.offset + 1 + 4 + 4,
            element.offset + 1 + 4 + 4 + subType2BinarySize
          ),
          2
        );
      }

      return new Binary(
        Uint8Array.prototype.slice.call(
          bsonView.uint8Array,
          element.offset + 1 + 4,
          element.offset + 1 + 4 + totalBinarySize
        ),
        subType
      );
    }

    case element.type === BSONType.regex: {
      const patternString = bsonView.getCString(element.offset);
      const flagsString = bsonView.getCString(patternString.utf8.byteLength + 1 + element.offset);
      return new BSONRegExp(patternString.toString(), flagsString.toString());
    }

    case element.type === BSONType.dbPointer: {
      const stringLength = bsonView.getSize(element.offset);
      const oidStart = element.offset + 4 + stringLength;
      const start = element.offset + 4;
      const end = start + stringLength - 1;
      // TODO should be validated string
      const ref = ByteUtils.toUTF8(bsonView.uint8Array, start, end, false);
      const oid = new ObjectId(bsonView.uint8Array.subarray(oidStart, oidStart + 12));
      return new DBRef(ref, oid);
    }

    // Types that should never enter this function:
    case element.type === BSONType.object:
    case element.type === BSONType.array:
    case element.type === BSONType.javascriptWithScope:
      throw new Error('containers should not be handled here.');
    default:
      throw new Error(`unsupported type: ${element.type}`);
  }
}
