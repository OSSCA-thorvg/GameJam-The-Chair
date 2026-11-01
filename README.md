# GameJam-The-Chair

ThorVG WebCanvas로 빨간 사각형을 그리는 기본 예제입니다.

## 실행

Node.js 22 이상이 필요합니다. nvm을 사용한다면 먼저 `nvm use`를 실행합니다.

```sh
npm install
npm run dev
```

브라우저에서 http://127.0.0.1:5173 을 열면 흰색 800×600 캔버스의 (100, 100)에
빨간색 200×200 사각형이 표시됩니다. WebGL 2를 지원하는 브라우저가 필요합니다.

```sh
npm run build
npm run preview
```

`src/main.js`에서 ThorVG를 초기화하고 Shape를 생성해 캔버스에 추가합니다.
WASM 파일은 설치된 패키지에서 불러오며, Vite가 개발 서버와 빌드 결과에 제공합니다.

참고: [ThorVG 공식 WebCanvas 튜토리얼](https://www.thorvg.org/web-tutorial)
