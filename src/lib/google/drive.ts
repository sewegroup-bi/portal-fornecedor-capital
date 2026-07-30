import { google } from "googleapis";

// Autentica como conta de serviço (somente leitura da ENTRADA do Drive).
// A chave JSON da conta de serviço vem em base64 na env GOOGLE_SERVICE_ACCOUNT_JSON_BASE64.
function getAuth() {
  const b64 = process.env.GOOGLE_SERVICE_ACCOUNT_JSON_BASE64;
  if (!b64) {
    throw new Error("GOOGLE_SERVICE_ACCOUNT_JSON_BASE64 não configurada");
  }
  const credentials = JSON.parse(Buffer.from(b64, "base64").toString("utf-8"));
  return new google.auth.GoogleAuth({
    credentials,
    scopes: ["https://www.googleapis.com/auth/drive.readonly"],
  });
}

function driveClient() {
  return google.drive({ version: "v3", auth: getAuth() });
}

// Encontra um arquivo por nome dentro de uma pasta.
export async function findFileInFolder(folderId: string, fileName: string) {
  const drive = driveClient();
  const res = await drive.files.list({
    q: `'${folderId}' in parents and name = '${fileName}' and trashed = false`,
    fields: "files(id, name, size, modifiedTime, md5Checksum)",
    pageSize: 1,
    supportsAllDrives: true,
    includeItemsFromAllDrives: true,
  });
  return res.data.files?.[0] ?? null;
}

// Baixa o conteúdo de um arquivo do Drive como texto (UTF-8).
export async function downloadFileText(fileId: string): Promise<string> {
  const drive = driveClient();
  const res = await drive.files.get(
    { fileId, alt: "media", supportsAllDrives: true },
    { responseType: "arraybuffer" }
  );
  return Buffer.from(res.data as ArrayBuffer).toString("utf-8");
}
