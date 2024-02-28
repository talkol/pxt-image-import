////////////////////////////////////////////////////////////////////////////
//// Resize algorithms
// https://github.com/guyonroche/imagejs/blob/master/lib/resize.js (MIT)

export function nearestNeighbor(src, dst) {
  var wSrc = src.width;
  var hSrc = src.height;
  
  var wDst = dst.width;
  var hDst = dst.height;
  
  var bufSrc = src.data;
  var bufDst = dst.data;

  for (var i = 0; i < hDst; i++) {
      for (var j = 0; j < wDst; j++) {
          var posDst = (i * wDst + j) * 4;
          
          var iSrc = Math.round(i * hSrc / hDst);
          var jSrc = Math.round(j * wSrc / wDst);
          var posSrc = (iSrc * wSrc + jSrc) * 4;
          
          bufDst[posDst++] = bufSrc[posSrc++];
          bufDst[posDst++] = bufSrc[posSrc++];
          bufDst[posDst++] = bufSrc[posSrc++];
          bufDst[posDst++] = bufSrc[posSrc++];
      }
  }
}

export function bilinearInterpolation(src, dst) {
  var wSrc = src.width;
  var hSrc = src.height;
  
  var wDst = dst.width;
  var hDst = dst.height;
  
  var bufSrc = src.data;
  var bufDst = dst.data;
  
  var interpolate = function(k, kMin, vMin, kMax, vMax) {
      // special case - k is integer
      if (kMin === kMax) {
          return vMin;
      }
      
      return Math.round((k - kMin) * vMax + (kMax - k) * vMin);
  };
  var assign = function(pos, offset, x, xMin, xMax, y, yMin, yMax) {
      var posMin = (yMin * wSrc + xMin) * 4 + offset;
      var posMax = (yMin * wSrc + xMax) * 4 + offset;
      var vMin = interpolate(x, xMin, bufSrc[posMin], xMax, bufSrc[posMax]);
      
      // special case, y is integer
      if (yMax === yMin) {
          bufDst[pos+offset] = vMin;
      } else {
          posMin = (yMax * wSrc + xMin) * 4 + offset;
          posMax = (yMax * wSrc + xMax) * 4 + offset;
          var vMax = interpolate(x, xMin, bufSrc[posMin], xMax, bufSrc[posMax]);
          
          bufDst[pos+offset] = interpolate(y, yMin, vMin, yMax, vMax);
      }
  }
  for (var i = 0; i < hDst; i++) {
      for (var j = 0; j < wDst; j++) {
          var posDst = (i * wDst + j) * 4;
          
          // x & y in src coordinates
          var x = j * wSrc / wDst;
          var xMin = Math.floor(x);
          var xMax = Math.min(Math.ceil(x), wSrc-1);
          
          var y = i * hSrc / hDst;
          var yMin = Math.floor(y);
          var yMax = Math.min(Math.ceil(y), hSrc-1);
          
          assign(posDst, 0, x, xMin, xMax, y, yMin, yMax);
          assign(posDst, 1, x, xMin, xMax, y, yMin, yMax);
          assign(posDst, 2, x, xMin, xMax, y, yMin, yMax);
          assign(posDst, 3, x, xMin, xMax, y, yMin, yMax);
      }
  }
}

export function bicubicInterpolation(src, dst) {
  var interpolateCubic = function(x0, x1, x2, x3, t) {
      var a0 = x3 - x2 - x0 + x1;
      var a1 = x0 - x1 - a0;
      var a2 = x2 - x0;
      var a3 = x1;
      return Math.max(0,Math.min(255,(a0 * (t * t * t)) + (a1 * (t * t)) + (a2 * t) + (a3)));
  }
  return _interpolate2D(src, dst, {}, interpolateCubic);
}

export function hermiteInterpolation(src, dst) {
  var interpolateHermite = function(x0, x1, x2, x3, t)
  {
      var c0 = x1;
      var c1 = 0.5 * (x2 - x0);
      var c2 = x0 - (2.5 * x1) + (2 * x2) - (0.5 * x3);
      var c3 = (0.5 * (x3 - x0)) + (1.5 * (x1 - x2));
      return  Math.max(0,Math.min(255,Math.round((((((c3 * t) + c2) * t) + c1) * t) + c0)));
  }
  return _interpolate2D(src, dst, {}, interpolateHermite);
}

export function bezierInterpolation(src, dst) {
  // between 2 points y(n), y(n+1), use next points out, y(n-1), y(n+2)
  // to predict control points (a & b) to be placed at n+0.5
  //  ya(n) = y(n) + (y(n+1)-y(n-1))/4
  //  yb(n) = y(n+1) - (y(n+2)-y(n))/4
  // then use std bezier to interpolate [n,n+1)
  //  y(n+t) = y(n)*(1-t)^3 + 3 * ya(n)*(1-t)^2*t + 3 * yb(n)*(1-t)*t^2 + y(n+1)*t^3
  //  note the 3* factor for the two control points
  // for edge cases, can choose:
  //  y(-1) = y(0) - 2*(y(1)-y(0))
  //  y(w) = y(w-1) + 2*(y(w-1)-y(w-2))
  // but can go with y(-1) = y(0) and y(w) = y(w-1)
  var interpolateBezier = function(x0, x1, x2, x3, t) {
      // x1, x2 are the knots, use x0 and x3 to calculate control points
      var cp1 = x1 + (x2-x0)/4;
      var cp2 = x2 - (x3-x1)/4;
      var nt = 1-t;
      var c0 =      x1 * nt * nt * nt;
      var c1 = 3 * cp1 * nt * nt *  t;
      var c2 = 3 * cp2 * nt *  t *  t;
      var c3 =      x2 *  t *  t *  t;
      return Math.max(0,Math.min(255,Math.round(c0 + c1 + c2 + c3)));
  }
  return _interpolate2D(src, dst, {}, interpolateBezier);
}

function _interpolate2D(src, dst, options, interpolate) {
  var bufSrc = src.data;
  var bufDst = dst.data;
  
  var wSrc = src.width;
  var hSrc = src.height;
  
  var wDst = dst.width;
  var hDst = dst.height;
  
  // when dst smaller than src/2, interpolate first to a multiple between 0.5 and 1.0 src, then sum squares
  var wM = Math.max(1, Math.floor(wSrc / wDst));
  var wDst2 = wDst * wM;
  var hM = Math.max(1, Math.floor(hSrc / hDst));
  var hDst2 = hDst * hM;
  
  // ===========================================================
  // Pass 1 - interpolate rows
  // buf1 has width of dst2 and height of src
  var buf1 = new Uint8ClampedArray(wDst2 * hSrc * 4);
  for (var i = 0; i < hSrc; i++) {
      for (var j = 0; j < wDst2; j++) {
          // i in src coords, j in dst coords
          
          // calculate x in src coords
          // this interpolation requires 4 sample points and the two inner ones must be real
          // the outer points can be fudged for the edges.
          // therefore (wSrc-1)/wDst2
          var x = j * (wSrc-1) / wDst2;
          var xPos = Math.floor(x);
          var t = x - xPos;
          var srcPos = (i * wSrc + xPos) * 4;
          
          var buf1Pos = (i * wDst2 + j) * 4;
          for (var k = 0; k < 4; k++) {
              var kPos = srcPos + k;
              var x0 = (xPos > 0) ? bufSrc[kPos - 4] : 2*bufSrc[kPos]-bufSrc[kPos+4];
              var x1 = bufSrc[kPos];
              var x2 = bufSrc[kPos + 4];
              var x3 = (xPos < wSrc - 2) ? bufSrc[kPos + 8] : 2*bufSrc[kPos + 4]-bufSrc[kPos];
              buf1[buf1Pos+k] = interpolate(x0,x1,x2,x3,t);
          }
      }
  }
  //this._writeFile(wDst2, hSrc, buf1, "out/buf1.jpg");
  
  // ===========================================================
  // Pass 2 - interpolate columns
  // buf2 has width and height of dst2
  var buf2 = new Uint8ClampedArray(wDst2 * hDst2 * 4);
  for (var i = 0; i < hDst2; i++) {
      for (var j = 0; j < wDst2; j++) {
          // i&j in dst2 coords
          
          // calculate y in buf1 coords
          // this interpolation requires 4 sample points and the two inner ones must be real
          // the outer points can be fudged for the edges.
          // therefore (hSrc-1)/hDst2
          var y = i * (hSrc-1) / hDst2;
          var yPos = Math.floor(y);
          var t = y - yPos;
          var buf1Pos = (yPos * wDst2 + j) * 4;
          var buf2Pos = (i * wDst2 + j) * 4;
          for (var k = 0; k < 4; k++) {
              var kPos = buf1Pos + k;
              var y0 = (yPos > 0) ? buf1[kPos - wDst2*4] : 2*buf1[kPos]-buf1[kPos + wDst2*4];
              var y1 = buf1[kPos];
              var y2 = buf1[kPos + wDst2*4];
              var y3 = (yPos < hSrc-2) ? buf1[kPos + wDst2*8] : 2*buf1[kPos + wDst2*4]-buf1[kPos];
              
              buf2[buf2Pos + k] = interpolate(y0,y1,y2,y3,t);
          }
      }
  }
  //this._writeFile(wDst2, hDst2, buf2, "out/buf2.jpg");
  
  // ===========================================================
  // Pass 3 - scale to dst
  var m = wM * hM;
  if (m > 1) {
      for (var i = 0; i < hDst; i++) {
          for (var j = 0; j < wDst; j++) {
              // i&j in dst bounded coords
              var r = 0;
              var g = 0;
              var b = 0;
              var a = 0;
              for (var y = 0; y < hM; y++) {
                  var yPos = i * hM + y;
                  for (var x = 0; x < wM; x++) {
                      var xPos = j * wM + x;
                      var xyPos = (yPos * wDst2 + xPos) * 4;
                      r += buf2[xyPos];
                      g += buf2[xyPos+1];
                      b += buf2[xyPos+2];
                      a += buf2[xyPos+3];
                  }
              }
              
              var pos = (i*wDst + j) * 4;
              bufDst[pos]   = Math.round(r / m);
              bufDst[pos+1] = Math.round(g / m);
              bufDst[pos+2] = Math.round(b / m);
              bufDst[pos+3] = Math.round(a / m);
          }
      }
  } else {
      // replace dst buffer with buf2
      dst.data = buf2;
  }
}


////////////////////////////////////////////////////////////////////////////
//// Color Quantization algorithms
// https://github.com/leeoniya/RgbQuant.js/blob/master/src/rgbquant.js (MIT)

// palette - rgb triplets, eg. [[255,0,0], [0,255,0], [0,0,255]]
// dithKern = null / "FloydSteinberg" / "FalseFloydSteinberg" / "Stucki" / "Atkinson" / "Jarvis" / "Burkes" / "Sierra" / "TwoSierra" / "SierraLite"
// dithSerp = true / false
// dithDelta = minimum color difference (0-1) needed to dither
export function reduceColors(src, dst, palette, dithKern, dithSerp, dithDelta) {
  const _palette = {
    idxrgb: palette, // palette - rgb triplets
    idxi32: [],      // palette - int32 vals
    i32idx: {},      // reverse lookup {i32:idx}
    i32rgb: {},      // {i32:rgb}
  };
  if (_palette.idxrgb.length > 0) {
    _palette.idxrgb.forEach(function(rgb, i) {
      var i32 = (
        (255    << 24) |	// alpha
        (rgb[2] << 16) |	// blue
        (rgb[1] <<  8) |	// green
         rgb[0]				// red
      ) >>> 0;
      _palette.idxi32[i]		= i32;
      _palette.i32idx[i32]	= i;
      _palette.i32rgb[i32]	= rgb;
    });
  }
  
  var out32;

  // reduce w/dither
  if (dithKern) {
    out32 = _ditherColors(src, dithKern, dithSerp, dithDelta, _palette);
  } else {
    var buf32 = new Uint32Array(src.data.buffer);
    var len = buf32.length;
    out32 = new Uint32Array(len);

    for (var i = 0; i < len; i++) {
      var i32 = buf32[i];
      out32[i] = _reduceNearestColor(i32, _palette);
    }
  }

  if (dst) {
    // return the destination image pixels
    dst.data.set(new Uint8Array(out32.buffer));
  }

  var out = [];
  var outlen = out32.length;

  for (var i = 0; i < outlen; i++) {
    var i32 = out32[i];
    out[i] = _palette.i32idx[i32];
  }

  return out;
}

function _reduceNearestColor(i32, _palette) {
  var idx = _reduceNearestIndex(i32, _palette);
  return idx === null ? 0 : _palette.idxi32[idx];
}

function _reduceNearestIndex(i32, _palette) {
  // alpha 0 returns null index
  if ((i32 & 0xff000000) >> 24 == 0)
    return null;

  if ((""+i32) in _palette.i32idx)
    return _palette.i32idx[i32];

  var min = 1000,
    idx,
    rgb = [
      (i32 & 0xff),
      (i32 & 0xff00) >> 8,
      (i32 & 0xff0000) >> 16,
    ],
    len = _palette.idxrgb.length;

  for (var i = 0; i < len; i++) {
    if (!_palette.idxrgb[i]) continue;		// sparse palettes

    var dist = _distEuclidean(rgb, _palette.idxrgb[i]);

    if (dist < min) {
      min = dist;
      idx = i;
    }
  }

  return idx;
}

function _ditherColors(src, kernel, serpentine, dithDelta, _palette) {
  // http://www.tannerhelland.com/4660/dithering-eleven-algorithms-source-code/
  var kernels = {
    FloydSteinberg: [
      [7 / 16, 1, 0],
      [3 / 16, -1, 1],
      [5 / 16, 0, 1],
      [1 / 16, 1, 1]
    ],
    FalseFloydSteinberg: [
      [3 / 8, 1, 0],
      [3 / 8, 0, 1],
      [2 / 8, 1, 1]
    ],
    Stucki: [
      [8 / 42, 1, 0],
      [4 / 42, 2, 0],
      [2 / 42, -2, 1],
      [4 / 42, -1, 1],
      [8 / 42, 0, 1],
      [4 / 42, 1, 1],
      [2 / 42, 2, 1],
      [1 / 42, -2, 2],
      [2 / 42, -1, 2],
      [4 / 42, 0, 2],
      [2 / 42, 1, 2],
      [1 / 42, 2, 2]
    ],
    Atkinson: [
      [1 / 8, 1, 0],
      [1 / 8, 2, 0],
      [1 / 8, -1, 1],
      [1 / 8, 0, 1],
      [1 / 8, 1, 1],
      [1 / 8, 0, 2]
    ],
    Jarvis: [			// Jarvis, Judice, and Ninke / JJN?
      [7 / 48, 1, 0],
      [5 / 48, 2, 0],
      [3 / 48, -2, 1],
      [5 / 48, -1, 1],
      [7 / 48, 0, 1],
      [5 / 48, 1, 1],
      [3 / 48, 2, 1],
      [1 / 48, -2, 2],
      [3 / 48, -1, 2],
      [5 / 48, 0, 2],
      [3 / 48, 1, 2],
      [1 / 48, 2, 2]
    ],
    Burkes: [
      [8 / 32, 1, 0],
      [4 / 32, 2, 0],
      [2 / 32, -2, 1],
      [4 / 32, -1, 1],
      [8 / 32, 0, 1],
      [4 / 32, 1, 1],
      [2 / 32, 2, 1],
    ],
    Sierra: [
      [5 / 32, 1, 0],
      [3 / 32, 2, 0],
      [2 / 32, -2, 1],
      [4 / 32, -1, 1],
      [5 / 32, 0, 1],
      [4 / 32, 1, 1],
      [2 / 32, 2, 1],
      [2 / 32, -1, 2],
      [3 / 32, 0, 2],
      [2 / 32, 1, 2],
    ],
    TwoSierra: [
      [4 / 16, 1, 0],
      [3 / 16, 2, 0],
      [1 / 16, -2, 1],
      [2 / 16, -1, 1],
      [3 / 16, 0, 1],
      [2 / 16, 1, 1],
      [1 / 16, 2, 1],
    ],
    SierraLite: [
      [2 / 4, 1, 0],
      [1 / 4, -1, 1],
      [1 / 4, 0, 1],
    ],
  };

  if (!kernel || !kernels[kernel]) {
    throw 'Unknown dithering kernel: ' + kernel;
  }

  var ds = kernels[kernel];

  var buf32 = new Uint32Array(src.data.buffer);
  var width = src.width;
  var height = src.height;
  var len = buf32.length;

  var dir = serpentine ? -1 : 1;

  for (var y = 0; y < height; y++) {
    if (serpentine)
      dir = dir * -1;

    var lni = y * width;

    for (var x = (dir == 1 ? 0 : width - 1), xend = (dir == 1 ? width : 0); x !== xend; x += dir) {
      // Image pixel
      var idx = lni + x,
        i32 = buf32[idx],
        r1 = (i32 & 0xff),
        g1 = (i32 & 0xff00) >> 8,
        b1 = (i32 & 0xff0000) >> 16;

      // Reduced pixel
      var i32x = _reduceNearestColor(i32, _palette),
        r2 = (i32x & 0xff),
        g2 = (i32x & 0xff00) >> 8,
        b2 = (i32x & 0xff0000) >> 16;

      buf32[idx] =
        (255 << 24)	|	// alpha
        (b2  << 16)	|	// blue
        (g2  <<  8)	|	// green
         r2;

      // dithering strength
      if (dithDelta) {
        var dist = _distEuclidean([r1, g1, b1], [r2, g2, b2]);
        if (dist < dithDelta)
          continue;
      }

      // Component distance
      var er = r1 - r2,
        eg = g1 - g2,
        eb = b1 - b2;

      for (var i = (dir == 1 ? 0 : ds.length - 1), end = (dir == 1 ? ds.length : 0); i !== end; i += dir) {
        var x1 = ds[i][1] * dir,
          y1 = ds[i][2];

        var lni2 = y1 * width;

        if (x1 + x >= 0 && x1 + x < width && y1 + y >= 0 && y1 + y < height) {
          var d = ds[i][0];
          var idx2 = idx + (lni2 + x1);

          var r3 = (buf32[idx2] & 0xff),
            g3 = (buf32[idx2] & 0xff00) >> 8,
            b3 = (buf32[idx2] & 0xff0000) >> 16;

          var r4 = Math.max(0, Math.min(255, r3 + er * d)),
            g4 = Math.max(0, Math.min(255, g3 + eg * d)),
            b4 = Math.max(0, Math.min(255, b3 + eb * d));

          buf32[idx2] =
            (255 << 24)	|	// alpha
            (b4  << 16)	|	// blue
            (g4  <<  8)	|	// green
             r4;			    // red
        }
      }
    }
  }

  return buf32;
}

var Pr = .2126,
		Pg = .7152,
		Pb = .0722;

var rd = 255,
		gd = 255,
		bd = 255;

var euclMax = Math.sqrt(Pr*rd*rd + Pg*gd*gd + Pb*bd*bd);

function _distEuclidean(rgb0, rgb1) {
  var rd = rgb1[0]-rgb0[0],
    gd = rgb1[1]-rgb0[1],
    bd = rgb1[2]-rgb0[2];

  return Math.sqrt(Pr*rd*rd + Pg*gd*gd + Pb*bd*bd) / euclMax;
}