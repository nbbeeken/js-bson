import { isGeneratorFunction } from 'util/types';
import * as BSON from '../../../register-bson';
import { bufferFromHexArray } from '../../tools/utils';
import { ByteUtils } from '../../../../src/utils/byte_utils';
import { expect } from 'chai';

const bsonName = string =>
  BSON.BSONString.fromNullTerminatedBytes(ByteUtils.fromUTF8(`${string}\x00`), 0);

describe('parseToNestedStructure()', () => {
  // { a: new Long(1) }
  const simpleDocument = bufferFromHexArray([
    '12', // int64
    '6100', // 'a' key with null terminator
    '0100000000000000'
  ]);

  // { a: { b: new Int32(2) } }
  const nestedDocument = bufferFromHexArray([
    '03', // doc type
    '6100', // 'a' & null
    // nested document
    bufferFromHexArray([
      '10', // int32 type
      '6200', // 'b' & null
      '02000000' // LE 32bit 2
    ]).toString('hex')
  ]);

  const codeTypeBSON = bufferFromHexArray([
    '0D', // javascript type
    '6100', // 'a\x00'
    // 29 chars + null byte
    '1E000000',
    Buffer.from('function iLoveJavascript() {}\x00', 'utf8').toString('hex')
  ]);

  it('is not a generator function', () => {
    expect(isGeneratorFunction(BSON.parseToNestedStructure)).to.be.false;
  });

  it('returns elements for simple document', () => {
    const document = BSON.parseToNestedStructure(simpleDocument);
    expect(document).to.deep.equal({ a: 1 });
  });

  it('returns nested elements', () => {
    const elements = BSON.parseToNestedStructure(nestedDocument);
    expect(elements).to.deep.equal({ a: { b: 2 } });
  });
});
