import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const outDir = resolve(root, 'assets/questions');

const scenes = [
  ['q01', '#d86f58', 'monster'],
  ['q02', '#4e7466', 'glasses'],
  ['q03', '#8d876f', 'tablet'],
  ['q04', '#425263', 'gate'],
  ['q05', '#9a7045', 'tankard'],
  ['q06', '#b98637', 'gear'],
  ['q07', '#6b7b51', 'woodfish'],
  ['q08', '#5f8191', 'rail'],
  ['q09', '#6d625d', 'skull'],
  ['q10', '#b05d4f', 'arena'],
  ['q11', '#8fb3bf', 'footprints'],
  ['q12', '#caa15d', 'necklace'],
  ['q13', '#63746f', 'washer'],
  ['q14', '#8e6c9c', 'slot'],
  ['q15', '#b36d4e', 'dogfire'],
  ['q16', '#697482', 'boots'],
  ['q17', '#8c8f78', 'statue'],
  ['q18', '#7b647f', 'pit'],
  ['q19', '#b49a5f', 'backpack'],
  ['q20', '#9f5c58', 'boss'],
  ['q21', '#7d738d', 'replay'],
  ['q22', '#6b8668', 'sidequest'],
  ['q23', '#b88951', 'door'],
  ['q24', '#5f6d7d', 'archive'],
];

const palette = {
  ink: '#263531',
  deep: '#141b1f',
  gold: '#d9bd78',
  paper: '#f7f3ea',
  shadow: '#d8d2c2',
  dark: '#2f3338',
  red: '#b9584c',
  green: '#557467',
  blue: '#5f7d8b',
};

function polygon(points, fill, opacity = 1) {
  return `<polygon points="${points}" fill="${fill}" opacity="${opacity}"/>`;
}

function person(x, y, accent) {
  return `<g transform="translate(${x} ${y})">
    <ellipse cx="46" cy="139" rx="38" ry="8" fill="${palette.shadow}" opacity=".55"/>
    ${polygon('25,88 67,88 76,128 17,128', palette.dark)}
    ${polygon('34,86 58,86 52,130 29,130', accent)}
    ${polygon('29,32 64,26 78,58 63,86 29,86 15,58', '#f0c9a5')}
    ${polygon('19,42 36,20 65,27 74,46 47,38', '#23272c')}
    <circle cx="38" cy="59" r="3" fill="#182026"/>
    <circle cx="57" cy="59" r="3" fill="#182026"/>
    ${polygon('31,130 43,130 40,151 24,151', '#272d32')}
    ${polygon('53,130 66,130 76,151 58,151', '#272d32')}
  </g>`;
}

const motifs = {
  monster: (accent) => `${person(130, 188, accent)}<g transform="translate(510 145)">${polygon('42,8 118,34 104,112 26,126 6,54', accent)}<circle cx="45" cy="64" r="7" fill="${palette.paper}"/><circle cx="83" cy="68" r="7" fill="${palette.paper}"/>${polygon('39,106 85,102 64,122', palette.paper)}</g><path d="M294 284 C360 230,440 225,510 205" fill="none" stroke="${palette.gold}" stroke-width="10" stroke-linecap="round" stroke-dasharray="26 22"/>`,
  glasses: (accent) => `${person(420, 168, accent)}<g transform="translate(176 172)" fill="none" stroke="${palette.dark}" stroke-width="18" stroke-linecap="round"><circle cx="72" cy="64" r="42"/><circle cx="184" cy="64" r="42"/><path d="M114 64 L142 64"/></g><path d="M246 274 C336 236,370 236,452 274" fill="none" stroke="${palette.gold}" stroke-width="8" stroke-linecap="round"/>`,
  tablet: (accent) => `${person(560, 184, accent)}<g transform="translate(190 128)">${polygon('28,24 218,0 246,180 12,206', '#d9d0b8')}<path d="M68 70 L194 56 M58 112 L208 96 M82 154 L176 140" stroke="${palette.dark}" stroke-width="9" stroke-linecap="round"/></g>`,
  gate: (accent) => `${person(130, 190, accent)}<g transform="translate(410 112)"><rect x="0" y="45" width="230" height="210" rx="22" fill="${palette.dark}"/><rect x="58" y="98" width="114" height="157" rx="48" fill="${palette.deep}"/><path d="M114 98 V255" stroke="${palette.gold}" stroke-width="5" opacity=".55"/><path d="M28 45 L114 0 L202 45" fill="${accent}"/></g>`,
  tankard: (accent) => `${person(145, 185, accent)}<g transform="translate(450 152)"><rect x="24" y="45" width="120" height="150" rx="18" fill="#d8b36c"/><path d="M144 76 C210 76,210 164,144 164" fill="none" stroke="#d8b36c" stroke-width="24"/><path d="M38 36 C58 0,88 24,108 0 C122 20,132 28,154 20 C160 42,138 52,112 47 C86 70,62 50,38 58 Z" fill="${palette.paper}"/></g>`,
  gear: (accent) => `${person(130, 184, accent)}<g transform="translate(470 130)"><circle cx="98" cy="98" r="84" fill="${accent}"/><circle cx="98" cy="98" r="44" fill="${palette.paper}"/><circle cx="98" cy="98" r="18" fill="${palette.dark}"/><g fill="${accent}"><rect x="88" y="-6" width="20" height="42"/><rect x="88" y="160" width="20" height="42"/><rect x="-6" y="88" width="42" height="20"/><rect x="160" y="88" width="42" height="20"/></g></g><circle cx="418" cy="250" r="27" fill="${palette.gold}"/>`,
  woodfish: (accent) => `${person(560, 185, accent)}<g transform="translate(194 182)"><ellipse cx="120" cy="94" rx="116" ry="66" fill="${accent}"/><circle cx="178" cy="82" r="10" fill="${palette.dark}"/><path d="M24 92 C66 58,94 54,140 82" fill="none" stroke="${palette.gold}" stroke-width="10" stroke-linecap="round"/><rect x="206" y="0" width="18" height="96" rx="9" fill="${palette.dark}" transform="rotate(30 206 0)"/></g>`,
  rail: (accent) => `${person(520, 186, accent)}<path d="M114 320 L382 120 L650 320" fill="none" stroke="${palette.dark}" stroke-width="18" stroke-linecap="round"/><path d="M156 320 L386 160 L610 320" fill="none" stroke="${palette.gold}" stroke-width="9" stroke-linecap="round" stroke-dasharray="34 22"/><circle cx="595" cy="194" r="38" fill="${accent}"/>`,
  skull: (accent) => `${person(140, 186, accent)}<g transform="translate(475 132)"><path d="M86 0 C150 0,184 42,184 102 C184 150,150 178,86 178 C22 178,0 144,0 102 C0 40,30 0,86 0 Z" fill="${palette.paper}"/><circle cx="58" cy="84" r="22" fill="${palette.dark}"/><circle cx="118" cy="84" r="22" fill="${palette.dark}"/><rect x="72" y="132" width="28" height="34" fill="${palette.dark}"/><rect x="48" y="174" width="76" height="48" rx="12" fill="${accent}"/></g>`,
  arena: (accent) => `${person(518, 182, accent)}<g transform="translate(152 135)"><rect x="0" y="58" width="260" height="170" rx="20" fill="${palette.deep}"/><path d="M24 192 L236 192 M44 154 L216 154 M64 116 L196 116" stroke="${palette.gold}" stroke-width="8" stroke-linecap="round"/><circle cx="74" cy="72" r="28" fill="${accent}"/><circle cx="188" cy="76" r="22" fill="${palette.paper}"/></g>`,
  footprints: (accent) => `${person(560, 184, accent)}<g fill="${accent}"><ellipse cx="188" cy="322" rx="18" ry="31" transform="rotate(-18 188 322)"/><ellipse cx="250" cy="286" rx="18" ry="31" transform="rotate(17 250 286)"/><ellipse cx="312" cy="250" rx="18" ry="31" transform="rotate(-18 312 250)"/><ellipse cx="374" cy="214" rx="18" ry="31" transform="rotate(17 374 214)"/></g><path d="M430 184 C470 152,506 152,548 184" fill="none" stroke="${palette.paper}" stroke-width="10" stroke-linecap="round" opacity=".65"/>`,
  necklace: (accent) => `${person(128, 188, accent)}<g transform="translate(466 126)" fill="none" stroke="${palette.gold}" stroke-width="12" stroke-linecap="round"><path d="M20 20 C80 150,170 150,230 20"/><circle cx="125" cy="155" r="36" fill="${accent}" stroke="${palette.gold}"/></g><path d="M346 270 L418 216" stroke="${palette.paper}" stroke-width="10" stroke-linecap="round"/>`,
  washer: (accent) => `${person(128, 190, accent)}<g transform="translate(442 100)"><rect x="0" y="0" width="220" height="250" rx="28" fill="${palette.paper}"/><rect x="22" y="24" width="176" height="42" rx="12" fill="${palette.dark}"/><circle cx="110" cy="150" r="72" fill="${accent}"/><circle cx="110" cy="150" r="44" fill="${palette.blue}" opacity=".72"/><path d="M76 150 C96 118,132 182,154 150" fill="none" stroke="${palette.paper}" stroke-width="10" stroke-linecap="round"/></g><rect x="268" y="148" width="122" height="64" rx="9" fill="#d9d0b8" transform="rotate(-8 268 148)"/>`,
  slot: (accent) => `${person(142, 190, accent)}<g transform="translate(454 106)"><rect x="0" y="0" width="220" height="250" rx="24" fill="${palette.dark}"/><rect x="26" y="28" width="168" height="92" rx="14" fill="${palette.paper}"/><circle cx="72" cy="74" r="22" fill="${accent}"/><circle cx="112" cy="74" r="22" fill="${palette.gold}"/><circle cx="152" cy="74" r="22" fill="${palette.red}"/><rect x="40" y="158" width="140" height="36" rx="18" fill="${palette.gold}"/></g>`,
  dogfire: (accent) => `${person(570, 190, accent)}<g transform="translate(210 150)"><path d="M128 0 C168 68,204 104,176 162 C154 208,82 208,54 162 C24 110,82 76,128 0 Z" fill="${palette.red}"/><path d="M128 72 C150 112,164 132,150 160 C136 188,92 188,80 160 C66 128,98 108,128 72 Z" fill="${palette.gold}"/><ellipse cx="126" cy="176" rx="74" ry="40" fill="${palette.dark}"/><circle cx="84" cy="130" r="24" fill="#e9b88f"/><circle cx="168" cy="130" r="24" fill="#e9b88f"/></g>`,
  boots: (accent) => `${person(132, 190, accent)}<g transform="translate(458 198)"><path d="M20 0 L82 0 L82 122 L0 122 L0 68 L20 68 Z" fill="${palette.dark}"/><path d="M122 0 L184 0 L204 68 L204 122 L122 122 Z" fill="${accent}"/><ellipse cx="104" cy="132" rx="124" ry="11" fill="${palette.shadow}"/></g><rect x="320" y="124" width="116" height="70" rx="8" fill="#d9d0b8" transform="rotate(10 320 124)"/>`,
  statue: (accent) => `${person(540, 190, accent)}<g transform="translate(210 105)"><rect x="32" y="214" width="210" height="42" rx="8" fill="${palette.dark}"/><rect x="74" y="174" width="126" height="44" fill="${accent}"/><path d="M136 0 L204 72 L176 174 L92 174 L60 72 Z" fill="#a8aaa0"/><circle cx="134" cy="54" r="34" fill="#c4c5bb"/><rect x="190" y="116" width="24" height="58" rx="12" fill="${palette.gold}"/></g>`,
  pit: (accent) => `${person(132, 190, accent)}<g transform="translate(424 148)"><ellipse cx="124" cy="160" rx="126" ry="54" fill="${palette.deep}"/><path d="M18 154 C88 106,164 106,230 154" fill="none" stroke="${accent}" stroke-width="14" stroke-linecap="round"/><circle cx="112" cy="70" r="30" fill="${palette.paper}"/><path d="M90 106 L134 106 L150 152 L78 152 Z" fill="${accent}"/></g>`,
  backpack: (accent) => `${person(128, 190, accent)}<g transform="translate(470 126)"><rect x="34" y="30" width="148" height="196" rx="34" fill="${accent}"/><rect x="56" y="80" width="104" height="70" rx="18" fill="${palette.dark}" opacity=".72"/><path d="M54 28 C72 -8,144 -8,162 28" fill="none" stroke="${palette.dark}" stroke-width="16" stroke-linecap="round"/><circle cx="176" cy="58" r="24" fill="${palette.red}"/></g>`,
  boss: (accent) => `${person(128, 190, accent)}<g transform="translate(466 102)"><path d="M80 0 L170 38 L198 136 L126 226 L38 206 L0 110 Z" fill="${accent}"/><circle cx="72" cy="92" r="10" fill="${palette.paper}"/><circle cx="132" cy="92" r="10" fill="${palette.paper}"/><path d="M56 150 L146 150" stroke="${palette.paper}" stroke-width="12" stroke-linecap="round"/></g><path d="M406 98 H636" stroke="${palette.gold}" stroke-width="12" stroke-linecap="round"/>`,
  replay: (accent) => `${person(522, 190, accent)}<g transform="translate(160 122)"><rect x="0" y="0" width="270" height="190" rx="24" fill="${palette.dark}"/><path d="M112 54 L112 136 L176 96 Z" fill="${accent}"/><path d="M44 164 H226" stroke="${palette.gold}" stroke-width="10" stroke-linecap="round"/></g>`,
  sidequest: (accent) => `${person(520, 190, accent)}<g transform="translate(196 134)"><rect x="0" y="52" width="220" height="168" rx="24" fill="${palette.deep}"/><path d="M72 14 C120 -22,176 20,142 76 C130 96,104 102,104 132" fill="none" stroke="${palette.gold}" stroke-width="22" stroke-linecap="round"/><circle cx="104" cy="172" r="16" fill="${palette.gold}"/></g>`,
  door: (accent) => `${person(132, 190, accent)}<g transform="translate(438 106)"><rect x="26" y="0" width="174" height="248" rx="20" fill="${palette.dark}"/><rect x="58" y="42" width="110" height="172" rx="16" fill="${accent}"/><circle cx="146" cy="132" r="12" fill="${palette.gold}"/><path d="M0 30 L226 30" stroke="${palette.paper}" stroke-width="8" stroke-linecap="round" opacity=".62"/></g>`,
  archive: (accent) => `${person(128, 190, accent)}<g transform="translate(452 102)"><rect x="0" y="24" width="204" height="236" rx="18" fill="#d8c9a4"/><rect x="32" y="0" width="140" height="236" rx="18" fill="${accent}"/><path d="M48 72 H156 M48 112 H140 M48 152 H164" stroke="${palette.paper}" stroke-width="10" stroke-linecap="round"/><rect x="64" y="188" width="76" height="28" rx="10" fill="${palette.gold}"/></g>`,
};

function svg([id, accent, motif], index) {
  const tilt = index % 2 === 0 ? 1 : -1;
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 960 420" role="img" aria-hidden="true">
  <rect width="960" height="420" fill="${palette.paper}"/>
  ${polygon('0,0 280,0 0,210', '#efe7d8')}
  ${polygon('960,420 690,420 960,210', '#efe7d8')}
  <circle cx="${190 + index * 7}" cy="${76 + (index % 5) * 12}" r="84" fill="${accent}" opacity=".12"/>
  <circle cx="${746 - index * 5}" cy="${296 - (index % 4) * 14}" r="116" fill="${palette.gold}" opacity=".12"/>
  <path d="M74 344 C260 290,386 304,548 246 S768 154,890 194" fill="none" stroke="${accent}" stroke-width="14" stroke-linecap="round" opacity=".16"/>
  <g transform="rotate(${tilt * 1.6} 480 210)">
    ${motifs[motif](accent)}
  </g>
</svg>`;
}

mkdirSync(outDir, { recursive: true });

for (const [index, scene] of scenes.entries()) {
  writeFileSync(resolve(outDir, `${scene[0]}.svg`), svg(scene, index), 'utf8');
}

console.log(`Generated ${scenes.length} question illustrations in ${outDir}`);
