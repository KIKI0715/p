# Emberfall Saga — 플레이하는 개인 페이지

연필 한 자루를 든 방랑자를 조종해 밤의 숲에서 길을 하나씩 열고, 해골 수호자를 쓰러뜨려 소개·기술·프로젝트·연락 기록을 깨우는 3인칭 액션 개인 페이지입니다. 디자이너가 만드는 사람이 되어 가는 여정을 도구로 표현했습니다: 연필로 긋고, 삼각자를 얻어 재고, 끝내 출시합니다.

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

`src/profile.js`의 `PROFILE`만 고치면 됩니다. 이름, 소개 문구, 기술, 프로젝트, 연락처가 모두 여기 있습니다. `journey`에는 기술을 배운 순서대로 적으세요. 그 순서대로 길 위에 수집품(기술 룬)이 놓이고 일지에 번호가 붙습니다.

## 배포하기

`npm run build`로 나온 `dist/` 폴더는 어느 정적 호스팅에나 그대로 올릴 수 있습니다.

- **GitHub Pages**: 저장소 Settings → Pages → Source를 "GitHub Actions"로 바꾼 뒤, Actions 탭에서 "Deploy portfolio to Pages"를 수동 실행하세요.
- **Vercel / Netlify / Cloudflare Pages**: 루트 디렉터리 `portfolio`, 빌드 명령 `npm run build`, 출력 폴더 `dist`.

## 여정의 구조

주인공은 연필 한 자루로 시작합니다. 기록을 하나 깨울 때마다 다음 길과 새 도구가 열립니다.

| 순서 | 장소 | 깨우면 얻는 것 |
|---|---|---|
| 1 | 북쪽 예배당 (소개) | 삼각자 던지기, 동쪽 길 |
| 2 | 동쪽 대장간 (기술) | 출시(광역기), 남쪽 길 |
| 3 | 남쪽 시장 (프로젝트) | 서쪽 길 |
| 4 | 서쪽 성 (연락) | 해골왕과 엔딩 |

길 위의 기술 룬은 `PROFILE.journey`에 적은 순서(배운 순서)대로 놓입니다. 경험치가 쌓여 레벨이 오르면 공격이 바뀝니다: 3타, 4타, 굵은 획, 튕기는 삼각자, 베는 대시, 착지 충격, 넓은 출시.

## 조작

- 이동 `WASD`, 질주 `Shift`, 대시 `Space`, 시점 마우스
- 연필 긋기(연속) 클릭, 삼각자 던지기·회수 우클릭 또는 `Q` (첫 기록 이후)
- 출시 `R` (둘째 기록 이후, 몰입 게이지가 찼을 때), 조사 `E` 길게, 일지 `J`
- 나무, 울타리, 묘비는 긋거나 삼각자로 맞히면 부서집니다.
- 모바일: 왼쪽 드래그 이동, 오른쪽 드래그 시점, 화면 버튼
- 주소 뒤에 `#about`, `#skills`, `#projects`, `#contact`, `#journal`을 붙이면 게임 없이 해당 기록이 바로 열립니다.

## 영감

아이디어와 연출은 God of War(2018)와 God of War Ragnarök에서 영감을 받았습니다. 캐릭터, 세계, 에셋은 그와 별개로 만든 것입니다.

## 에셋과 라이선스

모델, 효과음, 음악은 [Patch](https://patch.gg) 에셋 라이브러리에서 가져온 CC0 / CC BY 4.0 작품입니다(KayKit, Kenney, Juhani Junkala, Kevin MacLeod). 전체 출처는 `public/assets/CREDITS.md`, 라이선스 전문은 `public/assets/LICENSES/`에 있고 게임 안 일지에도 표시됩니다. CC BY 작품이 있으니 이 출처 표기는 지우지 마세요.
