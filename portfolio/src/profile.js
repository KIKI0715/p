/* =====================================================================
   PROFILE — 여기만 고치면 페이지 내용이 바뀝니다.
   블록 종류: {p}, {h}, {kv:[[키,값]]}, {tags:[...]}, {loot:[{t,d,tags,href}]}
   tags에 적은 기술 하나하나가 맵 위의 "기술 룬" 수집품이 됩니다.
   ===================================================================== */
export const PROFILE = {
  name: 'KIKI',
  role: '모바일 · 백엔드 개발자',
  lead: '모닥불에서 일어나 숲속 네 곳의 묘역을 찾아가세요. 잠든 해골 수호자를 쓰러뜨리고 봉인을 풀면 제 기록이 하나씩 깨어납니다.',
  realms: [
    { id: 'about', label: '소개', place: '기원의 제단', title: '화면부터 서버까지 혼자 짓는 개발자',
      blocks: [
        { p: 'Flutter로 앱의 화면을 만들고, Node.js와 Firebase로 그 뒤를 받칩니다. 아이디어를 실제로 설치할 수 있는 앱까지 끌고 가는 과정을 좋아합니다.' },
        { p: '최근에는 AI와 나눈 대화를 글로 바꿔 주는 블로그 자동화 플랫폼과 감정 일기 앱 「해피리」를 만들었습니다.' },
        { kv: [['역할', '모바일 · 백엔드 개발'], ['주력', 'Flutter, Node.js, Firebase'], ['관심', 'AI를 일상 도구로 만드는 일']] }
      ] },
    { id: 'skills', label: '기술', place: '무기고의 기둥', title: '손에 익은 무기들',
      blocks: [
        { h: '모바일' }, { tags: ['Flutter', 'Dart', 'Riverpod', 'Android'] },
        { h: '백엔드' }, { tags: ['Node.js', 'Express', 'TypeScript', 'MongoDB'] },
        { h: '클라우드 · 배포' }, { tags: ['Firebase Firestore', 'Cloud Functions', 'Docker', 'Railway', 'GitHub Actions'] },
        { h: 'AI' }, { tags: ['Claude API', '프롬프트 설계'] }
      ] },
    { id: 'projects', label: '프로젝트', place: '전리품의 관', title: '지금까지 얻은 전리품',
      blocks: [
        { loot: [
          { t: '해피리 — 감정 일기 앱', d: '하루의 감정을 적고, 분석 화면에서 흐름을 돌아보는 모바일 앱. 하단 내비게이션, 분석, 프로필 화면까지 직접 설계했습니다.', tags: ['Flutter', 'Firebase', 'Cloud Functions'] },
          { t: 'AI 대화 → 개발 블로그 자동화', d: 'AI와 나눈 대화를 저장하고, 다듬어진 개발 글로 바꾼 뒤 Dev.to에 바로 발행하는 모바일 우선 플랫폼.', tags: ['Node.js', 'Express', 'TypeScript', 'MongoDB', 'Claude API', 'Flutter'] }
        ] }
      ] },
    { id: 'contact', label: '연락', place: '전령의 납골당', title: '전령을 보내려면',
      blocks: [
        { p: '함께 만들 일이 있다면 GitHub로 찾아와 주세요.' },
        { kv: [['GitHub', { href: 'https://github.com/kiki0715', text: 'github.com/kiki0715' }]] }
        /* 이메일을 넣으려면: ['Email', 'you@example.com'] 을 kv에 추가 */
      ] }
  ]
};
