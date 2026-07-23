import fs from "fs";
import path from "path";
import OpenAI from "openai";
import { DeepgramClient } from "@deepgram/sdk";

// ─── Type aliases shared with frontend editors ──────────────────────────────

export interface SubtitleSegment {
  id: string;
  start: number; // ms
  end: number;   // ms
  text: string;
}

export interface TranscriptBlock {
  id: string;
  timestamp: string; // "HH:MM:SS"
  speaker: string;
  text: string;
}

export type SubtitleOutput  = { type: "subtitle";    segments: SubtitleSegment[] };
export type TranscriptOutput = { type: "transcript"; blocks: TranscriptBlock[] };
export type AIOutput = SubtitleOutput | TranscriptOutput;

// ─── Language code map (full name → ISO 639-1) ──────────────────────────────

const LANG_CODE: Record<string, string> = {
  "Afrikaans": "af", "Albanian": "sq", "Amharic": "am", "Arabic": "ar",
  "Armenian": "hy", "Azerbaijani": "az", "Basque": "eu", "Belarusian": "be",
  "Bengali": "bn", "Bosnian": "bs", "Bulgarian": "bg", "Catalan": "ca",
  "Chinese (Cantonese)": "zh", "Chinese (Mandarin)": "zh", "Croatian": "hr",
  "Czech": "cs", "Danish": "da", "Dutch": "nl", "English": "en",
  "English (Indian)": "en", "English (UK)": "en", "English (US)": "en",
  "Estonian": "et", "Filipino": "tl", "Finnish": "fi", "French": "fr",
  "Galician": "gl", "Georgian": "ka", "German": "de", "Greek": "el",
  "Gujarati": "gu", "Hausa": "ha", "Hebrew": "he", "Hindi": "hi",
  "Hungarian": "hu", "Icelandic": "is", "Indonesian": "id", "Irish": "ga",
  "Italian": "it", "Japanese": "ja", "Javanese": "jv", "Kannada": "kn",
  "Kazakh": "kk", "Khmer": "km", "Korean": "ko", "Lao": "lo",
  "Latvian": "lv", "Lithuanian": "lt", "Macedonian": "mk", "Malay": "ms",
  "Malayalam": "ml", "Maltese": "mt", "Marathi": "mr", "Mongolian": "mn",
  "Nepali": "ne", "Norwegian": "no", "Pashto": "ps", "Persian": "fa",
  "Polish": "pl", "Portuguese": "pt", "Punjabi": "pa", "Romanian": "ro",
  "Russian": "ru", "Serbian": "sr", "Sinhala": "si", "Slovak": "sk",
  "Slovenian": "sl", "Somali": "so", "Spanish": "es", "Swahili": "sw",
  "Swedish": "sv", "Tamil": "ta", "Telugu": "te", "Thai": "th",
  "Turkish": "tr", "Ukrainian": "uk", "Urdu": "ur", "Uzbek": "uz",
  "Vietnamese": "vi", "Welsh": "cy", "Xhosa": "xh", "Yoruba": "yo", "Zulu": "zu",
};

function toLangCode(name: string): string | undefined {
  if (!name || name === "auto") return undefined;
  return LANG_CODE[name];
}

function secsToHms(total: number): string {
  const h = Math.floor(total / 3600);
  const m = Math.floor((total % 3600) / 60);
  const s = Math.floor(total % 60);
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
}

// ─── Whisper — timed subtitle segments ──────────────────────────────────────

const WHISPER_MAX_BYTES = 24 * 1024 * 1024; // 24 MB (API limit is 25 MB)

async function whisperSubtitles(
  filePath: string,
  sourceLanguage: string
): Promise<{ segments: SubtitleSegment[]; durationMinutes: number }> {
  const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
  const langCode = toLangCode(sourceLanguage);

  const result = await openai.audio.transcriptions.create({
    file: fs.createReadStream(filePath) as any,
    model: "whisper-1",
    response_format: "verbose_json",
    timestamp_granularities: ["segment"],
    ...(langCode ? { language: langCode } : {}),
  });

  const rawSegments: Array<{ id: number; start: number; end: number; text: string }> =
    (result as any).segments ?? [];

  const segments: SubtitleSegment[] = rawSegments.map((seg) => ({
    id: String(seg.id + 1),
    start: Math.round(seg.start * 1000),
    end: Math.round(seg.end * 1000),
    text: seg.text.trim(),
  }));

  const durationSecs: number = (result as any).duration ?? (rawSegments.at(-1)?.end ?? 0);

  return { segments, durationMinutes: durationSecs / 60 };
}

// ─── Deepgram — diarized transcript blocks ───────────────────────────────────

async function deepgramTranscript(
  filePath: string,
  sourceLanguage: string
): Promise<{ blocks: TranscriptBlock[]; durationMinutes: number }> {
  const deepgram = new DeepgramClient({ apiKey: process.env.DEEPGRAM_API_KEY });
  const langCode = toLangCode(sourceLanguage);
  const mimeType = getMimeType(filePath);

  const stream = fs.createReadStream(filePath);
  const response = await deepgram.listen.v1.media.transcribeFile(stream, {
    model: "nova-2",
    diarize: true,
    punctuate: true,
    smart_format: true,
    utterances: true,
    ...(langCode ? { language: langCode } : { detect_language: true }),
    encoding: mimeType as any,
  });

  const result = (response as any).result ?? (response as any);
  const utterances = result?.results?.utterances ?? [];
  const blocks: TranscriptBlock[] = utterances.map((u: any, i: number) => ({
    id: `b${i}`,
    speaker: `Speaker ${(u.speaker ?? 0) + 1}`,
    timestamp: secsToHms(u.start ?? 0),
    text: (u.transcript ?? "").trim(),
  }));

  const durationSecs: number = result?.metadata?.duration ?? 0;
  return { blocks, durationMinutes: durationSecs / 60 };
}

// ─── Deepgram — utterance-based subtitle segments (large file fallback) ──────

async function deepgramSubtitles(
  filePath: string,
  sourceLanguage: string
): Promise<{ segments: SubtitleSegment[]; durationMinutes: number }> {
  const deepgram = new DeepgramClient({ apiKey: process.env.DEEPGRAM_API_KEY });
  const langCode = toLangCode(sourceLanguage);
  const mimeType = getMimeType(filePath);

  const stream = fs.createReadStream(filePath);
  const response = await deepgram.listen.v1.media.transcribeFile(stream, {
    model: "nova-2",
    punctuate: true,
    smart_format: true,
    utterances: true,
    ...(langCode ? { language: langCode } : { detect_language: true }),
    encoding: mimeType as any,
  });

  const result = (response as any).result ?? (response as any);
  const utterances = result?.results?.utterances ?? [];
  const segments: SubtitleSegment[] = utterances.map((u: any, i: number) => ({
    id: String(i + 1),
    start: Math.round((u.start ?? 0) * 1000),
    end: Math.round((u.end ?? 0) * 1000),
    text: (u.transcript ?? "").trim(),
  }));

  const durationSecs: number = result?.metadata?.duration ?? 0;
  return { segments, durationMinutes: durationSecs / 60 };
}

// ─── MIME helper ─────────────────────────────────────────────────────────────

function getMimeType(filePath: string): string {
  const ext = path.extname(filePath).toLowerCase();
  const map: Record<string, string> = {
    ".mp4": "video/mp4",
    ".mp3": "audio/mpeg",
    ".wav": "audio/wav",
    ".mov": "video/quicktime",
    ".mpeg": "video/mpeg",
    ".mpg": "video/mpeg",
    ".m4a": "audio/mp4",
    ".webm": "video/webm",
  };
  return map[ext] ?? "audio/mpeg";
}

// ─── Public entry point ───────────────────────────────────────────────────────

export async function runTranscription(
  jobType: string,
  filePath: string,
  sourceLanguage: string
): Promise<{ output: AIOutput; durationMinutes: number }> {
  const fileSizeBytes = fs.statSync(filePath).size;

  if (jobType === "transcription") {
    const { blocks, durationMinutes } = await deepgramTranscript(filePath, sourceLanguage);
    return { output: { type: "transcript", blocks }, durationMinutes };
  }

  if (jobType === "subtitling" || jobType === "captioning") {
    if (fileSizeBytes <= WHISPER_MAX_BYTES) {
      const { segments, durationMinutes } = await whisperSubtitles(filePath, sourceLanguage);
      return { output: { type: "subtitle", segments }, durationMinutes };
    } else {
      // Large file: use Deepgram utterances as subtitle segments
      const { segments, durationMinutes } = await deepgramSubtitles(filePath, sourceLanguage);
      return { output: { type: "subtitle", segments }, durationMinutes };
    }
  }

  // Dubbing — ElevenLabs not wired yet, return placeholder
  return {
    output: { type: "subtitle", segments: [] },
    durationMinutes: 1,
  };
}
