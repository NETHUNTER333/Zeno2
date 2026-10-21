import { PhononTTS } from 'phonon-tts';

let tts: PhononTTS | null = null;
let loading = false;

export async function loadPhonon() {
  if (tts) return tts;
  if (loading) return null;
  loading = true;
  try {
    tts = await PhononTTS.load({
      model: 'hf://gradium/phonon-31m-en',
      lang: 'en',
      quant: 'q8',
      device: 'auto',
    });
    return tts;
  } catch (e) {
    console.error('Phonon load failed', e);
    loading = false;
    return null;
  }
}

export async function speakWithPhonon(text: string) {
  const instance = await loadPhonon();
  if (!instance) return false;
  try {
    const audio = await instance.synth(text);
    const ctx = new (window.AudioContext || (window as any).webkitAudioContext)();
    const buf = ctx.createBuffer(1, audio.length, instance.sampleRate || 24000);
    buf.getChannelData(0).set(audio);
    const src = ctx.createBufferSource();
    src.buffer = buf;
    src.connect(ctx.destination);
    src.start();
    return true;
  } catch (e) {
    console.error('Phonon speak failed', e);
    return false;
  }
}
