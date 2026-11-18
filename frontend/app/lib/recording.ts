export function createAudioRecorder(stream: MediaStream): MediaRecorder {
  const formats = ["audio/webm;codecs=opus", "audio/mp4", "audio/ogg;codecs=opus"];
  const mimeType = formats.find((format) => MediaRecorder.isTypeSupported(format));
  return mimeType ? new MediaRecorder(stream, { mimeType }) : new MediaRecorder(stream);
}

export function recordingFilename(mode: string, mimeType: string): string {
  const format = mimeType.split(";")[0];
  const extension = {
    "audio/webm": "webm",
    "audio/mp4": "m4a",
    "audio/ogg": "ogg",
    "audio/wav": "wav",
  }[format];
  return extension ? `comftalk-${mode}.${extension}` : `comftalk-${mode}`;
}
