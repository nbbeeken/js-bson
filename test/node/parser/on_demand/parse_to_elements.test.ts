import { isGeneratorFunction } from 'util/types';
import * as BSON from '../../../register-bson';
import { bufferFromHexArray } from '../../tools/utils';
import { ByteUtils } from '../../../../src/utils/byte_utils';
import { expect } from 'chai';

const bsonName = string =>
  BSON.BSONString.fromNullTerminatedBytes(ByteUtils.fromUTF8(`${string}\x00`), 0);

describe('parseToElements()', () => {
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

  it('is a generator function', () => {
    expect(isGeneratorFunction(BSON.parseToElements)).to.be.true;
  });

  it('returns elements for simple document', () => {
    const elements = Array.from(
      BSON.parseToElements(BSON.BSONDataView.fromUint8Array(nestedDocument))
    );

    expect(elements).to.have.lengthOf(1);
    expect(elements[0]).to.deep.equal({
      type: BSON.BSONType.object,
      name: bsonName('a'),
      offset: 7,
      length: 12
    });
  });

  it('returns elements for top level document', () => {
    const view = BSON.BSONDataView.fromUint8Array(nestedDocument);
    const elements = Array.from(BSON.parseToElements(view, 0));

    expect(elements).to.have.lengthOf(1);
    expect(elements[0]).to.deep.equal({
      type: BSON.BSONType.object,
      name: bsonName('a'),
      offset: 7,
      length: 12
    });

    const nestedElements = Array.from(BSON.parseToElements(view, elements[0].offset));
    expect(nestedElements[0]).to.deep.equal({
      type: BSON.BSONType.int,
      name: bsonName('b'),
      offset: 14,
      length: 4
    });
  });

  it('returns elements for simple document when offset', () => {
    const newSpaceBuffer = new ArrayBuffer(simpleDocument.byteLength + 21);
    const newSpace = new Uint8Array(newSpaceBuffer, 21, newSpaceBuffer.byteLength - 21);
    newSpace.set(simpleDocument, 0);
    const view = BSON.BSONDataView.fromUint8Array(newSpace);

    const elements = Array.from(BSON.parseToElements(view));

    expect(elements).to.have.lengthOf(1);
    expect(elements[0]).to.deep.equal({
      type: BSON.BSONType.long,
      name: bsonName('a'),
      offset: 7,
      length: 8
    });
  });

  it('returns code with scope', () => {
    const elements = Array.from(
      BSON.parseToElements(BSON.BSONDataView.fromUint8Array(codeTypeBSON))
    );

    expect(elements).to.have.lengthOf(1);
    expect(elements[0]).to.deep.equal({
      type: BSON.BSONType.javascript,
      name: bsonName('a'),
      offset: 7,
      length: 34
    });
  });
});
