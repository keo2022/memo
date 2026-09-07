import { Platform } from 'react-native';
import * as Notifications from 'expo-notifications';
import AsyncStorage from '@react-native-async-storage/async-storage';
import type { EventItem } from '../types';
import { parseYmd, formatKoreanTime } from './date';

// 앱이 포그라운드일 때도 배너/소리를 띄웁니다.
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowBanner: true,
    shouldShowList: true,
    shouldPlaySound: true,
    shouldSetBadge: false,
  }),
});

const ANDROID_CHANNEL_ID = 'event-reminders';
const PREFS_KEY = 'memo.notifPrefs';

export interface NotifPrefs {
  enabled: boolean;
  weekBefore: boolean; // D-7에도 알림
}

const DEFAULT_PREFS: NotifPrefs = { enabled: true, weekBefore: false };

export async function loadNotifPrefs(): Promise<NotifPrefs> {
  try {
    const raw = await AsyncStorage.getItem(PREFS_KEY);
    if (!raw) return DEFAULT_PREFS;
    return { ...DEFAULT_PREFS, ...(JSON.parse(raw) as Partial<NotifPrefs>) };
  } catch {
    return DEFAULT_PREFS;
  }
}

export async function saveNotifPrefs(prefs: NotifPrefs): Promise<void> {
  try {
    await AsyncStorage.setItem(PREFS_KEY, JSON.stringify(prefs));
  } catch {
    // 저장 실패해도 이번 세션엔 넘어온 값으로 동작
  }
}

async function ensureAndroidChannel(): Promise<void> {
  if (Platform.OS !== 'android') return;
  await Notifications.setNotificationChannelAsync(ANDROID_CHANNEL_ID, {
    name: '일정 알림',
    importance: Notifications.AndroidImportance.DEFAULT,
    lightColor: '#D98C9A',
  });
}

// 알림 권한 확보. 예전에 물어봤다가 거부했으면 다시 묻지 않습니다.
export async function ensureNotificationPermission(): Promise<boolean> {
  const current = await Notifications.getPermissionsAsync();
  if (current.granted) return true;
  if (current.status === 'undetermined' || current.canAskAgain) {
    const req = await Notifications.requestPermissionsAsync();
    return req.granted;
  }
  return false;
}

interface Reminder {
  at: Date;
  title: string;
  body: string;
  eventId: string;
}

const HOUR = 3600 * 1000;

// 일정 하나에 대해 미래에 울릴 알림들을 계산합니다.
function buildReminders(ev: EventItem, prefs: NotifPrefs, now: Date): Reminder[] {
  const p = parseYmd(ev.date);
  if (!p) return [];

  const dayStart = new Date(p.y, p.m - 1, p.d, 0, 0, 0, 0);
  const out: Reminder[] = [];
  const push = (at: Date, body: string) => out.push({ at, body, title: ev.title, eventId: ev.id });

  // 당일: 시간이 있으면 3시간 전, 없으면 아침 9시
  if (ev.time) {
    const [h, m] = ev.time.split(':').map(Number);
    const start = new Date(p.y, p.m - 1, p.d, h, m, 0, 0);
    push(
      new Date(start.getTime() - 3 * HOUR),
      `오늘 ${formatKoreanTime(ev.time)}${ev.location ? ` · ${ev.location}` : ''}`
    );
  } else {
    push(new Date(p.y, p.m - 1, p.d, 9, 0, 0, 0), '오늘이에요! 🎉');
  }

  // 하루 전 저녁 8시 (= 자정에서 4시간 뒤로 뺀 전날 20:00)
  push(new Date(dayStart.getTime() - 4 * HOUR), '내일이에요. 준비 잘 하고 계신가요?');

  // 일주일 전 아침 9시
  if (prefs.weekBefore) {
    push(new Date(dayStart.getTime() - 7 * 24 * HOUR + 9 * HOUR), '일주일 남았어요.');
  }

  // 이미 지난 시각은 제외
  return out.filter((r) => r.at.getTime() > now.getTime() + 5000);
}

// 현재 일정 목록에 맞춰 로컬 알림을 다시 예약합니다.
// (이 앱이 예약하는 유일한 주체라, 매번 전부 취소하고 다시 겁니다. 기기별로 각자 호출됩니다.)
export async function syncEventReminders(events: EventItem[]): Promise<void> {
  const prefs = await loadNotifPrefs();

  await Notifications.cancelAllScheduledNotificationsAsync();
  if (!prefs.enabled) return;

  const now = new Date();
  const reminders = events.flatMap((ev) => buildReminders(ev, prefs, now));
  reminders.sort((a, b) => a.at.getTime() - b.at.getTime());

  // 예약할 알림이 하나도 없으면 권한도 물어보지 않습니다(빈 앱에서 불쑥 뜨는 프롬프트 방지).
  if (reminders.length === 0) return;

  const granted = await ensureNotificationPermission();
  if (!granted) return;

  await ensureAndroidChannel();

  // iOS는 대기 중인 로컬 알림이 최대 64개 → 가까운 것부터 60개만.
  for (const r of reminders.slice(0, 60)) {
    await Notifications.scheduleNotificationAsync({
      content: { title: r.title, body: r.body, data: { eventId: r.eventId } },
      trigger: {
        type: Notifications.SchedulableTriggerInputTypes.DATE,
        date: r.at,
        ...(Platform.OS === 'android' ? { channelId: ANDROID_CHANNEL_ID } : {}),
      },
    });
  }
}

// 설정에서 알림을 켤 때 호출: 권한을 먼저 확보합니다.
export async function enableNotifications(): Promise<boolean> {
  const granted = await ensureNotificationPermission();
  if (granted) await ensureAndroidChannel();
  return granted;
}

// 설정 화면에서 "알림이 잘 오는지" 바로 확인할 수 있게 5초 뒤 테스트 알림을 예약합니다.
export async function sendTestNotification(): Promise<boolean> {
  const granted = await ensureNotificationPermission();
  if (!granted) return false;
  await ensureAndroidChannel();
  await Notifications.scheduleNotificationAsync({
    content: { title: '알림 테스트', body: '이렇게 일정 알림이 도착해요 🎉' },
    trigger: {
      type: Notifications.SchedulableTriggerInputTypes.TIME_INTERVAL,
      seconds: 5,
      ...(Platform.OS === 'android' ? { channelId: ANDROID_CHANNEL_ID } : {}),
    },
  });
  return true;
}
