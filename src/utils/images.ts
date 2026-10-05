import { ImageManipulator, SaveFormat } from 'expo-image-manipulator';

/** Reduz a imagem para `width` px de largura em JPEG, deixando leve para salvar e enviar. */
export async function optimizeImage(uri: string, width = 1080, compress = 0.75) {
  const image = await ImageManipulator.manipulate(uri).resize({ width }).renderAsync();
  const result = await image.saveAsync({ compress, format: SaveFormat.JPEG });
  return { uri: result.uri, width: result.width, height: result.height };
}
