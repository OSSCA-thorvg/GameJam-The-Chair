# 프로젝트 목표

이 프로젝트는 thorvg라이브러리를 사용하는 예제를 만들기 위함이다. 반드시 thorvg의 특징을 최대한 사용하라.

플레이어가 다양한 오브젝트와 상호작용하며 예상치 못한 상황을 발견하고, **엉뚱한 B급 감성** 속에서 즐거움을 느끼는 게임을 만든다. 모든 기획과 개발의 최우선 기준은 **플레이어가 즐거운가**이다.

- 모든 기획과 개발에서 플레이어의 즐거움을 최우선으로 고려한다.
- 글은 적을수록 좋다. 스토리와 조작 방법은  게임 연출로 전달한다.

## 개발 환경

- 언어와 도구: TypeScript 5.9, Vite 6, npm, ThorVG WebCanvas 1.1.3

처음 실행 명령어 

```bash
nvm use
npm ci
npm run dev
```

production build와 build 결과 확인

```
npm run build
npm run preview
```

### 개발 테스트

의존성을 설치한 뒤 변경 범위에 맞는 테스트 실행

```bash
npm run typecheck
npm run lint
npm run test:fast
```

작업 완료 전에는 CI와 배포가 사용하는 전체 검증

```bash
npm run typecheck
npm run lint
npm test
npm run build
```

## 참고 문서


| 문서                                  | 얻을 수 있는 정보                                                                    |
| ----------------------------------- | ----------------------------------------------------------------------------- |
| `docs/architecture/README.md`       | 전체 데이터 흐름, 세 페이지의 진입점, 디렉터리별 책임, 다음에 읽을 문서                                    |
| `docs/architecture/runtime.md`      | `main.ts` 초기화, 입력에서 command까지의 흐름, 120 Hz 고정 틱, draw, 저장과 오류 경계               |
| `docs/architecture/game-core.md`    | `GameState`, command, event, `stepGame`, 틱 순서, stage hook, 결정성, replay 계약     |
| `docs/architecture/presentation.md` | ThorVG와 Canvas2D 레이어, `DrawCommand` paint 경로, effect, feedback, i18n, 모션 미리보기 |
| `docs/architecture/development.md`  | 개발 명령, 테스트별 보장 범위, 변경 유형별 검증, 기능별 시작 파일                                       |
| `src/game/README.md`                | 결정적 코어의 구현 규칙과 금지 API, golden과 replay 사용법                                     |
| `src/game/stages/README.md`         | stage 폴더 구조, hook 순서, stage 추가 절차와 의존 규칙                                      |
| `tests/support/README.md`           | 테스트 loader, harness, route, golden, determinism helper                        |
| `docs/debug.md`                     | 게임 디버그 도구                                                                     |


## 언어

- 모든 git에 트래킹되는 파일의 문자는 가능한 영어 다국어 지원이 가능하다면 한국어를 추가한다.
- 주석이 필요하다면 그것도 영어로 작성한다.
- 단, 답변 자체는 한국어로 한다.

## GIT 지침

- 작업하기 전에 main을 pull받아 업데이트 사항을 받아라.
- 새로운 코드 작업을 한다면 워크트리를 하나 만들어 작업한다.
- 작업 단위가 완료될 때, git 추적 파일에 변경사항이 있다면 커밋한다.
- github에 PR을 요청받는다면 PR이후 그 PR에 해당하는 워크트리와 브랜치를 삭제한다.
- PR은 한국어로 올린다.

## 개발 지침

- 주석은 이해를 위해 반드시 필요한 경우에만 작성한다.

## 작업 지침

- 작업이 끝나면 확인할 수 있도록 서버를 실행해 높고 어떤 Url로 들어가야하는지 알려야한다.
- 모션을 수정하거나 테스트할 때는 개발 서버의 `/preview.html`에서 확인하고, 없는 모션은 미리보기 장면으로 등록한다.
- 서브에이전트 생성 시 Orca CLI(`orchestration` / `orca-cli` skill)를 사용해 실제 워크트리 창을 띄우고, 사용자가 진행 상황을 실시간으로 관찰할 수 있도록 한다.

