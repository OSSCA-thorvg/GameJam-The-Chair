import { init } from '@thorvg/webcanvas';
import wasmUrl from '../node_modules/@thorvg/webcanvas/dist/thorvg.wasm?url';
import './style.css';

async function main() {
  const TVG = await init({
    renderer: 'gl',
    locateFile: () => wasmUrl,
  });

  const canvas = new TVG.Canvas('#canvas', { width: 800, height: 600 });
  const rectangle = new TVG.Shape();
  rectangle.appendRect(100, 100, 200, 200);
  rectangle.fill(255, 0, 0, 255);

  canvas.add(rectangle);
  canvas.render();
}

main().catch((error) => {
  console.error('ThorVG 초기화 실패:', error);
  const message = document.querySelector('#error');
  message.textContent = 'ThorVG를 실행하지 못했습니다. WebGL 2 지원 여부와 개발자 콘솔을 확인하세요.';
  message.hidden = false;
});
