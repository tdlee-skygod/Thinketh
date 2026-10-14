export interface Profile {
  id: string;
  email: string;
  displayName: string;
  createdAt: string;
}

// 나의 시간 설정 (F-21, 사용자당 1개)
export interface TimeSettings {
  userId: string;
  startDate: string;      // YYYY-MM-DD
  endDate: string;        // YYYY-MM-DD
  hourlyRate: number;     // 원
  availableHoursPerDay: number;   // 하루 가용시간(1~24), 기본 8
  activeStartTime: string; // 'HH:MM', 실시간 버려진 시간 누적 시작 시각, 기본 06:00
  activeEndTime: string;   // 'HH:MM', 실시간 버려진 시간 확정 시각, 기본 22:00
}

// 오늘의 의미있는 일 기록 (F-21, 하루 여러 건)
export interface TimeLog {
  id: string;
  userId: string;
  date: string;           // YYYY-MM-DD, 로컬(KST) 기준
  title: string;
  content: string;
  hours: number;
  createdAt: string;
  updatedAt: string;
}
