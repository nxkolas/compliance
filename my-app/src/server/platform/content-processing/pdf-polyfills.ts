/**
 * pdfjs-dist (a pdf-parse dependency) evaluates `new DOMMatrix()` at module
 * scope. In Node it normally polyfills the global from `@napi-rs/canvas`, but
 * that path is unavailable on some runtimes (Node < 20.16 without
 * `process.getBuiltinModule`, or when the native canvas binding cannot load).
 * In those environments loading pdf-parse crashes with
 * `ReferenceError: DOMMatrix is not defined` before any parsing runs.
 *
 * This module installs a dependency-free 2D DOMMatrix before pdf-parse is
 * imported. Text extraction only needs the type to exist and to support the
 * affine transforms pdfjs applies; rendering-heavy features (images,
 * screenshots) are not used by this application.
 */

type PdfMatrixLike = readonly number[] | string | PdfDomMatrixShim;

class PdfDomMatrixShim {
  a = 1;
  b = 0;
  c = 0;
  d = 1;
  e = 0;
  f = 0;

  constructor(init?: PdfMatrixLike) {
    if (typeof init === "string") {
      const match = /matrix\(([^)]+)\)/u.exec(init);
      const values = match?.[1].split(/[,\s]+/u).map(Number);
      if (values && values.length >= 6) {
        this.set(values);
      }
    } else if (init instanceof PdfDomMatrixShim) {
      this.set(init);
    } else if (init && init.length >= 6) {
      this.set(init);
    }
  }

  get is2D() {
    return true;
  }

  get isIdentity() {
    return this.a === 1 && this.b === 0 && this.c === 0 && this.d === 1 && this.e === 0 && this.f === 0;
  }

  multiply(other: PdfDomMatrixShim) {
    return new PdfDomMatrixShim(this).multiplySelf(other);
  }

  multiplySelf(other: PdfDomMatrixShim) {
    const { a: a1, b: b1, c: c1, d: d1, e: e1, f: f1 } = this;
    const { a: a2, b: b2, c: c2, d: d2, e: e2, f: f2 } = other;
    this.a = a1 * a2 + c1 * b2;
    this.b = b1 * a2 + d1 * b2;
    this.c = a1 * c2 + c1 * d2;
    this.d = b1 * c2 + d1 * d2;
    this.e = a1 * e2 + c1 * f2 + e1;
    this.f = b1 * e2 + d1 * f2 + f1;
    return this;
  }

  preMultiplySelf(other: PdfDomMatrixShim) {
    const { a: a1, b: b1, c: c1, d: d1, e: e1, f: f1 } = this;
    const { a: a2, b: b2, c: c2, d: d2, e: e2, f: f2 } = other;
    this.a = a2 * a1 + c2 * b1;
    this.b = b2 * a1 + d2 * b1;
    this.c = a2 * c1 + c2 * d1;
    this.d = b2 * c1 + d2 * d1;
    this.e = a2 * e1 + c2 * f1 + e2;
    this.f = b2 * e1 + d2 * f1 + f2;
    return this;
  }

  translate(tx: number, ty: number) {
    return new PdfDomMatrixShim(this).translateSelf(tx, ty);
  }

  translateSelf(tx: number, ty: number) {
    this.e += this.a * tx + this.c * ty;
    this.f += this.b * tx + this.d * ty;
    return this;
  }

  scale(sx: number, sy = sx) {
    return new PdfDomMatrixShim(this).scaleSelf(sx, sy);
  }

  scaleSelf(sx: number, sy = sx) {
    this.a *= sx;
    this.b *= sx;
    this.c *= sy;
    this.d *= sy;
    return this;
  }

  invert() {
    return new PdfDomMatrixShim(this).invertSelf();
  }

  invertSelf() {
    const determinant = this.a * this.d - this.b * this.c;
    if (determinant === 0) {
      this.a = this.b = this.c = this.d = this.e = this.f = Number.NaN;
      return this;
    }
    const inverseDeterminant = 1 / determinant;
    const { a, b, c, d, e, f } = this;
    this.a = d * inverseDeterminant;
    this.b = -b * inverseDeterminant;
    this.c = -c * inverseDeterminant;
    this.d = a * inverseDeterminant;
    this.e = (c * f - d * e) * inverseDeterminant;
    this.f = (b * e - a * f) * inverseDeterminant;
    return this;
  }

  transformPoint(point: { x: number; y: number }) {
    return {
      x: this.a * point.x + this.c * point.y + this.e,
      y: this.b * point.x + this.d * point.y + this.f,
    };
  }

  toFloat32Array() {
    return new Float32Array([this.a, this.b, this.c, this.d, this.e, this.f]);
  }

  toString() {
    return `matrix(${[this.a, this.b, this.c, this.d, this.e, this.f].join(", ")})`;
  }

  private set(values: PdfMatrixLike) {
    if (values instanceof PdfDomMatrixShim) {
      this.a = values.a;
      this.b = values.b;
      this.c = values.c;
      this.d = values.d;
      this.e = values.e;
      this.f = values.f;
      return;
    }
    if (typeof values === "string") {
      return;
    }
    this.a = values[0];
    this.b = values[1];
    this.c = values[2];
    this.d = values[3];
    this.e = values[4];
    this.f = values[5];
  }
}

export function installPdfPolyfills(): void {
  if (typeof globalThis.DOMMatrix === "function") {
    return;
  }
  globalThis.DOMMatrix = PdfDomMatrixShim as unknown as typeof globalThis.DOMMatrix;
}
