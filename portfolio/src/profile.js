/* =====================================================================
   PROFILE — 여기만 고치면 페이지 내용이 바뀝니다.
   블록 종류: {p}, {h}, {kv:[[키,값]]}, {tags:[...]}, {loot:[{t,d,tags,href}]}
   tags에 적은 항목 하나하나가 맵 위의 "기술 룬" 수집품이 됩니다.
   ===================================================================== */
export const PROFILE = {
  name: 'KIKI',
  role: 'AI Native Designer',
  lead: '연필 한 자루로 시작해 삼각자를 얻고, 끝내 만든 것을 세상에 내놓기까지. 모닥불에서 일어나 길을 하나씩 열며 제 기록을 깨워 보세요.',
  /* 배움의 순서: 학교를 다니며 익힌 순서대로 적습니다. 이 순서대로 길 위에 "기술 룬"이 놓이고 일지에 번호가 붙습니다.
     when 은 선택 사항입니다(예: '1학년', '2023'). 지금 순서는 임시이니 실제 순서로 바꿔 주세요. */
  journey: [
    { tag: '컨셉 디자인', when: '' }, { tag: 'UX 설계', when: '' }, { tag: '인터랙션 디자인', when: '' }, { tag: 'Figma', when: '' },
    { tag: '프로토타이핑', when: '' }, { tag: '서비스 설계', when: '' }, { tag: 'Python', when: '' }, { tag: 'Node.js', when: '' },
    { tag: 'Flutter', when: '' }, { tag: 'Firebase', when: '' }, { tag: '프롬프트 설계', when: '' }, { tag: 'Claude', when: '' },
    { tag: 'Claude Code', when: '' }, { tag: 'AI 에이전트 설계', when: '' }, { tag: '교육 설계', when: '' }, { tag: 'three.js', when: '' }
  ],
  realms: [
    { id: 'about', label: '소개', place: '기원의 예배당', title: 'AI와 함께 생각하고, 끝까지 만들어 내는 디자이너',
      blocks: [
        { p: '화면을 그리는 데서 멈추지 않습니다. AI를 동료 삼아 아이디어를 기획하고, 디자인하고, 실제로 동작하는 제품까지 직접 완성합니다.' },
        { p: '감정 일기 앱 「해피리」와 AI 대화를 글로 바꿔 주는 블로그 플랫폼을 그렇게 만들었고, 지금 보고 계신 이 페이지도 AI와 대화하며 지었습니다.' },
        { kv: [['역할', 'AI Native Designer'], ['일하는 방식', '기획 → 디자인 → 구현을 AI와 한 흐름으로'], ['관심', 'AI를 누구나 쓰는 일상 도구로 만드는 경험 설계']] }
      ] },
    { id: 'skills', label: '기술', place: '무기고의 대장간', title: '손에 익은 무기들',
      blocks: [
        { h: '디자인' }, { tags: ['UX 설계', '인터랙션 디자인', '컨셉 디자인', '프로토타이핑', 'Figma'] },
        { h: 'AI 협업' }, { tags: ['Claude', 'Claude Code', 'AI 에이전트 설계', '프롬프트 설계'] },
        { h: '구현' }, { tags: ['Flutter', 'Firebase', 'Python', 'Node.js', 'three.js'] }
      ] },
    { id: 'projects', label: '프로젝트', place: '전리품의 시장', title: '지금까지 얻은 전리품',
      blocks: [
        /* loot 항목: t 제목, k 한 줄 분류, d 설명, tags, href(공개 링크가 있을 때만) */
        { loot: [
          { t: 'LG 산학협력 프로젝트', k: '산학협력 · 비공개', d: '기업과 함께한 산학협력 프로젝트입니다. 보안 서약에 따라 세부 내용은 공개하지 않습니다.', tags: ['컨셉 디자인', '산학협력'] },
          { t: 'JARVIS', k: 'macOS AI 음성 비서', d: '말로 부르면 깨어나 캘린더, 메일, 메모, 브라우저, 음악을 대신 다뤄 주는 맥 전용 음성 비서. 대시보드와 음성 흐름까지 직접 설계했습니다.', tags: ['AI 에이전트 설계', 'Python'] },
          { t: 'Local AI Smart Assistant', k: '로컬 우선 AI 비서', d: '내 맥 안에서만 도는 AI 비서 런타임. 메일, 일정, 알림을 로컬 모델로 처리하고, 권한이 없을 때는 안전하게 물러나도록 경계를 설계했습니다.', tags: ['AI 에이전트 설계', 'Python'], href: 'https://github.com/KIKI0715/local-ai-smart-assistant' },
          { t: 'FTT 실습 에이전트 패키지', k: 'Claude Code 교육 자료', d: '트렌드를 모아 From, Trend, To로 발산하고 가장 강한 하나를 컨셉으로 수렴시킨 뒤 스스로 검수하는 에이전트 6종. 폴더를 열면 바로 쓸 수 있게 묶었습니다.', tags: ['AI 에이전트 설계', 'Claude Code', '컨셉 디자인'] },
          { t: '스마트 인터랙션 디자인 제출 허브', k: '수업 운영 도구', d: '학생들이 낸 결과물 링크를 한 화면에서 열어 보고, 교수자 모드에서는 판단 기준을 옆에 두고 채점 내용을 적는 허브. 실명과 성적은 저장소 밖에 두도록 설계했습니다.', tags: ['UX 설계', '서비스 설계'], href: 'https://github.com/KIKI0715/si-hub' },
          { t: '실습 아카이브 키트', k: '수강생용 템플릿', d: '코드와 터미널 없이 Claude에게 말로 시켜 실습 97개를 자기 웹사이트에 올리게 해 주는 시작 키트와 안내서.', tags: ['교육 설계', 'Claude Code'], href: 'https://github.com/KIKI0715/si-setup' },
          { t: '해피리', k: '감정 일기 앱', d: '하루의 감정을 적고, 분석 화면에서 흐름을 돌아보는 모바일 앱. 하단 내비게이션, 분석, 프로필 화면의 경험을 설계하고 구현까지 했습니다.', tags: ['UX 설계', 'Flutter', 'Firebase'] },
          { t: 'AI 대화 블로그 자동화', k: '모바일 우선 플랫폼', d: 'AI와 나눈 대화를 저장하고, 다듬어진 글로 바꾼 뒤 바로 발행하는 플랫폼. 대화가 글이 되는 흐름을 처음부터 끝까지 설계했습니다.', tags: ['서비스 설계', 'Claude', 'Flutter', 'Node.js'] },
          { t: 'Emberfall Saga', k: '플레이하는 포트폴리오', d: '지금 이 페이지. 소개를 읽는 대신 직접 플레이하며 발견하게 만든 3인칭 액션 포트폴리오로, AI와 대화하며 기획, 연출, 구현했습니다.', tags: ['인터랙션 디자인', 'three.js', 'Claude Code'] }
        ] }
      ] },
    { id: 'contact', label: '연락', place: '전령의 성', title: '전령을 보내려면',
      blocks: [
        { p: '함께 만들 일이 있다면 GitHub로 찾아와 주세요.' },
        { kv: [['GitHub', { href: 'https://github.com/kiki0715', text: 'github.com/kiki0715' }]] }
        /* 이메일을 넣으려면: ['Email', 'you@example.com'] 을 kv에 추가 */
      ] }
  ]
};
