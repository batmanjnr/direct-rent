import * as FileSystem from 'expo-file-system';

// Convert a local URI (file:// or content://) into a Blob suitable for Firebase upload.
export async function uriToBlob(uri, mimeType = 'image/jpeg') {
    // First try the simplest approach (works for many URIs)
    try {
        const resp = await fetch(uri);
        const blob = await resp.blob();
        if (blob && blob.size) return blob;
    } catch (e) {
        // fallthrough to FileSystem fallback
    }

    // Fallback: read file as base64 and convert to a data URL then to a Blob
    try {
        const b64 = await FileSystem.readAsStringAsync(uri, {
            encoding: FileSystem.EncodingType.Base64,
        });
        const dataUrl = `data:${mimeType};base64,${b64}`;
        const resp2 = await fetch(dataUrl);
        const blob2 = await resp2.blob();
        if (blob2 && blob2.size) return blob2;
        throw new Error('Empty blob from data URL');
    } catch (err) {
        throw new Error('uriToBlob: failed to convert uri to blob: ' + (err.message || err));
    }
}
