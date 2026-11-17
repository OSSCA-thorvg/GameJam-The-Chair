# GameJam-The-Chair

[English](README.md) | [한국어](README-ko.md)

일을 멈추지 않는 직원을 태운 사무용 의자가 회사를 탈출하는 물리 액션 게임입니다.
구르고, 점프하고, 소화기 반동을 이용해 사무실, 회의실과 복도, 옥상, 하늘, 우주까지 다섯 스테이지를 탈출하세요.
**의자는 퇴근하고 싶습니다. 직원은 계속 타자를 칩니다.**

<a href="https://ossca-thorvg.github.io/GameJam-The-Chair/">
  <img width="1189" height="607" alt="KakaoTalk_Photo_2026-11-14-23-36-12 001" src="https://github.com/user-attachments/assets/9e7f1993-fd3c-46c6-b691-787d98c25030" />
</a>

<br/>
<br/>

## 조작법

| 키 | 동작 |
|---|---|
| ← / → | 이동 |
| ↑ | 스테이지에서 점프 |
| ↓ | 회의실 입장 또는 퇴장 |
| Space | 소화기를 획득한 뒤 분사 |
| P / Esc | 일시정지 |
| R | 마지막 체크포인트에서 다시 시작 |

<br/>
<br/>

## 스크린샷

<img width="402" height="205" alt="KakaoTalk_Photo_2026-11-14-23-36-13 006" src="https://github.com/user-attachments/assets/e1a2dfb7-c57d-4bf3-9a76-272c228b3c55" />
<img width="402" height="205" alt="KakaoTalk_Photo_2026-11-14-23-36-13 008" src="https://github.com/user-attachments/assets/d80b926f-e9ef-4b10-b14a-1888bcb86a44" />

<br/>
<br/>

## ThorVG 활용 기능

게임 속 모든 배경, 캐릭터, 오브젝트와 시각 효과는 ThorVG WebCanvas로 벡터 렌더링합니다.

- **도형, 경로, 그라디언트:** 배경, 캐릭터, 오브젝트.
- **마스크, 클리핑, 블렌딩:** 시계 전환 효과와 물웅덩이 반사.
- **가우시안 블러와 모션 블러:** 빛나는 그래프 선과 날아다니는 서류.
- **장면 변환과 재사용:** 그룹으로 묶은 배경 이동.
- **텍스트와 TTF 글꼴:** 대사와 표지판.
- **벡터로 렌더링한 2.5D:** 카메라 전환과 우주 장면.

<br/>
<br/>

## 팀

| 팀원 | 주요 기여 |
|---|---|
| [juyonLee00](https://github.com/juyonLee00) | 스테이지 1~3 설계, 2.5D 시각 연출, 캐릭터와 배경 그래픽 |
| [leedonggyu1848](https://github.com/leedonggyu1848) | 오프닝 연출, 전체 스토리 설계, 스테이지 4~5 설계, 디버깅 도구 |

두 팀원 모두 공통 영역에도 함께 기여했습니다.

<br/>
<br/>

## 크레딧

- 렌더링: [ThorVG](https://github.com/thorvg/thorvg) 및 ThorVG WebCanvas.
- 글꼴: Black Han Sans, Do Hyeon, Jua. SIL OFL 1.1 라이선스를 따릅니다. [글꼴 라이선스](src/assets/fonts/)를 참고하세요.
- OSSCA ThorVG 게임잼을 위해 제작했습니다.
- 프로젝트 라이선스: [MIT](LICENSE).

## 개발

코딩 규칙과 검증 명령은 [Coding style](CODING_STYLE.md)에 정리되어 있습니다.
