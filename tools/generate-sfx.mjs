import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const output = path.join(root, 'assets', 'game_art');
const sampleRate = 22050;

function writeWave(filename, notes, seconds) {
  const count = Math.floor(sampleRate * seconds);
  const pcm = Buffer.alloc(count * 2);
  for (let i = 0; i < count; i += 1) {
    const time = i / sampleRate;
    let sample = 0;
    for (const note of notes) {
      const local = time - note.start;
      if (local < 0 || local > note.length) continue;
      const attack = Math.min(1, local / 0.012);
      const release = Math.max(0, 1 - local / note.length);
      const envelope = attack * release * release;
      sample += Math.sin(2 * Math.PI * note.frequency * local) * envelope * note.gain;
    }
    pcm.writeInt16LE(Math.max(-1, Math.min(1, sample)) * 32767, i * 2);
  }

  const header = Buffer.alloc(44);
  header.write('RIFF', 0); header.writeUInt32LE(36 + pcm.length, 4); header.write('WAVE', 8);
  header.write('fmt ', 12); header.writeUInt32LE(16, 16); header.writeUInt16LE(1, 20);
  header.writeUInt16LE(1, 22); header.writeUInt32LE(sampleRate, 24); header.writeUInt32LE(sampleRate * 2, 28);
  header.writeUInt16LE(2, 32); header.writeUInt16LE(16, 34); header.write('data', 36); header.writeUInt32LE(pcm.length, 40);
  fs.writeFileSync(path.join(output, filename), Buffer.concat([header, pcm]));
}

fs.mkdirSync(output, { recursive: true });
writeWave('sfx_merge.wav', [
  { frequency: 660, start: 0, length: 0.14, gain: 0.23 },
  { frequency: 880, start: 0.055, length: 0.18, gain: 0.16 },
], 0.25);
writeWave('sfx_reward.wav', [
  { frequency: 523.25, start: 0, length: 0.24, gain: 0.18 },
  { frequency: 659.25, start: 0.095, length: 0.25, gain: 0.16 },
  { frequency: 783.99, start: 0.19, length: 0.29, gain: 0.14 },
], 0.52);
writeWave('sfx_order.wav', [
  { frequency: 659.25, start: 0, length: 0.22, gain: 0.105 },
  { frequency: 1318.5, start: 0, length: 0.18, gain: 0.018 },
  { frequency: 783.99, start: 0.085, length: 0.24, gain: 0.088 },
  { frequency: 1567.98, start: 0.085, length: 0.19, gain: 0.015 },
  { frequency: 987.77, start: 0.17, length: 0.26, gain: 0.072 },
  { frequency: 1975.54, start: 0.17, length: 0.2, gain: 0.012 },
  { frequency: 1174.66, start: 0.255, length: 0.31, gain: 0.058 },
  { frequency: 2349.32, start: 0.255, length: 0.22, gain: 0.01 },
], 0.58);
console.log(`Generated merge, reward, and order cues in ${output}`);
