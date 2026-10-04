import { Platform } from 'react-native';
import * as ImagePicker from 'expo-image-picker';

export type PickedImage = {
  uri: string;
  mimeType: string;
  fileName: string;
  /** bytes; null quando o aparelho não informa */
  fileSize: number | null;
};

type Options = {
  limit: number;
  /** Abre a câmera (frontal) em vez da galeria. */
  camera?: boolean;
};

/**
 * Abre a galeria (ou a câmera) e devolve as imagens escolhidas, ou null se a pessoa cancelar.
 *
 * No navegador não usamos o seletor do expo-image-picker: ele recusa o lote inteiro quando
 * uma das fotos vem sem tipo ou num formato que o navegador não abre (ex.: HEIC de alguns
 * Androids). Aqui cada arquivo segue sozinho e o tratamento fica com quem chamou.
 */
export async function pickImages({ limit, camera }: Options): Promise<PickedImage[] | null> {
  if (Platform.OS === 'web') return pickOnWeb(limit, camera);

  if (camera) {
    const permission = await ImagePicker.requestCameraPermissionsAsync();
    if (!permission.granted) throw new PermissionError('camera');
  } else {
    const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!permission.granted) throw new PermissionError('library');
  }

  const options: ImagePicker.ImagePickerOptions = {
    mediaTypes: ['images'],
    quality: 1,
    allowsMultipleSelection: !camera && limit > 1,
    selectionLimit: limit,
    cameraType: ImagePicker.CameraType.front,
  };
  const result = camera
    ? await ImagePicker.launchCameraAsync(options)
    : await ImagePicker.launchImageLibraryAsync(options);
  if (result.canceled) return null;

  return result.assets.slice(0, limit).map((a) => ({
    uri: a.uri,
    mimeType: a.mimeType ?? '',
    fileName: a.fileName ?? '',
    fileSize: a.fileSize ?? null,
  }));
}

export class PermissionError extends Error {
  constructor(readonly kind: 'camera' | 'library') {
    super(kind);
  }
}

function pickOnWeb(limit: number, camera?: boolean): Promise<PickedImage[] | null> {
  return new Promise((resolve) => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = 'image/*';
    input.multiple = !camera && limit > 1;
    if (camera) input.setAttribute('capture', 'user');

    let settled = false;
    const finish = (value: PickedImage[] | null) => {
      if (settled) return;
      settled = true;
      input.remove();
      resolve(value);
    };

    input.addEventListener('change', () => {
      const files = Array.from(input.files ?? []).slice(0, limit);
      finish(
        files.length
          ? files.map((file) => ({
              uri: URL.createObjectURL(file),
              mimeType: file.type,
              fileName: file.name,
              fileSize: file.size,
            }))
          : null,
      );
    });
    input.addEventListener('cancel', () => finish(null));

    // Alguns navegadores só abrem o seletor se o input estiver no documento.
    input.style.display = 'none';
    document.body.appendChild(input);
    input.click();
  });
}
