// Shared media type knowledge for scanning + streaming.
export const VIDEO_EXTS = new Set([
  '.mp4', '.m4v', '.mov', '.mkv', '.avi', '.webm', '.wmv', '.flv',
  '.mpg', '.mpeg', '.ts', '.m2ts', '.mts', '.ogv', '.3gp', '.3g2', '.f4v'
]);
export const AUDIO_EXTS = new Set([
  '.mp3', '.m4a', '.m4b', '.aac', '.wav', '.flac', '.ogg', '.oga',
  '.opus', '.wma', '.aiff', '.aif', '.alac', '.mka'
]);
export const DOC_EXTS = new Set(['.pdf']);
export const SUBTITLE_EXTS = new Set(['.srt', '.vtt']);

export type MediaKind = 'video' | 'audio' | 'pdf';

export const isMediaExt = (e: string) => VIDEO_EXTS.has(e) || AUDIO_EXTS.has(e) || DOC_EXTS.has(e);
export const mediaKind = (e: string): MediaKind =>
  AUDIO_EXTS.has(e) ? 'audio' : DOC_EXTS.has(e) ? 'pdf' : 'video';

export const MEDIA_MIME = new Map<string, string>([
  ['.mp4', 'video/mp4'], ['.m4v', 'video/mp4'], ['.mov', 'video/quicktime'],
  ['.mkv', 'video/x-matroska'], ['.webm', 'video/webm'], ['.avi', 'video/x-msvideo'],
  ['.ogv', 'video/ogg'], ['.ts', 'video/mp2t'], ['.3gp', 'video/3gpp'], ['.flv', 'video/x-flv'],
  ['.mp3', 'audio/mpeg'], ['.m4a', 'audio/mp4'], ['.m4b', 'audio/mp4'], ['.aac', 'audio/aac'],
  ['.wav', 'audio/wav'], ['.flac', 'audio/flac'], ['.ogg', 'audio/ogg'], ['.oga', 'audio/ogg'],
  ['.opus', 'audio/ogg'], ['.aiff', 'audio/aiff'], ['.aif', 'audio/aiff'], ['.mka', 'audio/x-matroska'],
  ['.pdf', 'application/pdf'],
  ['.srt', 'text/plain; charset=utf-8'], ['.vtt', 'text/vtt; charset=utf-8']
]);
