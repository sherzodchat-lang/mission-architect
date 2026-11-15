// Rebuilds public/audio/** from assets_src/audio/raw/*.mp3 using the choices in assets_src/audio/manifest.json.
//   node tools/audio_build.mjs            rebuild everything
//   node tools/audio_build.mjs v01_welcome ui_click   rebuild only these ids
// Needs ffmpeg + ffprobe in PATH. Raw originals are never modified. Run `node tools/public_index.mjs` afterwards
// (npm predev/prebuild does it automatically).
import { readFileSync, mkdirSync, mkdtempSync, rmSync, statSync } from 'node:fs'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
import { spawnSync } from 'node:child_process'
import { tmpdir } from 'node:os'

const root = join(dirname(fileURLToPath(import.meta.url)), '..')
const srcDir = join(root, 'assets_src', 'audio')
const outDir = join(root, 'public', 'audio')
const manifest = JSON.parse(readFileSync(join(srcDir, 'manifest.json'), 'utf8'))
const only = process.argv.slice(2)
const tmp = mkdtempSync(join(tmpdir(), 'audio_build-'))

function ff(args) {
  const r = spawnSync('ffmpeg', ['-hide_banner', '-nostats', '-y', ...args], { encoding: 'utf8', maxBuffer: 1 << 26 })
  if (r.status !== 0) throw new Error('ffmpeg failed: ' + args.join(' ') + '\n' + r.stderr)
  return r.stderr
}

/** integrated loudness (LUFS) and true peak (dBTP) of a file */
function measure(file) {
  const err = ff(['-i', file, '-af', 'ebur128=peak=true:framelog=quiet', '-f', 'null', '-'])
  const sum = err.slice(err.lastIndexOf('Summary:'))
  const I = parseFloat((sum.match(/I:\s+(-?[\d.]+|-inf)\s+LUFS/) || [])[1])
  const tp = parseFloat((sum.match(/Peak:\s+(-?[\d.]+|-inf)\s+dBFS/) || [])[1])
  let lufs = I
  if (!Number.isFinite(lufs) || lufs < -60) {
    // clip shorter than the 400 ms gating block: fall back to mean RMS
    const v = ff(['-i', file, '-af', 'volumedetect', '-f', 'null', '-'])
    lufs = parseFloat(v.match(/mean_volume:\s+(-?[\d.]+) dB/)[1]) - 0.7
  }
  return { lufs, tp }
}

/** gain to target loudness, limit true peak, encode to mp3; iterate once because the limiter eats loudness */
function normalizeEncode(inWav, outMp3, p) {
  const ch = p.channels
  let gain = p.lufs - measure(inWav).lufs
  const ceil = Math.pow(10, (p.tp - 0.6) / 20) // sample-peak ceiling, 0.6 dB below the true-peak target for mp3 overshoot
  let res
  for (let i = 0; i < 6; i++) {
    const af = `volume=${gain.toFixed(2)}dB,alimiter=limit=${ceil.toFixed(4)}:attack=2:release=40:level=disabled`
    ff(['-i', inWav, '-af', af, '-ac', String(ch), '-ar', '44100', '-c:a', 'libmp3lame', '-b:a', p.bitrate, outMp3])
    res = measure(outMp3)
    const over = res.tp - p.tp
    const err = p.lufs - res.lufs
    if (over > 0.05) { gain -= over + 0.2; continue } // mp3 encode overshoot: back off
    if (Math.abs(err) < 0.5 || i >= 3) break
    gain += err
  }
  return res
}

function tempoChain(factor) {
  // stretch by `factor` (>1 = longer) using atempo (each stage limited to >= 0.5)
  let r = 1 / factor
  const parts = []
  while (r < 0.5) { parts.push('atempo=0.5'); r /= 0.5 }
  parts.push(`atempo=${r.toFixed(4)}`)
  return parts.join(',')
}

function duration(file) {
  return parseFloat(spawnSync('ffprobe', ['-v', 'error', '-show_entries', 'format=duration', '-of', 'csv=p=0', file], { encoding: 'utf8' }).stdout)
}

function buildVoice(id, it, take) {
  const p = it.process
  const keep = (p.keep_ms ?? 80) / 1000
  const sr = `silenceremove=start_periods=1:start_threshold=-45dB:start_silence=${keep}`
  const af = [
    sr, 'areverse', sr, 'areverse',
    'highpass=f=200', 'lowpass=f=4000', 'equalizer=f=2200:t=q:w=0.9:g=2',
    'acompressor=threshold=-30dB:ratio=3.5:attack=6:release=120:makeup=3',
    'volume=4dB', 'asoftclip=type=tanh', 'volume=-4dB', // very light saturation
    'acompressor=threshold=-20dB:ratio=2:attack=3:release=80',
    'afade=t=in:d=0.01', 'areverse', 'afade=t=in:d=0.03', 'areverse',
  ].join(',')
  const wav = join(tmp, id + '.wav')
  ff(['-i', take, '-af', af, '-ac', '1', '-ar', '44100', wav])
  return normalizeEncode(wav, join(outDir, it.out), p)
}

function synthBed(id, b, takeLufs) {
  const d = b.duration
  const wav = join(tmp, id + '_bed.wav')
  const lp = b.lowpass
  const rumble = (seed) => `anoisesrc=d=${d}:c=brown:a=0.9:r=44100:s=${seed},lowpass=f=${lp},highpass=f=25`
  const crackle = (seed) => `anoisesrc=d=${d}:c=pink:a=0.9:r=44100:s=${seed},highpass=f=1800,lowpass=f=7000,tremolo=f=13:d=0.95,volume=${b.crackle_db - b.gain_db}dB`
  const env = `afade=t=in:d=${b.attack}:curve=qsin,afade=t=out:st=${(d - b.release).toFixed(3)}:d=${b.release}:curve=${b.release > 1 ? 'qsin' : 'tri'}`
  const fc =
    `${rumble(11)}[r1];${rumble(23)}[r2];${crackle(31)}[c1];${crackle(47)}[c2];` +
    `[r1][c1]amix=inputs=2:normalize=0[l];[r2][c2]amix=inputs=2:normalize=0[r];` +
    `[l][r]join=inputs=2:channel_layout=stereo,${env}`
  ff(['-filter_complex', fc, wav])
  const m = measure(wav)
  // scale the bed so its integrated loudness sits at takeLufs + gain_db
  const g = takeLufs + b.gain_db - m.lufs
  const out = join(tmp, id + '_bed2.wav')
  ff(['-i', wav, '-af', `volume=${g.toFixed(2)}dB`, out])
  return out
}

function buildSfx(id, it, take) {
  const p = it.process
  const m = it.takes[it.choice].metrics
  const stretch = p.stretch ?? 1
  const pre = ['silenceremove=start_periods=1:start_threshold=-55dB']
  if (stretch !== 1) pre.push(tempoChain(stretch))
  const nat = ((m.act_end - m.act_start) + 0.02) * stretch
  const wav = join(tmp, id + '.wav')
  if (p.synth_bed) {
    const dur = p.target_s
    const base = join(tmp, id + '_take.wav')
    ff(['-i', take, '-af', pre.join(','), '-ac', '1', '-ar', '44100', base])
    const bed = synthBed(id, p.synth_bed, measure(base).lufs)
    const fo = Math.min(p.fade_out_s, dur / 2)
    const fc =
      `[0:a]aformat=sample_rates=44100:channel_layouts=mono,pan=stereo|c0=c0|c1=c0,apad=whole_dur=${dur}[t];` +
      `[1:a]apad=whole_dur=${dur}[b];[t][b]amix=inputs=2:normalize=0,atrim=0:${dur},asetpts=PTS-STARTPTS,` +
      `afade=t=in:d=${p.fade_in_s},afade=t=out:st=${(dur - fo).toFixed(3)}:d=${fo}`
    ff(['-i', base, '-i', bed, '-filter_complex', fc, '-ar', '44100', wav])
  } else {
    // v2 sources (generated with the right duration_seconds) need no stretching or synthetic bed: just trim
    // leading silence, cut the dead tail, fade, normalise. `min_s` keeps very short clips (UI clicks) from collapsing.
    const dur = Math.max(p.min_s ?? 0, Math.min(p.target_s, nat))
    const fo = Math.min(p.fade_out_s, dur / 2)
    const tail = `atrim=0:${dur.toFixed(3)},asetpts=PTS-STARTPTS,afade=t=in:d=${p.fade_in_s},afade=t=out:st=${(dur - fo).toFixed(3)}:d=${fo}`
    ff(['-i', take, '-af', [...pre, tail].join(','), '-ac', '1', '-ar', '44100', wav])
  }
  return normalizeEncode(wav, join(outDir, it.out), p)
}

/** v2 ambient generated with loop:true: the file already wraps seamlessly, so no crossfade/extension hack, just loudness. */
function buildNativeLoop(id, it, take) {
  const wav = join(tmp, id + '_loop.wav')
  ff(['-i', take, '-ac', '2', '-ar', '44100', wav])
  return normalizeEncode(wav, join(outDir, it.out), it.process)
}

function buildAmbient(id, it, take) {
  const p = it.process
  if (p.native_loop) return buildNativeLoop(id, it, take)
  const c = p.crossfade_s
  const src = join(tmp, id + '_src.wav')
  ff(['-i', take, '-af', 'highpass=f=35', '-ac', '2', '-ar', '44100', src])
  const L = duration(src)
  // 1) extend: chain of crossfaded copies, a bit longer than target + one crossfade
  const T = p.target_s + c
  const n = Math.ceil((T - c) / (L - c)) + 1
  let fc = ''
  let cur = '[0:a]'
  for (let i = 1; i < n; i++) {
    const o = i === n - 1 ? '[ext]' : `[x${i}]`
    fc += `${cur}[${i}:a]acrossfade=d=${c}:c1=qsin:c2=qsin${o};`
    cur = o
  }
  fc += `[ext]atrim=0:${T},asetpts=PTS-STARTPTS[x]`
  const extWav = join(tmp, id + '_ext.wav')
  ff([...Array(n).fill(['-i', src]).flat(), '-filter_complex', fc, '-map', '[x]', extWav])
  // 2) seamless wrap: crossfade the last `c` seconds into the first `c` seconds (loop point is then click-free)
  const loopWav = join(tmp, id + '_loop.wav')
  ff([
    '-t', String(c), '-i', extWav,
    '-ss', String(T - c), '-t', String(c), '-i', extWav,
    '-ss', String(c), '-t', String(T - 2 * c), '-i', extWav,
    '-filter_complex', `[1:a][0:a]acrossfade=d=${c}:c1=qsin:c2=qsin[x];[2:a][x]concat=n=2:v=0:a=1`,
    loopWav,
  ])
  return normalizeEncode(loopWav, join(outDir, it.out), p)
}

const report = []
try {
  for (const [id, it] of Object.entries(manifest.items)) {
    if (only.length && !only.includes(id)) continue
    const take = join(srcDir, it.takes[it.choice].file)
    mkdirSync(dirname(join(outDir, it.out)), { recursive: true })
    const r = it.kind === 'voice' ? buildVoice(id, it, take) : it.kind === 'sfx' ? buildSfx(id, it, take) : buildAmbient(id, it, take)
    const dur = duration(join(outDir, it.out))
    const kb = (statSync(join(outDir, it.out)).size / 1024).toFixed(1)
    report.push({ id, take: it.choice, dur: +dur.toFixed(2), kb: +kb, lufs: +r.lufs.toFixed(1), tp: +r.tp.toFixed(1) })
    console.log(`${id.padEnd(22)} take ${it.choice}  ${dur.toFixed(2).padStart(6)} s  ${kb.padStart(7)} KB  ${r.lufs.toFixed(1)} LUFS  TP ${r.tp.toFixed(1)}`)
  }
} finally {
  rmSync(tmp, { recursive: true, force: true })
}
