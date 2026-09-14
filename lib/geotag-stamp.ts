// Stamp geotag langsung di foto via canvas (jalan di HP, offline-friendly).
// Hasil: foto JPEG dengan strip hijau solid di bawah berisi teks kiri +
// thumbnail peta kanan yang nempel di badan foto (gaya aplikasi GPS camera).

export type StampInfo = {
  pohonId: string;
  latitude: number;
  longitude: number;
  accuracy?: number | null;
  source?: string | null;
  timestamp?: Date;
};

function loadImage(file: File): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => {
      URL.revokeObjectURL(url);
      resolve(img);
    };
    img.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error("gagal baca foto"));
    };
    img.src = url;
  });
}

function lonLatToTile(lat: number, lng: number, z: number) {
  const n = 2 ** z;
  const x = Math.floor(((lng + 180) / 360) * n);
  const latRad = (lat * Math.PI) / 180;
  const y = Math.floor(((1 - Math.log(Math.tan(latRad) + 1 / Math.cos(latRad)) / Math.PI) / 2) * n);
  return { x, y, z };
}

function tryLoadTile(src: string, ms: number): Promise<HTMLImageElement | null> {
  return new Promise((resolve) => {
    const timeout = setTimeout(() => resolve(null), ms);
    const img = new Image();
    img.crossOrigin = "anonymous";
    img.onload = () => {
      clearTimeout(timeout);
      resolve(img);
    };
    img.onerror = () => {
      clearTimeout(timeout);
      resolve(null);
    };
    img.src = src;
  });
}

async function loadMapTile(lat: number, lng: number): Promise<HTMLImageElement | null> {
  const { x, y, z } = lonLatToTile(lat, lng, 16);
  const sources = [
    `https://tile.openstreetmap.org/${z}/${x}/${y}.png`,
    `https://basemaps.cartocdn.com/rastertiles/voyager/${z}/${x}/${y}.png`,
  ];
  for (const src of sources) {
    const img = await tryLoadTile(src, 5000);
    if (img) return img;
  }
  return null;
}

function toBlob(canvas: HTMLCanvasElement): Promise<Blob> {
  return new Promise((resolve, reject) => {
    canvas.toBlob(
      (b) => (b ? resolve(b) : reject(new Error("gagal olah foto"))),
      "image/jpeg",
      0.78
    );
  });
}

export async function stampGeotagPhoto(file: File, info: StampInfo): Promise<File> {
  try {
    const img = await loadImage(file);
    const scale = Math.min(1, 1280 / Math.max(img.naturalWidth, img.naturalHeight));
    const W = Math.round(img.naturalWidth * scale);
    const H = Math.round(img.naturalHeight * scale);

    const canvas = document.createElement("canvas");
    canvas.width = W;
    canvas.height = H;
    const ctx = canvas.getContext("2d");
    if (!ctx) return file;
    ctx.drawImage(img, 0, 0, W, H);

    const s = W / 1000; // skala mengikuti lebar foto
    const pad = Math.max(12, Math.round(22 * s));
    // strip bawah: cukup tinggi untuk menampung peta kotak di kanan
    const stripH = Math.min(
      Math.round(H * 0.34),
      Math.max(Math.round(H * 0.24), Math.round(168 * s))
    );
    const stripY = H - stripH;

    // strip hijau solid menempel di foto
    ctx.fillStyle = "#15803d";
    ctx.fillRect(0, stripY, W, stripH);

    // kotak peta kanan (selalu digambar: tile asli atau placeholder)
    const mapSize = Math.max(40, Math.min(stripH - pad * 2, Math.round(W * 0.34)));
    const mx = W - pad - mapSize;
    const my = stripY + pad;
    const tile = await loadMapTile(info.latitude, info.longitude).catch(() => null);
    if (tile) {
      ctx.drawImage(tile, mx, my, mapSize, mapSize);
    } else {
      // placeholder saat offline: kotak gelap + bidik lokasi
      ctx.fillStyle = "#14532d";
      ctx.fillRect(mx, my, mapSize, mapSize);
      ctx.strokeStyle = "rgba(255,255,255,0.7)";
      ctx.lineWidth = Math.max(2, 3 * s);
      ctx.beginPath();
      ctx.moveTo(mx + mapSize / 2, my + 8);
      ctx.lineTo(mx + mapSize / 2, my + mapSize - 8);
      ctx.moveTo(mx + 8, my + mapSize / 2);
      ctx.lineTo(mx + mapSize - 8, my + mapSize / 2);
      ctx.stroke();
      ctx.fillStyle = "rgba(255,255,255,0.85)";
      ctx.font = `${Math.round(Math.max(15 * s, 11))}px system-ui, sans-serif`;
      ctx.textBaseline = "top";
      ctx.fillText("peta offline", mx + 8, my + mapSize - 22 * s - 4);
    }
    // bingkai putih + pin tengah
    ctx.strokeStyle = "#ffffff";
    ctx.lineWidth = Math.max(3, 5 * s);
    ctx.strokeRect(mx, my, mapSize, mapSize);
    const cx = mx + mapSize / 2;
    const cy = my + mapSize / 2;
    ctx.fillStyle = "#dc2626";
    ctx.beginPath();
    ctx.arc(cx, cy, Math.max(7, 11 * s), 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = "#ffffff";
    ctx.beginPath();
    ctx.arc(cx, cy, Math.max(3, 4.5 * s), 0, Math.PI * 2);
    ctx.fill();

    // teks kiri
    const tx = pad;
    const textW = Math.max(50, mx - pad * 2);
    ctx.textBaseline = "top";
    ctx.fillStyle = "#ffffff";
    const titleSize = Math.round(Math.max(30 * s, 21));
    ctx.font = `700 ${titleSize}px system-ui, sans-serif`;
    const waktu = (info.timestamp || new Date()).toLocaleString("id-ID", {
      day: "2-digit",
      month: "short",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
    let ty = stripY + pad;
    ctx.fillText(info.pohonId, tx, ty, textW);
    ty += titleSize + Math.round(6 * s);
    ctx.font = `400 ${titleSize}px system-ui, sans-serif`;
    ctx.fillStyle = "#e7f6ec";
    ctx.fillText(waktu, tx, ty, textW);
    ty += titleSize + Math.round(6 * s);

    const subSize = Math.round(Math.max(24 * s, 16));
    ctx.font = `400 ${subSize}px system-ui, sans-serif`;
    ctx.fillStyle = "#dcfce7";
    const acc = info.accuracy != null ? ` ±${Math.round(info.accuracy)}m` : "";
    ctx.fillText(
      `${info.latitude.toFixed(6)}, ${info.longitude.toFixed(6)}${acc}`,
      tx,
      ty,
      textW
    );
    ty += subSize + Math.round(6 * s);
    ctx.fillStyle = "#ffffff";
    ctx.font = `600 ${Math.round(Math.max(20 * s, 14))}px system-ui, sans-serif`;
    ctx.fillText(`PT BUMI SURYA FARM • ${info.source || "GPS"}`, tx, ty, textW);

    const blob = await toBlob(canvas);
    const name = file.name.replace(/\.[a-z0-9]+$/i, "") + "-geotag.jpg";
    return new File([blob], name, { type: "image/jpeg" });
  } catch {
    return file;
  }
}
