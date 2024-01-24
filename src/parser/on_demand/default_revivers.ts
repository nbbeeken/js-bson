/* eslint-disable @typescript-eslint/no-explicit-any */
import { type BSONDataView } from '../../utils/data_view';
import { Code, isCodeWithScope } from '../../code';
import { type BSONString } from '../../string';
import { ByteUtils } from '../../utils/byte_utils';
import { isMap } from '../utils';
import { type BSONElement } from './parse_to_elements';
import { toType } from './type_decoders';

/**
 * **TODO** workshop typescript, needs mutal exclusion.
 * - First invocation will set element to null
 *   - author should use this condition to return root container
 * - All subsequent invocations will have non-null values for element
 *   - authors should use the element argument to determine how to decode the bson to a data structure
 */
export type BSONReviver = (
  bsonView: BSONDataView,
  container: unknown,
  element: BSONElement | null
) => any;

function safeDefineProperty(object: Record<string, unknown>, name: BSONString, value: unknown) {
  const key = name.toString();
  if (key.toString() === '__proto__') {
    Object.defineProperty(object, '__proto__', {
      writable: true,
      enumerable: true,
      configurable: true,
      value
    });
    return;
  }
  object[key] = value;
}

function getAssignmentFunction(container: unknown): (k: BSONString, v: any) => void {
  if (container == null || typeof container !== 'object') throw new Error();
  return Array.isArray(container)
    ? (_, v) => container.push(v)
    : isMap(container)
    ? (k, v) => container.set(k, v)
    : isCodeWithScope(container)
    ? (k, v) => getAssignmentFunction(container.scope)(k, v)
    : (k, v) => safeDefineProperty(container as Record<string, unknown>, k, v);
}

export const defaultReviver: BSONReviver = function defaultReviver(
  bsonView: BSONDataView,
  container: unknown,
  element: BSONElement | null
) {
  if (element == null) {
    // root
    return {};
  }

  if (element === null) throw new Error('unreachable... TODO TS.');

  const assign: (k: BSONString, v: any) => void = getAssignmentFunction(container);

  if (element.type === 3) {
    // document
    const document = {};
    assign(element.name, document);
    return document;
  }

  if (element.type === 4) {
    // array
    const array: unknown[] = [];
    assign(element.name, array);
    return array;
  }

  if (element.type === 15) {
    // code with scope
    const functionStringLength = bsonView.getSize(element.offset + 4) - 1;
    const start = element.offset + 4 + 4;
    const end = start + functionStringLength;
    const code = new Code(ByteUtils.toUTF8(bsonView.uint8Array, start, end, true), {});
    assign(element.name, code);
    return code;
  }

  assign(element.name, toType(bsonView, element));
  return container;
};
