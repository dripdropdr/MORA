export function mouthImageForSound(sound: string): string | null {
    const m: Record<string, string> = {
      h: '/mouth_img/h.png', j: '/mouth_img/j.png', l: '/mouth_img/l.png', k: '/mouth_img/k.png',
      f: '/mouth_img/f_tmp.png', g: '/mouth_img/g.png', sh: '/mouth_img/sh.png', ay: '/mouth_img/ay.png',
      n: '/mouth_img/n.png', m: '/mouth_img/m.png', b: '/mouth_img/b.png', p: '/mouth_img/p.png',
      s: '/mouth_img/s.png', z: '/mouth_img/z.png', th: '/mouth_img/th.png', w: '/mouth_img/w.png',
      ai: '/mouth_img/ai.png', r: '/mouth_img/r_updated.png', v: '/mouth_img/v.png', ah: '/mouth_img/ah.png',
      e: '/mouth_img/e.png', oh: '/mouth_img/oh.png', t: '/mouth_img/t.png', d: '/mouth_img/d.png',
      ch: '/mouth_img/sh.png', ph: '/mouth_img/p.png', wh: '/mouth_img/w.png', bl: '/mouth_img/b.png',
      cl: '/mouth_img/k.png', fl: '/mouth_img/f_tmp.png', gl: '/mouth_img/g.png', pl: '/mouth_img/p.png',
      sl: '/mouth_img/s.png', br: '/mouth_img/b.png', cr: '/mouth_img/k.png', dr: '/mouth_img/d.png',
      fr: '/mouth_img/f_tmp.png', gr: '/mouth_img/g.png', pr: '/mouth_img/p.png', tr: '/mouth_img/t.png',
      st: '/mouth_img/s.png', sp: '/mouth_img/s.png', sw: '/mouth_img/s.png', sm: '/mouth_img/s.png',
      sn: '/mouth_img/s.png', sc: '/mouth_img/s.png', sk: '/mouth_img/k.png',
    };
    return m[sound.toLowerCase()] || null;
  }

export function firstSoundOf(word: string): string {
    const w = word.toLowerCase();
    const compounds = ['ch','sh','th','ph','wh','bl','cl','fl','gl','pl','sl','br','cr','dr','fr','gr','pr','tr','st','sp','sw','sm','sn','sc','sk'];
    for (const c of compounds) if (w.startsWith(c)) return c;
    return w.charAt(0);
  }

// TODO: will update this to Pheonix API
export const soundDescriptions: Record<string, { description: string; gesture: string }> = {
    h: { description: 'Breathe out gently through your mouth.', gesture: 'Put your hand in front of your lips and feel the warm air.' },
    j: { description: 'Lift your tongue close to the roof of your mouth and slide the sound out.', gesture: 'Smile a little as if starting “yes.”' },
    l: { description: 'Touch the tip of your tongue just behind your top teeth and let the air flow around the sides.', gesture: 'Point to your top teeth with your finger.' },
    k: { description: 'Press the back of your tongue against the roof of your mouth, then let the air pop out.', gesture: 'Cover your mouth with your hand to feel the small burst.' },
    g: { description: 'Do the same as /k/, but turn on your voice.', gesture: 'Put your hand on your throat and feel it buzz.' },
    sh: { description: 'Put your tongue close to the roof of your mouth and blow air, like telling someone “shhh.”', gesture: 'Hold a finger to your lips.' },
    ch: { description: 'Start with your tongue blocking the air, then let it go with a quick “ch.”', gesture: 'Clap your hands once to show the quick burst.' },
    r: { description: 'Curl your tongue a little back in your mouth and use your voice.', gesture: 'Put your hand on your throat to feel the buzz.' },
    s: { description: 'Put your tongue close behind your top teeth and blow air like a hiss.', gesture: 'Move your hand like a snake sliding.' },
    z: { description: 'Do the same as /s/, but turn on your voice.', gesture: 'Put your hand on your throat to feel the buzz while hissing.' }
  };