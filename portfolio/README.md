# Emberfall Saga — 플레이하는 개인 페이지

밤의 숲에서 야만 전사를 조종해 네 곳의 묘역을 찾아가고, 해골 수호자를 쓰러뜨려 소개·기술·프로젝트·연락 기록을 하나씩 깨우는 3인칭 액션 개인 페이지입니다.

## 맥에서 실행하기

Node 18 이상이 필요합니다.

```bash
cd portfolio
npm install
npm run dev        # http://localhost:5173 에서 바로 확인
npm run build      # dist/ 폴더에 배포용 파일 생성
```

`index.html`을 더블클릭해서는 열리지 않습니다(모델 파일을 불러와야 해서 로컬 서버가 필요합니다).

## 내용 고치기

`src/profile.js`의 `PROFILE`만 고치면 됩니다. 이름, 소개 문구, 기술, 프로젝트, 연락처가 모두 여기 있고, `tags`에 적은 기술 하나하나가 맵 위의 수집품(기술 룬)이 됩니다.

## 배포하기

`npm run build`로 나온 `dist/` 폴더는 어느 정적 호스팅에나 그대로 올릴 수 있습니다.

- **GitHub Pages**: 저장소 Settings → Pages → Source를 "GitHub Actions"로 바꾼 뒤, Actions 탭에서 "Deploy portfolio to Pages"를 수동 실행하세요.
- **Vercel / Netlify / Cloudflare Pages**: 루트 디렉터리 `portfolio`, 빌드 명령 `npm run build`, 출력 폴더 `dist`.

## 조작

- 이동 `WASD`, 질주 `Shift`, 시점 마우스
- 베기(3연타) 클릭, 도끼 던지기·회수 우클릭 또는 `Q`
- 대시 `Space`, 불씨 폭발 `R`(게이지가 찼을 때), 조사 `E` 길게, 일지 `J`
- 모바일: 왼쪽 드래그 이동, 오른쪽 드래그 시점, 화면 버튼
- 주소 뒤에 `#about`, `#skills`, `#projects`, `#contact`, `#journal`을 붙이면 게임 없이 해당 기록이 바로 열립니다.

## 에셋과 라이선스

모델, 효과음, 음악은 [Patch](https://patch.gg) 에셋 라이브러리에서 가져온 CC0 / CC BY 4.0 작품입니다(KayKit, Kenney, Juhani Junkala, Kevin MacLeod). 전체 출처는 `public/assets/CREDITS.md`, 라이선스 전문은 `public/assets/LICENSES/`에 있고 게임 안 일지에도 표시됩니다. CC BY 작품이 있으니 이 출처 표기는 지우지 마세요.
