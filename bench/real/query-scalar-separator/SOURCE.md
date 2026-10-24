# query-scalar-separator

Upstream: sindresorhus/query-string (MIT).

- Verified affected revision: https://github.com/sindresorhus/query-string/commit/f48a249188c423534ba9653d4a7978821edf1374
- Verified fix, including source diff and regression tests: https://github.com/sindresorhus/query-string/commit/b63dc568f2c5c77be0d3a3bf131c7a64d309aa12

These are fix-based cases permitted by issue #24. `regression_commit` identifies the affected parent revision, **not an established introducing commit**. The historical introduction was not established. `old.ts` is the corrected reference from the fix; `new.ts` reproduces the affected parent. This orientation makes the defect visible as a regression without claiming that the fix preceded the affected revision. The first-line intent comment is our summary, not an upstream commit-message quotation.

## Verified upstream evidence and adaptation

Before fix (`base.js`):
```js
return encode(key, options) + '=' + encode(value, options);
```
After fix:
```js
const encodedValue = options.arrayFormat === 'comma' || options.arrayFormat === 'separator' ? encodeArrayItem(value, options) : encode(value, options);
return encode(key, options) + '=' + encodedValue;
```
Upstream changed its test from `foo=a-b` to `foo=a%2Db` for `{foo: 'a-b'}` with `{arrayFormat: 'separator', arrayFormatSeparator: '-'}`.

Adaptation: specialize stringify to that one string-valued `foo` key and those fixed options. Inline strict URI encoding; omit unrelated arrays, replacers and key ordering. For well-formed string values this preserves that upstream branch's output; the supplied ASCII input avoids unrelated malformed-surrogate behavior.

## Upstream license notice

Verified license at the fix revision: https://github.com/sindresorhus/query-string/blob/b63dc568f2c5c77be0d3a3bf131c7a64d309aa12/license

The following upstream MIT notice applies to the adapted excerpts above and the adjacent TypeScript files (the repository's Apache license does not replace it):

```text
MIT License

Copyright (c) Sindre Sorhus <sindresorhus@gmail.com> (https://sindresorhus.com)

Permission is hereby granted, free of charge, to any person obtaining a copy of this software and associated documentation files (the "Software"), to deal in the Software without restriction, including without limitation the rights to use, copy, modify, merge, publish, distribute, sublicense, and/or sell copies of the Software, and to permit persons to whom the Software is furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM, OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE SOFTWARE.
```
