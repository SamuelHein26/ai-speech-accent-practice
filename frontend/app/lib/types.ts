export type StartSessionResponse = {
  session_id: string;
  is_guest: boolean;
};

export type FinalizeResponse = {
  final: string;
  audio_url?: string;
};
