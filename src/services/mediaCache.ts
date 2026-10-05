// Guarda a versão local de uma foto/áudio recém-enviado, para a mensagem não "piscar"
// enquanto o link do servidor é gerado (e para tocar o áudio sem baixar de novo).
const local = new Map<string, string>();

export const rememberLocalMedia = (path: string, localUri: string) => local.set(path, localUri);
export const localMediaFor = (path: string) => local.get(path);
