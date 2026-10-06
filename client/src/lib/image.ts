/**
 * Сүрөттү жүктөөдөн мурун кичирейтүү: узун жагы 1600 px’тен ашпайт, JPEG 85%.
 * Телефондордо сайт тезирээк ачылат жана база ашыкча толбойт.
 * GIF (анимация) жана кичинекей сүрөттөр өзгөртүлбөйт.
 */
export async function resizeImage(file: File, maxSide = 1600, quality = 0.85): Promise<{ file: File; resized: boolean }> {
  if (!file.type.startsWith('image/') || file.type === 'image/gif') return { file, resized: false };
  try {
    const bitmap = await createImageBitmap(file);
    const scale = Math.min(1, maxSide / Math.max(bitmap.width, bitmap.height));
    // Кичинекей жана жеңил сүрөт — ошол бойдон
    if (scale === 1 && file.size < 600 * 1024) {
      bitmap.close();
      return { file, resized: false };
    }
    const w = Math.round(bitmap.width * scale);
    const h = Math.round(bitmap.height * scale);
    const canvas = document.createElement('canvas');
    canvas.width = w;
    canvas.height = h;
    const ctx = canvas.getContext('2d');
    if (!ctx) return { file, resized: false };
    // PNG’дин тунук фону ак болот
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, w, h);
    ctx.drawImage(bitmap, 0, 0, w, h);
    bitmap.close();
    const blob = await new Promise<Blob | null>((r) => canvas.toBlob(r, 'image/jpeg', quality));
    if (!blob || blob.size >= file.size) return { file, resized: false };
    const name = file.name.replace(/\.[^.]+$/, '') + '.jpg';
    return { file: new File([blob], name, { type: 'image/jpeg' }), resized: true };
  } catch {
    return { file, resized: false };
  }
}
