/**
 * lang.js — language preference + UI string translations
 * Supports 'en' (English) and 'my' (Myanmar / Burmese Unicode)
 */

const STRINGS = {
  en: {
    exerciseLabel:    'Exercise',
    quizLabel:        'Quiz',
    exampleLabel:     'Example',
    showHint:         'Show hint',
    hideHint:         'Hide hint',
    showSolution:     'Show solution (after 3 attempts)',
    hideSolution:     'Hide solution',
    run:              '▶ Run',
    runLoading:       '▶ Run (loading Python…)',
    running:          '⏳ Running…',
    reset:            'Reset',
    noOutput:         '(no output)',
    loadingPython:    'Loading Python…',
    searchPlaceholder:'Search lessons…',
    noResults:        'No lessons match your search.',
    viewProgress:     'View progress →',
    lessonsCompleted: 'lessons completed',
    homeTitle:        'Learn to Code',
    homeSubtitle:     '13 Python lessons — from zero to writing real programs. Works offline.',
    navLessons:       'Lessons',
    navProgress:      'My Progress',
    navAbout:         'About',
  },
  my: {
    exerciseLabel:    'လေ့ကျင့်ခန်း',
    quizLabel:        'မေးခွန်း',
    exampleLabel:     'နမူနာ',
    showHint:         'အကြံပြုချက် ကြည့်ရန်',
    hideHint:         'အကြံပြုချက် ဖျောက်ရန်',
    showSolution:     'ဖြေချက် ကြည့်ရန် (၃ ကြိမ်ကြိုးစားပြီးနောက်)',
    hideSolution:     'ဖြေချက် ဖျောက်ရန်',
    run:              '▶ လုပ်ဆောင်ရန်',
    runLoading:       '▶ လုပ်ဆောင်ရန် (Python တင်နေသည်…)',
    running:          '⏳ လုပ်ဆောင်နေသည်…',
    reset:            'ပြန်လည်သတ်မှတ်ရန်',
    noOutput:         '(ထွက်ရှိမှုမရှိပါ)',
    loadingPython:    'Python တင်နေသည်…',
    searchPlaceholder:'သင်ခန်းစာများ ရှာဖွေရန်…',
    noResults:        'သင့်ရှာဖွေမှုနှင့် ကိုက်ညီသောသင်ခန်းစာ မရှိပါ။',
    viewProgress:     'တိုးတက်မှု ကြည့်ရန် →',
    lessonsCompleted: 'သင်ခန်းစာ ပြီးဆုံးပြီ',
    homeTitle:        'ကုဒ်သင်ယူရန်',
    homeSubtitle:     'Python သင်ခန်းစာ ၁၃ ခု — အစကနေ ပရိုဂရမ်ရေးသားနိုင်သည်အထိ။ အင်တာနက်မလိုပါ။',
    navLessons:       'သင်ခန်းစာများ',
    navProgress:      'ကျွန်ုပ်၏တိုးတက်မှု',
    navAbout:         'အကြောင်း',
  },
};

export function getLang() {
  return localStorage.getItem('lang') ?? 'en';
}

export function setLang(lang) {
  localStorage.setItem('lang', lang);
  location.reload();
}

export function t(key) {
  const lang = getLang();
  return STRINGS[lang]?.[key] ?? STRINGS.en[key] ?? key;
}

export function applyLangAttr() {
  document.documentElement.lang = getLang() === 'my' ? 'my' : 'en';
}
