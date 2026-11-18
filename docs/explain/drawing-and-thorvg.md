# 그리기 명령과 ThorVG 코드 읽기

대상은 [render/types.ts](../../src/render/types.ts), [paint.ts](../../src/render/paint.ts), [paint/commands.ts](../../src/render/paint/commands.ts), [paint/thorvg.ts](../../src/render/paint/thorvg.ts), [thorvg.ts](../../src/render/thorvg.ts)입니다.

## types.ts는 장면과 백엔드 사이의 약속이다

`DrawCommand`는 `PathCommand | TextCommand`입니다. `kind`를 보면 도형인지 글자인지 알 수 있습니다. 도형은 점과 곡선, 채움, 선, trim, layer를 포함합니다. `Curve`의 숫자 여섯 개는 cubic 곡선의 제어점 두 개와 끝점 좌표입니다.

`Gradient`는 시작과 끝 또는 반지름, 색상 정지점을 표현합니다. `LayerSpec`은 여러 도형에 적용할 opacity, blend, blur, motionBlur, clip, mask를 표현합니다. `retained`는 유지할 도형의 식별자와 변환 및 범위를 전달합니다.

장면은 이 데이터만 만들기 때문에 ThorVG 자원 수명을 직접 관리하지 않습니다. 그림을 표현하는 데이터와 실제 엔진 객체를 구분해서 읽습니다.

## paint.ts는 사용할 백엔드를 정한다

```ts
if (tvg && TVG) {
    paintThorvg(ctx, TVG, tvg, pool, collect(commands), stats);
}
```

`TVG`는 엔진의 클래스와 기능에 접근하는 객체이고 `tvg`는 현재 canvas의 인스턴스입니다. 둘 다 준비되면 ThorVG로 그립니다. 준비되지 않았으면 base canvas를 지우고 `paintCanvas`를 호출합니다.

그 전에 성능 분석용 layer override를 적용합니다. 따라서 명령 생성 코드가 같아도 개발용 layer 설정으로 일부 효과를 비교할 수 있습니다.

## commands.ts는 인접 layer를 모은다

`collect`는 명령을 앞에서부터 읽습니다. 효과 없는 경로는 독립 항목으로, layer 효과가 있는 연속 경로는 묶인 항목으로 만듭니다. 텍스트가 나오면 현재 묶음을 끊습니다. 같은 key가 여러 구간에서 나오면 구간별 key를 만듭니다.

단순히 같은 layer key인 모든 도형을 한곳에 모으지 않는 이유는 그리기 순서가 달라질 수 있기 때문입니다. 먼저 그린 물체와 나중에 그린 물체의 앞뒤 관계를 유지해야 합니다.

`canvasBox`는 도형 범위를 계산해 화면 밖 도형을 제외합니다. 특히 소프트웨어 백엔드에서 화면 밖 도형이 layer의 처리 범위를 불필요하게 키우는 것을 피합니다.

## paint/thorvg.ts는 데이터를 엔진 객체로 바꾼다

처음 읽을 때는 `paintThorvg`에서 시작한 뒤 호출되는 함수를 따라갑니다.

1. `paintThorvg`가 필요한 Shape와 Text 수, 배치 순서를 계산합니다.
2. 일반 path는 `applyShape`, 글자는 `applyText`, layer는 `syncLayer`로 갱신합니다.
3. 순서가 바뀌면 canvas의 항목을 다시 연결합니다.
4. `tvg.update().render()`로 변경을 반영하고 출력합니다.

`applyShape` 안에서는 `tracePath`가 점과 곡선을 엔진 경로로 옮기고 fill, stroke, trim, blend를 적용합니다. 이전 프레임에는 선이 있고 지금은 없다면 그 스타일도 지워야 합니다. `AppliedStyle`은 재사용한 객체에 과거 설정이 남는 일을 막는 데 사용합니다.

`PaintPool`의 `top`은 일반 Shape, `texts`는 글자 슬롯, `layers`는 key별 Scene과 자식 Shape를 보관합니다. 매 프레임 새 엔진 객체를 모두 만드는 대신 필요한 만큼 늘리고 기존 객체를 갱신합니다. 남는 객체는 보이지 않게 처리합니다.

`syncLayer`는 그룹의 자식과 효과를 맞춥니다. `applyLayerEffects`에서 scene의 Gaussian blur, motion blur, clip과 mask를 확인할 수 있습니다. retained geometry가 같으면 도형을 다시 적용하는 작업을 생략하고 Scene 변환을 사용합니다.

`staleSlot`은 이전 clip이나 mask를 현재 설정으로 안전하게 바꿀 수 있는지 확인합니다. 엔진에서 분리할 수 없는 상태라면 scene을 교체합니다. 단순히 자원 재사용을 늘리는 것만으로 충분하지 않고 이전 프레임의 효과를 올바르게 제거해야 합니다.

`signature`는 현재 항목 순서를 나타내는 문자열입니다. 순서가 같으면 기존 연결을 유지합니다. 변경되면 먼저 canvas를 비우고 새 순서로 추가합니다. 성공한 뒤에 signature를 저장하므로 실패한 재구성이 완료된 것으로 취급되지 않습니다.

## thorvg.ts는 초기화와 폰트를 담당한다

`loadThorvg`는 초기화 Promise를 공유합니다. 여러 호출이 같은 엔진 로드를 기다립니다. 실패하면 저장한 Promise를 비워 재시도가 가능하게 합니다.

자동 백엔드는 하드웨어 WebGL2가 가능하면 GL, 그렇지 않으면 SW를 선택합니다. `renderer` query parameter로 명시할 수도 있습니다. 글꼴은 ThorVG `Font.load`와 브라우저 `FontFace`에 함께 등록합니다.

ThorVG SW는 ThorVG 엔진의 소프트웨어 렌더링입니다. Canvas2D fallback과 같지 않습니다. mask, motion blur, trim 등은 Canvas2D에서 같은 모습으로 보장되지 않으므로 효과를 이해하거나 바꿀 때 `/preview.html`에서 ThorVG 출력을 확인합니다.
