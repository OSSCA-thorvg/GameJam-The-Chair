export type Locale = 'en' | 'ko';

const korean = {
    "": "",
    "Manager Park": "박 과장",
    "Kim": "김 대리",
    "Admin": "총무팀",
    "Coworker": "옆자리 동료",
    "Leaving already?": "벌써 퇴근하는 거야?",
    "Watch the mop bucket!": "앗, 청소 물통 넘어간다!",
    "Please sort your trash.": "쓰레기 분리배출 부탁드려요.",
    "Back to work already?": "다시 출근하는 거야?",
    "Hey! I was cleaning…": "앗! 청소 중이었는데…",
    "About that workplace injury claim…": "산재 처리는…",
    "A bright future, right?": "밝은 미래가 보이죠?",
    "Why is this report printing into my face…": "보고서가 왜 얼굴로 출력돼…",
    "Those are my monthly results…": "이거 이번 달 실적인데…",
    "Too bright… I can't see my numbers!": "눈부셔… 실적 칸이 안 보여!",
    "Approved": "결재 완료",
    "My laptop?!": "노트북은?!",
    "Starting.": "시작합니다.",
    "Starting from checkpoint.": "체크포인트에서 시작합니다.",
    "Checkpoint saved.": "체크포인트 저장.",
    "Head impact.": "머리 충돌.",
    "Head impact": "머리 충돌",
    "Your head clocked out first.": "머리가 먼저 퇴근했습니다.",
    "Trash bin fall.": "휴지통 추락.",
    "Trash bin fall": "휴지통 추락",
    "Recycled along with your work.": "업무와 함께 분리배출.",
    "Focus depleted.": "집중도 소진.",
    "Focus depleted": "집중도 소진",
    "Wait, where am I?": "앗, 여기가 어디지?",
    "Extinguisher empty.": "Extinguisher empty · 소화기 비었음.",
    "Office escaped.": "사무실 탈출.",
    "Mechanical room reached.": "기계실 도착.",
    "Rooftop cleared.": "Rooftop cleared · 옥상 탈출.",
    "Clocking out…": "퇴근 처리 중…",
    "Business trip complete.": "출장 처리 완료.",
    "Officially resigned.": "Officially resigned · 정식 퇴사 처리됨.",
    "Retry": "다시",
    "Retry stage": "Retry · 다시",
    "Next": "다음",
    "PTUI! PTUI!!": "퉤! 퉷!!",
    "Exit →": "출구 →",
    "01 Office": "01 사무실",
    "02 Inside the building": "02 건물 내부",
    "03 Mechanical room & rooftop": "03 Rooftop · 기계실·옥상",
    "Focus": "집중도",
    "Business as usual.": "오늘도 정상 근무 중입니다.",
    "Start": "시작",
    "Records": "기록",
    "Paper": "종이",
    "Bin": "휴지통",
    "Light": "빛",
    "Cart": "서류 카트",
    "Door": "회전문",
    "Paused": "잠깐",
    "Resume": "계속",
    "Controls": "조작법",
    "Move": "이동",
    "Jump": "점프",
    "Spray extinguisher": "소화기 분사",
    "Pause": "일시정지",
    "Restart": "재도전",
    "Stages": "스테이지",
    "Each distraction: −20%. Recover +1% every 2 seconds without distractions.": "방해마다 −20%. 방해가 없으면 2초마다 +1%.",
    "Restarting at a flag restores full focus and dries you off.": "깃발에서 다시 출발하면 집중도 100%, 물기는 사라집니다.",
    "Chair escape game. Controls are in the pause menu.": "의자를 타고 탈출하는 게임. 조작법은 일시정지 메뉴에서 확인할 수 있습니다.",
    "Pause menu": "일시정지 메뉴",
    "Touch controls": "터치 조작",
    "Reverse": "후진",
    "Forward": "전진",
    "Balance controls": "균형 조절",
    "Lean left": "왼쪽으로 균형 보정",
    "Lean right": "오른쪽으로 균형 보정",
    "Meeting room": "회의실",
    "Emergency stairs": "비상계단",
    "Storage": "비품 창고",
    "Lift shaft": "승강로",
    "Mechanical room →": "기계실 →",
    "Mechanical room": "기계실",
    "Enter meeting room": "회의실 들어가기",
    "Leave meeting room": "회의실 나가기",
    "Meeting extended": "회의 연장",
    "Meeting: when should this meeting end?": "회의 종료 시각을 정하기 위한 회의",
    "The chairs have gone home.": "의자 세 분은 먼저 퇴근하셨습니다.",
    "People, please stay for the next agenda.": "사람은 다음 안건까지 남아 주세요.",
    "Oh, one more chair! You may leave!": "어, 의자 한 분 더 계셨네요. 먼저 가세요!",
    "tap… tap…": "타닥… 타닥…",
    "Meeting extended. Chairs may leave.": "회의는 연장합니다. 의자만 먼저 보내죠.",
    "Woohoo! Freedom!": "야호, 해방이다!",
    "Clocking out!": "퇴근이다아!",
    "Bye-bye, overtime!": "야근은 안녕!",
    "Employee undetected. One chair approved.": "직원 미감지. 의자 한 대 통과.",
    "Release the arrows. Hold still.": "방향키를 놓고 잠시 대기하세요.",
    "Overtime arriving first.": "야근 서류 먼저 내립니다.",
    "Urgent delivery!": "긴급 업무 배달!",
    "Rooftop →": "옥상 →"
};

export type Message = keyof typeof korean;

export function translate(message: Message, locale: Locale): string {
    return locale === 'ko' ? korean[message] : message;
}

export function resolveLocale(languages: readonly string[]): Locale {
    for (const language of languages) {
        const base = language.toLowerCase().split('-')[0];
        if (base === 'en' || base === 'ko') return base;
    }
    return 'en';
}

export function isMessage(value: string): value is Message {
    return Object.hasOwn(korean, value);
}
