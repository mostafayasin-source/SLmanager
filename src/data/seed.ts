import { correctSession } from '../domain/attendance';
import { shiftInterval } from '../domain/schedule';
import { addDaysYmd, addMinutesIso, mondayOf, stockholmToday } from '../domain/time';
import type { AppData, AttendanceSession, Shift, SupportTicket } from '../domain/types';

export const DEMO_SALON_ID = 'salon_vasastan';

const ERIK = 'emp_erik';
const SARA = 'emp_sara';
const NOAH = 'emp_noah';

function shiftId(employeeId: string, date: string, start: string): string {
  return `shift_${employeeId}_${date}_${start.replace(':', '')}`;
}

function makeShift(salonId: string, employeeId: string, date: string, startTime: string, endTime: string): Shift {
  return {
    id: shiftId(employeeId, date, startTime),
    salonId,
    employeeId,
    date,
    startTime,
    endTime,
    note: '',
  };
}

function closedFromShift(shift: Shift): AttendanceSession {
  const { startIso, endIso } = shiftInterval(shift);
  const clockIn = addMinutesIso(startIso, 6);
  const clockOut = addMinutesIso(endIso, -3);
  const breakStart = addMinutesIso(startIso, 180);
  const breakEnd = addMinutesIso(breakStart, 30);
  const breaks =
    Date.parse(breakStart) > Date.parse(clockIn) && Date.parse(breakEnd) < Date.parse(clockOut)
      ? [{ id: `brk_${shift.id}`, start: breakStart, end: breakEnd }]
      : [];
  return {
    id: `att_${shift.id}`,
    salonId: shift.salonId,
    employeeId: shift.employeeId,
    clockIn,
    clockOut,
    breaks,
    corrections: [],
  };
}

function openFromShift(shift: Shift): AttendanceSession {
  const { startIso } = shiftInterval(shift);
  return {
    id: `att_${shift.id}`,
    salonId: shift.salonId,
    employeeId: shift.employeeId,
    clockIn: startIso,
    clockOut: null,
    breaks: [],
    corrections: [],
  };
}

export function createSeed(now = new Date()): AppData {
  const today = stockholmToday(now);
  const weekStart = mondayOf(today);
  const shifts: Shift[] = [];

  const addPattern = (monday: string, allowTodayOnWeekend: boolean) => {
    for (let index = 0; index < 7; index += 1) {
      const date = addDaysYmd(monday, index);
      const weekend = index >= 5;
      if (weekend && !(allowTodayOnWeekend && date === today)) continue;
      const shortFriday = index === 4;
      shifts.push(makeShift(DEMO_SALON_ID, ERIK, date, '09:00', '17:00'));
      shifts.push(makeShift(DEMO_SALON_ID, SARA, date, '10:00', '18:30'));
      shifts.push(makeShift(DEMO_SALON_ID, NOAH, date, '12:00', shortFriday ? '16:00' : '20:00'));
    }
  };

  addPattern(addDaysYmd(weekStart, -7), false);
  addPattern(weekStart, true);

  for (let index = 0; index < 5; index += 1) {
    const date = addDaysYmd(weekStart, index);
    shifts.push(makeShift('salon_soder', 'emp_maja', date, '09:00', '17:00'));
  }

  const past = shifts
    .filter((shift) => shift.salonId === DEMO_SALON_ID && shift.date < today && shift.date >= addDaysYmd(today, -14))
    .sort((a, b) => b.date.localeCompare(a.date) || a.startTime.localeCompare(b.startTime));

  const attendance: AttendanceSession[] = [];
  let noahOpened = false;
  let erikCorrected = false;
  for (const shift of past) {
    if (!noahOpened && shift.employeeId === NOAH) {
      attendance.push(openFromShift(shift));
      noahOpened = true;
      continue;
    }
    const closed = closedFromShift(shift);
    if (!erikCorrected && shift.employeeId === ERIK && closed.clockOut) {
      const clockOut = addMinutesIso(closed.clockOut, 12);
      attendance.push(
        correctSession(
          closed,
          { clockIn: closed.clockIn, clockOut, breaks: closed.breaks },
          {
            id: `cor_${closed.id}`,
            at: addMinutesIso(clockOut, 35),
            actor: 'Demo salongsägare',
            reason: 'Utstämplingen registrerades för tidigt.',
          },
        ),
      );
      erikCorrected = true;
      continue;
    }
    attendance.push(closed);
  }

  attendance.push({
    id: 'att_erik_live',
    salonId: DEMO_SALON_ID,
    employeeId: ERIK,
    clockIn: new Date(now.getTime() - 90 * 60_000).toISOString(),
    clockOut: null,
    breaks: [],
    corrections: [],
  });
  attendance.push({
    id: 'att_sara_live',
    salonId: DEMO_SALON_ID,
    employeeId: SARA,
    clockIn: new Date(now.getTime() - 3 * 3_600_000).toISOString(),
    clockOut: null,
    breaks: [{ id: 'brk_sara_live', start: new Date(now.getTime() - 20 * 60_000).toISOString(), end: null }],
    corrections: [],
  });

  return {
    version: 1,
    salons: [
      {
        id: DEMO_SALON_ID,
        name: 'Klipp & Skägg Vasastan',
        contactEmail: 'hej@klippochskagg.example',
        phone: '08-123 45 67',
        address: 'Odengatan 12, 113 22 Stockholm',
        subscriptionPrice: 1490,
        subscriptionStart: addDaysYmd(today, -120),
        subscriptionExpiry: addDaysYmd(today, 45),
        subscriptionStatus: 'active',
      },
      {
        id: 'salon_soder',
        name: 'Studio Söder',
        contactEmail: 'info@studiosoder.example',
        phone: '08-765 43 21',
        address: 'Götgatan 44, 118 26 Stockholm',
        subscriptionPrice: 990,
        subscriptionStart: addDaysYmd(today, -200),
        subscriptionExpiry: addDaysYmd(today, 6),
        subscriptionStatus: 'active',
      },
      {
        id: 'salon_malmo',
        name: 'Fade Room Malmö',
        contactEmail: 'hello@faderoom.example',
        phone: '040-555 12 12',
        address: 'Södra Förstadsgatan 8, 211 43 Malmö',
        subscriptionPrice: 1890,
        subscriptionStart: addDaysYmd(today, -60),
        subscriptionExpiry: addDaysYmd(today, 20),
        subscriptionStatus: 'suspended',
      },
    ],
    employees: [
      {
        id: ERIK,
        salonId: DEMO_SALON_ID,
        firstName: 'Erik',
        lastName: 'Lindqvist',
        jobTitle: 'Barberare',
        email: 'erik.lindqvist@example.com',
        phone: '070-111 22 33',
        active: true,
      },
      {
        id: SARA,
        salonId: DEMO_SALON_ID,
        firstName: 'Sara',
        lastName: 'Holm',
        jobTitle: 'Barberare',
        email: 'sara.holm@example.com',
        phone: '070-222 33 44',
        active: true,
      },
      {
        id: NOAH,
        salonId: DEMO_SALON_ID,
        firstName: 'Noah',
        lastName: 'Berg',
        jobTitle: 'Lärling',
        email: 'noah.berg@example.com',
        phone: '070-333 44 55',
        active: true,
      },
      {
        id: 'emp_maja',
        salonId: 'salon_soder',
        firstName: 'Maja',
        lastName: 'Ek',
        jobTitle: 'Frisör',
        email: 'maja.ek@example.com',
        phone: '070-444 55 66',
        active: true,
      },
      {
        id: 'emp_omar',
        salonId: 'salon_soder',
        firstName: 'Omar',
        lastName: 'Said',
        jobTitle: 'Barberare',
        email: 'omar.said@example.com',
        phone: '070-555 66 77',
        active: true,
      },
      {
        id: 'emp_liam',
        salonId: 'salon_malmo',
        firstName: 'Liam',
        lastName: 'Nordin',
        jobTitle: 'Barberare',
        email: 'liam.nordin@example.com',
        phone: '070-666 77 88',
        active: true,
      },
    ],
    shifts,
    attendance,
    tickets: sampleTickets(now),
    supportPhone: null,
  };
}

function hoursAgo(now: Date, hours: number): string {
  return new Date(now.getTime() - hours * 60 * 60 * 1000).toISOString();
}

function sampleTickets(now: Date): SupportTicket[] {
  return [
    {
      id: 'ticket_vasa_pren',
      salonId: DEMO_SALON_ID,
      subject: 'När förnyas prenumerationen?',
      category: 'subscription',
      status: 'open',
      createdAt: hoursAgo(now, 50),
      updatedAt: hoursAgo(now, 20),
      messages: [
        {
          id: 'msg_vasa_pren_1',
          authorRole: 'salon',
          authorName: 'Demo salongsägare',
          body: 'Vi undrar vilket datum prenumerationen förnyas, och om priset är detsamma.',
          at: hoursAgo(now, 50),
          readBySalon: true,
          readByPlatform: true,
        },
        {
          id: 'msg_vasa_pren_2',
          authorRole: 'platform',
          authorName: 'Demo plattformsägare',
          body: 'Förnyelsen görs manuellt. Jag tittar på datumet och återkommer här.',
          at: hoursAgo(now, 20),
          readBySalon: false,
          readByPlatform: true,
        },
      ],
    },
    {
      id: 'ticket_vasa_teknik',
      salonId: DEMO_SALON_ID,
      subject: 'Stämplingen sparas inte',
      category: 'technical',
      status: 'in_progress',
      createdAt: hoursAgo(now, 8),
      updatedAt: hoursAgo(now, 1),
      messages: [
        {
          id: 'msg_vasa_teknik_1',
          authorRole: 'salon',
          authorName: 'Demo salongsägare',
          body: 'När jag byter vecka i schemat försvinner den senaste stämplingen från översikten.',
          at: hoursAgo(now, 8),
          readBySalon: true,
          readByPlatform: true,
        },
        {
          id: 'msg_vasa_teknik_2',
          authorRole: 'platform',
          authorName: 'Demo plattformsägare',
          body: 'Vi tittar på det. Skriv gärna vilken vecka det gäller.',
          at: hoursAgo(now, 6),
          readBySalon: true,
          readByPlatform: true,
        },
        {
          id: 'msg_vasa_teknik_3',
          authorRole: 'salon',
          authorName: 'Demo salongsägare',
          body: 'Det händer fortfarande, senast på torsdagens pass.',
          at: hoursAgo(now, 1),
          readBySalon: true,
          readByPlatform: false,
        },
      ],
    },
    {
      id: 'ticket_soder_konto',
      salonId: 'salon_soder',
      subject: 'Byta kontaktadress',
      category: 'account',
      status: 'resolved',
      createdAt: hoursAgo(now, 90),
      updatedAt: hoursAgo(now, 70),
      messages: [
        {
          id: 'msg_soder_konto_1',
          authorRole: 'salon',
          authorName: 'Studio Söder',
          body: 'Kan kontaktadressen på kontot ändras till info@studiosoder.example?',
          at: hoursAgo(now, 90),
          readBySalon: true,
          readByPlatform: true,
        },
        {
          id: 'msg_soder_konto_2',
          authorRole: 'platform',
          authorName: 'Demo plattformsägare',
          body: 'Ja. Adressen uppdateras under salongens uppgifter. Ärendet är klart.',
          at: hoursAgo(now, 70),
          readBySalon: true,
          readByPlatform: true,
        },
      ],
    },
    {
      id: 'ticket_malmo_ovrigt',
      salonId: 'salon_malmo',
      subject: 'Fråga om extra stol',
      category: 'other',
      status: 'open',
      createdAt: hoursAgo(now, 5),
      updatedAt: hoursAgo(now, 5),
      messages: [
        {
          id: 'msg_malmo_ovrigt_1',
          authorRole: 'salon',
          authorName: 'Fade Room Malmö',
          body: 'Vi funderar på att lägga till en stol i salongen. Påverkar det prenumerationen?',
          at: hoursAgo(now, 5),
          readBySalon: true,
          readByPlatform: false,
        },
      ],
    },
  ];
}
