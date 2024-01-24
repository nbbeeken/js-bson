import { BSONDataView } from '../../utils/data_view';
import { defaultReviver, type BSONReviver } from './default_revivers';
import { type BSONElement, parseToElements } from './parse_to_elements';

type ParseContext = {
  generator: Generator<BSONElement>;
  destination: unknown;
  previous: ParseContext | null;
};

/** @public */
export function parseToNestedStructure<TRoot = Record<string, unknown>>(
  bytes: Uint8Array,
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  reviver: BSONReviver = defaultReviver as any
): TRoot {
  const bsonView = BSONDataView.fromUint8Array(bytes);
  const root: TRoot = reviver(bsonView, null, null);
  let ctx: ParseContext | null = {
    generator: parseToElements(bsonView, 0),
    destination: root,
    previous: null
  };

  nestedContext: while (ctx !== null) {
    let it = ctx.generator.next();
    while (!it.done) {
      if (it.value.type === 3 || it.value.type === 4 || it.value.type === 15) {
        let generator;
        if (it.value.type === 15) {
          const codeStringSize = bsonView.getSize(it.value.offset + 4);
          const scopeByteOffset = it.value.offset + codeStringSize + 4 + 4;
          generator = parseToElements(bsonView, scopeByteOffset);
        } else {
          generator = parseToElements(bsonView, it.value.offset);
        }

        ctx = {
          generator,
          destination: reviver(bsonView, ctx.destination, it.value),
          previous: ctx
        };

        // NOTE: we can instead set a boolean that skips `ctx = ctx.previous` when we make a new ctx `isNewCtx`
        // the boolean would need to be reset on every iteration `isNewCtx = false`
        continue nestedContext;
      } else {
        reviver(bsonView, ctx.destination, it.value);
      }
      it = ctx.generator.next();
    }
    ctx = ctx.previous;
  }

  return root;
}
