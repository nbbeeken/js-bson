import { BSONValue } from './bson_value';
import { BSONParseError } from './error';
import { type InspectFn, defaultInspect } from './parser/utils';
import { ByteUtils } from './utils/byte_utils';

const hasOwn = (o: object, p: string) => Object.prototype.hasOwnProperty.call(o, p);
const defineReadonlyOwn = (o: BSONString, p: 'string' | 'utf8', value: string | Uint8Array) =>
  Object.defineProperty(o, p, {
    writable: false,
    configurable: true,
    enumerable: true,
    value
  });

/** @public */
export class BSONString extends BSONValue {
  get _bsontype() {
    return 'BSONString';
  }

  get utf8(): Uint8Array {
    if (hasOwn(this, 'utf8')) return this.utf8;
    defineReadonlyOwn(this, 'utf8', ByteUtils.fromUTF8(this.string));
    return this.utf8;
  }

  get string(): string {
    if (hasOwn(this, 'string')) return this.string;
    defineReadonlyOwn(this, 'string', ByteUtils.toUTF8(this.utf8, 0, this.utf8.byteLength, false));
    return this.string;
  }

  constructor(string?: string);
  constructor(utf8: Uint8Array);
  constructor(utf8OrString: Uint8Array | string = '') {
    super();
    defineReadonlyOwn(this, typeof utf8OrString === 'string' ? 'string' : 'utf8', utf8OrString);
  }

  static fromNullTerminatedBytes(utf8: Uint8Array, byteOffset: number) {
    let nullTerminatorOffset = byteOffset;
    for (; (utf8[nullTerminatorOffset] ?? 0x00) !== 0x00; nullTerminatorOffset += 1);
    if (nullTerminatorOffset === utf8.byteLength) throw new BSONParseError('cstring overflow');
    return new BSONString(utf8.subarray(byteOffset, nullTerminatorOffset));
  }

  [Symbol.toPrimitive](hint: 'number' | 'string' | 'default'): string | number {
    return hint === 'number' ? Number(this.toString()) : this.toString();
  }

  valueOf(): string {
    return this.toString();
  }

  toString(): string {
    return this.string;
  }

  inspect(depth?: number, options?: unknown, inspect?: InspectFn) {
    inspect ??= defaultInspect;
    return hasOwn(this, 'string')
      ? `new BSONString(${inspect(this.string, options)})`
      : `BSONString(byteLength: ${this.utf8.byteLength})`;
  }

  toExtendedJSON(): string {
    return this.toString();
  }
}
