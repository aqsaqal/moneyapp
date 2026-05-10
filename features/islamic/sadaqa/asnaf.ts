// 8 asnaf — Quranic categories of zakat recipients (Tawbah 9:60).
//
// Used as an optional tag on zakat / sadaqa / qurban transactions so the
// Sadaqa screen can show a per-asnaf breakdown ("how is my distribution
// balanced across recipient categories"). The user picks freely; this
// tracker is descriptive, not prescriptive — distribution rulings vary
// by school and circumstance.

import { getRawDB } from '@/utils/db/client';

export type AsnafId =
  | 'faqir'        // the poor
  | 'miskin'       // the needy
  | 'amilin'       // zakat administrators / collectors
  | 'muallaf'      // those whose hearts are reconciled
  | 'riqab'        // freeing captives / those in bondage
  | 'gharimin'     // those in debt
  | 'fi-sabilillah'// in the cause of God
  | 'ibn-as-sabil';// the wayfarer / stranded traveller

export const ASNAF: { id: AsnafId; label: string; arabic: string; brief: string }[] = [
  { id: 'faqir', label: 'Faqir', arabic: 'الفقراء', brief: 'The poor — almost no income.' },
  { id: 'miskin', label: 'Miskin', arabic: 'المساكين', brief: 'The needy — income below need.' },
  { id: 'amilin', label: 'Amilin', arabic: 'العاملين عليها', brief: 'Zakat administrators.' },
  { id: 'muallaf', label: "Mu'allaf", arabic: 'المؤلفة قلوبهم', brief: 'Hearts being reconciled.' },
  { id: 'riqab', label: 'Riqab', arabic: 'الرقاب', brief: 'Freeing captives or those in bondage.' },
  { id: 'gharimin', label: 'Gharimin', arabic: 'الغارمين', brief: 'Those weighed by debt.' },
  { id: 'fi-sabilillah', label: 'Fi sabilillah', arabic: 'في سبيل الله', brief: 'In the cause of God.' },
  { id: 'ibn-as-sabil', label: 'Ibn as-sabil', arabic: 'ابن السبيل', brief: 'Stranded traveller.' },
];

export interface AsnafBreakdownRow {
  asnaf: AsnafId;
  total: number;
  count: number;
}

/** Aggregate giving-category transactions tagged with an asnaf. Returns
 *  one row per asnaf id present, sorted by total desc. */
export function loadAsnafBreakdown(periodStart?: number): AsnafBreakdownRow[] {
  const raw = getRawDB();
  const where = periodStart != null
    ? `AND date >= ${Number(periodStart)}`
    : '';
  const rows = raw.getAllSync(
    `SELECT asnaf, SUM(amount) AS total, COUNT(*) AS count
       FROM transactions
      WHERE asnaf IS NOT NULL
        AND asnaf != ''
        AND category IN ('zakat', 'sadaqa', 'qurban')
        ${where}
      GROUP BY asnaf
      ORDER BY total DESC`,
  ) as Array<{ asnaf: AsnafId; total: number; count: number }>;
  return rows;
}
