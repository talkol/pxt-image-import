import React from 'react';
import './App.css';
import { nearestNeighbor, bilinearInterpolation, bicubicInterpolation, hermiteInterpolation, bezierInterpolation, reduceColors } from './imageutils';

function App() {

  const handleChange = (event: React.FormEvent<HTMLInputElement>) => {
    const reader = new FileReader();
    reader.readAsDataURL((event.target as any).files[0]);
    reader.onload = (e: ProgressEvent<FileReader>) => {
      const image = new Image();
      image.src = e.target?.result as string;
      image.onload = () => {
        const canvas = document.getElementById("canvas") as HTMLCanvasElement;
        const ctx = canvas.getContext("2d");
        ctx?.drawImage(image, 0, 0);
        const bitmap = ctx?.getImageData(0, 0, image.width, image.height);
        const newBitmap = new ImageData(160, 120);
        //nearestNeighbor(bitmap, newBitmap);
        //bilinearInterpolation(bitmap, newBitmap);
        bicubicInterpolation(bitmap, newBitmap);
        //hermiteInterpolation(bitmap, newBitmap);
        //bezierInterpolation(bitmap, newBitmap);
        const makeCodePalette = [[0xff,0xff,0xff], [0xff,0x21,0x21], [0xff,0x93,0xc4], [0xff,0x81,0x35], [0xff,0xf6,0x09], [0x24,0x9c,0xa3], [0x78,0xdc,0x52], [0x00,0x3f,0xad], [0x87,0xf2,0xff], [0x8e,0x2e,0xc4], [0xa4,0x83,0x9f], [0x5c,0x40,0x6c], [0xe5,0xcd,0xc4], [0x91,0x46,0x3d], [0x00,0x00,0x00]];
        //reduceColors(newBitmap, newBitmap, makeCodePalette, null, false, 0);
        //reduceColors(newBitmap, newBitmap, makeCodePalette, "FloydSteinberg", false, 0.15);
        reduceColors(newBitmap, newBitmap, makeCodePalette, "FloydSteinberg", false, 0);
        ctx?.putImageData(newBitmap, 0, 0);
      };
    };
  };

  return (
    <div className="App">
        <form>
          <input type="file" onChange={handleChange} id="imported" name="imported" accept="image/png, image/jpeg, image/webp, image/avif" />
        </form>
        <canvas id="canvas" width="10000" height="10000" />
    </div>
  );
}

export default App;
