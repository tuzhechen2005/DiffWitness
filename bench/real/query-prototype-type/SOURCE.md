# query-prototype-type

Upstream: sindresorhus/query-string (MIT).

- Verified affected revision: https://github.com/sindresorhus/query-string/commit/7fd813338963583472586f228a74dcbfb067e785
- Verified fix, including source diff and regression tests: https://github.com/sindresorhus/query-string/commit/0682872f8ff7d3b2dc6bc284de17033f85994845

These are fix-based cases permitted by issue #24. `regression_commit` identifies the affected parent revision, **not an established introducing commit**. The historical introduction was not established. `old.ts` is the corrected reference from the fix; `new.ts` reproduces the affected parent. This orientation makes the defect visible as a regression without claiming that the fix preceded the affected revision. The first-line intent comment is our summary, not an upstream commit-message quotation.

## Verified upstream evidence and adaptation

Before fix (`base.js`, parse options):
```js
types: Object.create(null),
...options,
```
After fix:
```js
...options,
types: {__proto__: null, ...options?.types},
```
Both revisions dispatch values through:
```js
if (typeof type === 'function' && typeof value === 'string') {
  return type(value);
}
```
The fix adds `queryString.parse('toString=1&a=2', {types: {}})` expecting `{a: '2', toString: '1'}`.

Adaptation: expose the already-decoded key/value stage with empty caller-provided `types`, and return its value instead of wrapping it in the parse-result record. Other parse flags are false. The inherited `toString` is called unbound exactly as upstream, producing `[object Undefined]` instead of `1` under strict ESM. This is a projection of the full parser, not a replacement implementation of all query parsing.

## Upstream license notice

Verified license at the fix revision: https://github.com/sindresorhus/query-string/blob/0682872f8ff7d3b2dc6bc284de17033f85994845/license

The following upstream MIT notice applies to the adapted excerpts above and the adjacent TypeScript files (the repository's Apache license does not replace it):

```text
MIT License

Copyright (c) Sindre Sorhus <sindresorhus@gmail.com> (https://sindresorhus.com)

Permission is hereby granted, free of charge, to any person obtaining a copy of this software and associated documentation files (the "Software"), to deal in the Software without restriction, including without limitation the rights to use, copy, modify, merge, publish, distribute, sublicense, and/or sell copies of the Software, and to permit persons to whom the Software is furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM, OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE SOFTWARE.
```
