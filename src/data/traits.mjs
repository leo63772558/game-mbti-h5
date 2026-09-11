export const hiddenTraits = [
  {
    id: 'scripted_gambler',
    name: '脚本赌徒',
    priority: 10,
    triggerType: 'keyword_combo',
    conditions: {
      keywordsAll: ['背板', '莽'],
      polesMin: { B: 3, C: 3 },
    },
    headline: '看起来像押命，其实全是练过。',
    copy: '你把高风险操作练成肌肉记忆，别人以为你在赌，你只是在执行。',
  },
  {
    id: 'map_ghost',
    name: '地图幽灵',
    priority: 20,
    triggerType: 'single_pole_spike',
    conditions: {
      keywordsAny: ['探索', '支线', '开图'],
      polesMin: { W: 3 },
    },
    headline: '主线还没催动你，边界已经先喊你。',
    copy: '你总能钻进地图缝隙，把别人路过的角落玩成一整段冒险。',
  },
  {
    id: 'warm_commander',
    name: '暖场指挥',
    priority: 30,
    triggerType: 'dual_high_conflict',
    conditions: {
      keywordsAny: ['控场', '羁绊', '共鸣'],
      polesMin: { T: 3, I: 3 },
    },
    headline: '你能排战术，也能接住队友情绪。',
    copy: '你在效率和关系之间来回切换，像一台会安慰人的战术终端。',
  },
];
