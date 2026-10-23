// Shared website / Apps Script content. Tests enforce ServiceCare.gs parity.
globalThis.WaxingServiceCare = (() => {
  const version = '20261023-care2';
  const safety = '以下為 77waxing 服務提醒，非醫療診斷或療效保證。若有疾病、用藥、懷孕、傷口或持續不適，請先告知店家，必要時諮詢醫師；勿自行停藥。';
  const during = ['開始前會確認服務範圍與當天狀況；施作中如有疼痛、灼熱或其他不適，請立即告知，暫停並評估是否繼續。'];
  const guides = {
    wax: {
      title: '熱蠟除毛',
      before: [
        '除毛前一週請勿使用去角質、酸類或美白產品。',
        '毛髮請保留至少 0.5 公分，請勿自行剃除或修剪。',
        '若施作處有傷口、未癒合傷口、曬傷、發炎或皮膚疾病，請先告知並暫緩施作。',
        '若安排玩水、游泳或泡湯，請至少提前 5 天與店家討論時間；施作後仍應遵守一週內避免相關活動的提醒。',
        '若懷孕，請事先告知目前週數與預產期；39 週以上暫不安排熱蠟除毛。',
        '若有糖尿病、蟹足腫體質、異位性皮膚炎、蠶豆症，或正在服用抗生素、痘痘藥，請先諮詢醫師並告知店家。',
        '近期果酸換膚、皮膚薄弱、傳染性皮膚疾病、癌症治療中或腿部嚴重靜脈曲張者，請先告知；由店家與醫療專業人員評估是否適合。'
      ],
      during,
      after: [
        '除毛後 4–6 小時內避免碰生水，勿使用過熱的水洗澡。',
        '一週內避免酸類、美白等刺激性產品與日曬。',
        '減少摩擦，勿穿過緊衣物，避免過度擦拭與清洗。',
        '一週內避免游泳、泡湯等活動。',
        '若使用護墊或衛生棉，請勤更換，避免悶住過久。',
        '洗澡後使用不含美白、酸類成分的保濕乳液。',
        '若無不適，可依店家指導於第三天起溫和去角質，每週 1–2 次；有刺激或傷口時先暫停。',
        '可能出現暫時紅點或泛紅；若紅腫、疼痛持續或加劇，請停止刺激並諮詢醫師。'
      ]
    },
    face: {
      title: '臉部保養',
      before: [
        '做臉前一週，請勿使用去角質、酸類產品。',
        '若有過敏、皮膚炎、酒糟肌等皮膚問題，請先諮詢並告知；狀況嚴重時請先就醫。',
        '若近期有宴客、拍攝等重要場合，請事先告知，以討論適合的安排。',
        '若懷孕，請事先告知，確認產品與流程是否適合。',
        '若近期進行雷射、果酸、微整等醫美療程，請事先告知。'
      ],
      during,
      after: [
        '做臉後請隔 6 小時再碰水，並做好日常防曬。',
        '肌膚照護期間避免日曬、強風吹拂與空氣品質不佳的環境。',
        '騎車時配戴口罩，回家做好保濕。',
        '一週內避免酸類、酒精等刺激性護膚品。'
      ],
      extraTitle: '肌膚保養週期（店家參考安排）',
      extra: [
        '處理期：參考 1–2 週，依實際膚況與店家討論安排。',
        '觀察期：參考 2–3 週，持續觀察並照顧肌膚。',
        '保養期：參考 4–5 週，依膚況安排維護。',
        '保養並非一次即能解決所有問題，以上週期非固定療程或效果保證；若持續冒痘、發炎或惡化，請就醫評估。'
      ]
    },
    massage: {
      title: '撥筋／臉部按摩',
      before: [
        '按摩、撥筋前請勿空腹或過飽。',
        '若皮膚正處於過敏、發炎，或有特殊疾病、癌症等情形，請事先告知並暫緩按摩、撥筋，先諮詢醫師。'
      ],
      during,
      after: [
        '按摩後可補充水分並適度休息。',
        '若出現痠痛、頭重、疲倦、腫脹等不適，請告知店家；持續或加劇時請諮詢醫師，不要一律視為正常反應。'
      ]
    },
    bust: {
      title: '胸部保養',
      before: [
        '若胸部範圍有嚴重蟹足腫，請先告知並諮詢是否適合。',
        '若胸部有傷口、發炎，不適合進行胸部按摩。',
        '若曾進行胸部療程，請務必事先告知；本店暫不提供隆乳後按摩服務。',
        '若曾有乳癌、乳腺腫瘤等疾病，或胸部有任何不適，請先諮詢醫師，再評估是否按摩。'
      ],
      during,
      after: [
        '按摩後適量補充水分、充分休息。',
        '若有痠痛或其他不適，請告知店家；持續、加劇或出現異常時，請尋求醫療專業協助。'
      ],
      extraTitle: '日常保養參考',
      extra: [
        '維持均衡飲食、規律作息與適度運動。',
        '保養頻率請依個人狀況與店家討論，非固定次數或效果保證。',
        '挑選合適的內衣並適時更換；不適或有病史時勿自行用力按摩。'
      ]
    },
    general: {
      title: '服務',
      before: ['此項目的專屬須知尚待店家確認。請在施作前與 77waxing 確認適用的準備方式，並告知當天膚況、傷口、過敏、用藥或近期療程。'],
      during,
      after: ['請依本次實際項目與店家提供的照護方式進行；如有持續不適，請諮詢醫師。']
    }
  };
  function resolve(category, item, group = {}) {
    const key = String(category?.key || '');
    const name = String(item?.name || '');
    const context = `${category?.name || ''} ${category?.slug || ''} ${group?.id || ''} ${group?.title || ''}`;
    if (/熱蠟|除毛|wax/i.test(name)) return ['wax'];
    if (['women', 'men'].includes(key) || /熱蠟|waxing/i.test(context)) return ['wax'];
    if (/胸腹/.test(name)) return ['bust', 'general'];
    if (key === 'bust' || /美胸|胸部保養|bust-care|胸部放鬆|胸放鬆/.test(context + name)) return ['bust'];
    if (/撥筋|鬆筋|臉部按摩/.test(name) || /臉部放鬆|massage-price-list/.test(context)) return ['face', 'massage'];
    if (/skin-body|美背|屁屁|肩頸胸|臀部|背部/.test(context + name)) return ['general'];
    if (/臉部保養|facial/.test(context) || (key === 'skin' && (group.id === 'skin-face' || /臉部|粉刺|CICA|安瓶|水光|外泌|濃縮原液|矽晶煥膚/.test(name)))) return ['face'];
    return ['general'];
  }
  function forSelection(category, item, group, addons = []) {
    return [...new Set([...resolve(category, item, group), ...addons.flatMap(name => resolve(category, {name}, {}))])].map(id => ({id, ...guides[id]}));
  }
  function forBooking(booking) {
    const name = String(booking?.serviceName || '');
    const parts = name.split(/[｜|]/);
    const categoryName = parts.length > 1 ? parts.shift() : '';
    const itemName = parts.join('｜') || name;
    const key = /女性熱蠟|男士熱蠟/.test(categoryName) ? 'women' : /肌膚/.test(categoryName) ? 'skin' : /美胸|胸部/.test(categoryName) ? 'bust' : '';
    const addonLine = String(booking?.note || '').split('\n').find(line => line.trim().startsWith('[加購項目]')) || '';
    const addons = addonLine.replace('[加購項目]', '').split('、').map(v => v.trim()).filter(Boolean);
    return forSelection({key, name:categoryName}, {name:itemName}, {}, addons);
  }
  return {version, safety, guides, resolve, forSelection, forBooking};
})();
