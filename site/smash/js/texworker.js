// Web Worker: generates environment textures off the main thread.
import { generate } from './texgen.js';

self.onmessage = (e) => {
  const { id, name, w, h } = e.data;
  const r = generate(name, w, h);
  self.postMessage({ id, ...r }, [r.col.buffer, r.nor.buffer, r.rough.buffer]);
};
