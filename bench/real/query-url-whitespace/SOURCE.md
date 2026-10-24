# query-url-whitespace

Upstream: sindresorhus/query-string (MIT).

- Verified affected revision: https://github.com/sindresorhus/query-string/commit/b9ff3f8f1d7480c3553684425156a8b1c8e00c27
- Verified fix, including source diff and regression tests: https://github.com/sindresorhus/query-string/commit/1d91dbfcf1922c8c59216f532d4d8ab2abe67510

These are fix-based cases permitted by issue #24. `regression_commit` identifies the affected parent revision, **not an established introducing commit**. The historical introduction was not established. `old.ts` is the corrected reference from the fix; `new.ts` reproduces the affected parent. This orientation makes the defect visible as a regression without claiming that the fix preceded the affected revision. The first-line intent comment is our summary, not an upstream commit-message quotation.

## Verified upstream evidence and adaptation

The fix inserts this before the existing split in `base.js`:
```js
url = url.trim();
let [url_, hash] = splitOnFirst(url, '#');
```
The returned fragment uses:
```js
...(options && options.parseFragmentIdentifier && hash ? {fragmentIdentifier: decode(hash, options)} : {}),
```
Its added test passes `https://foo.bar?a=1#top\n` with `{parseFragmentIdentifier: true}` and expects `fragmentIdentifier: 'top'`.

Adaptation: project only `fragmentIdentifier`, returning null when absent, and fix `parseFragmentIdentifier` and `decode` to true. Inline the first-`#` split and URI decoding. Inputs use valid percent escapes (the original decoder also tolerates malformed escapes, which this extraction does not model). Query parsing and URL output are irrelevant to this projection and omitted.

## Upstream license notice

Verified license at the fix revision: https://github.com/sindresorhus/query-string/blob/1d91dbfcf1922c8c59216f532d4d8ab2abe67510/license

The following upstream MIT notice applies to the adapted excerpts above and the adjacent TypeScript files (the repository's Apache license does not replace it):

```text
MIT License

Copyright (c) Sindre Sorhus <sindresorhus@gmail.com> (https://sindresorhus.com)

Permission is hereby granted, free of charge, to any person obtaining a copy of this software and associated documentation files (the "Software"), to deal in the Software without restriction, including without limitation the rights to use, copy, modify, merge, publish, distribute, sublicense, and/or sell copies of the Software, and to permit persons to whom the Software is furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM, OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE SOFTWARE.
```
