import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ActivityIndicator,
  ScrollView,
  Platform,
  TextInput,
  Modal,
  Pressable,
} from 'react-native';
import MaterialCommunityIcons from '@react-native-vector-icons/material-design-icons';
import { DateTimePickerAndroid } from '@react-native-community/datetimepicker';
import { colors, spacing, typography, borderRadius, elevation } from '../shared/theme/theme';
import { currencyINR } from '../utils/format';
import { getISTDate } from '../utils/dateUtils';
import { getSalesRecord, getSalesRecordsByDateRange, SalesRecord } from '../services/salesService';
import { handleServiceError } from '../services/serviceErrorWrapper';
import { showError } from '../shared/feedback/messageBus';
import Share from 'react-native-share';
import RNPrint from 'react-native-print';

type Mode = 'day' | 'week' | 'month' | 'range' | 'year';

interface Props {
  onBack: () => void;
}

const formatDateKey = (date: Date) => {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
};

const formatDisplayDate = (date: Date) =>
  date.toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });

const sumRecord = (acc: Totals, rec: SalesRecord | null) => {
  if (!rec) return acc;
  acc.totalSale += Number(rec.totalSale || 0) || 0;
  acc.deliveredQty += Number(rec.deliveredCans || 0) || 0;
  acc.emptyQty += Number(rec.emptyCollected || 0) || 0;
  acc.cash += Number(rec.cashPayment || 0) || 0;
  acc.online += Number(rec.onlinePayment || 0) || 0;
  acc.cashBills += Number((rec as any).cashBillsPayment || 0) || 0;
  acc.onlineBills += Number((rec as any).onlineBillsPayment || 0) || 0;
  acc.pendingReceived += Number((rec as any).pendingPaymentReceived || 0) || 0;
  acc.expense += Number(rec.expense || 0) || 0;
  return acc;
};

type Totals = {
  totalSale: number;
  deliveredQty: number;
  emptyQty: number;
  cash: number;
  online: number;
  cashBills: number;
  onlineBills: number;
  pendingReceived: number;
  expense: number;
  daysWithData: number;
};

export default function ReportsScreen({ onBack }: Props) {
  const [mode, setMode] = useState<Mode>('day');
  const [loading, setLoading] = useState(false);
  const [showExportModal, setShowExportModal] = useState(false);
  const [showMonthPicker, setShowMonthPicker] = useState(false);

  const [dayDate, setDayDate] = useState<Date>(() => {
    const today = getISTDate();
    today.setHours(0, 0, 0, 0);
    return today;
  });

  const [rangeStart, setRangeStart] = useState<Date>(() => {
    const today = getISTDate();
    today.setHours(0, 0, 0, 0);
    return today;
  });
  const [rangeEnd, setRangeEnd] = useState<Date>(() => {
    const today = getISTDate();
    today.setHours(0, 0, 0, 0);
    return today;
  });

  const [weekDate, setWeekDate] = useState<Date>(() => {
    const today = getISTDate();
    today.setHours(0, 0, 0, 0);
    return today;
  });

  const [monthIndex, setMonthIndex] = useState<number>(() => getISTDate().getMonth());
  const [monthYear, setMonthYear] = useState(() => String(getISTDate().getFullYear()));

  const [year, setYear] = useState(() => String(getISTDate().getFullYear()));

  const [totals, setTotals] = useState<Totals>({
    totalSale: 0,
    deliveredQty: 0,
    emptyQty: 0,
    cash: 0,
    online: 0,
    cashBills: 0,
    onlineBills: 0,
    pendingReceived: 0,
    expense: 0,
    daysWithData: 0,
  });

  const [dailyRows, setDailyRows] = useState<Array<{ date: string; record: SalesRecord }>>([]);

  const todayKey = useMemo(() => {
    const t = getISTDate();
    t.setHours(0, 0, 0, 0);
    return { date: t, key: formatDateKey(t) };
  }, []);

  const getWeekRange = useCallback((date: Date) => {
    const d = new Date(date);
    d.setHours(0, 0, 0, 0);
    // Monday-based week.
    const day = d.getDay();
    const offset = (day + 6) % 7;
    const start = new Date(d);
    start.setDate(d.getDate() - offset);
    start.setHours(0, 0, 0, 0);
    const end = new Date(start);
    end.setDate(start.getDate() + 6);
    end.setHours(0, 0, 0, 0);
    // Cap end to today.
    const cappedEnd = end > todayKey.date ? todayKey.date : end;
    return { start, end: cappedEnd };
  }, [todayKey.date]);

  const activeRangeLabel = useMemo(() => {
    if (mode === 'day') return formatDisplayDate(dayDate);
    if (mode === 'week') {
      const { start, end } = getWeekRange(weekDate);
      return `${formatDisplayDate(start)} → ${formatDisplayDate(end)}`;
    }
    if (mode === 'month') {
      const y = Number(monthYear.trim());
      const monthName = new Date(2000, monthIndex, 1).toLocaleString('en-IN', { month: 'short' });
      return Number.isFinite(y) ? `${monthName} ${y}` : `${monthName}`;
    }
    if (mode === 'range') return `${formatDisplayDate(rangeStart)} → ${formatDisplayDate(rangeEnd)}`;
    const y = year.trim();
    return y ? `Year ${y}` : 'Year';
  }, [dayDate, getWeekRange, mode, monthIndex, monthYear, rangeEnd, rangeStart, weekDate, year]);

  const pickDateAndroid = (current: Date, onPicked: (d: Date) => void) => {
    DateTimePickerAndroid.open({
      value: current,
      mode: 'date',
      maximumDate: todayKey.date,
      onChange: (event, date) => {
        if (event.type === 'dismissed') return;
        if (date) {
          const next = new Date(date);
          next.setHours(0, 0, 0, 0);
          onPicked(next);
        }
      },
    });
  };

  const runReport = useCallback(async () => {
    try {
      setLoading(true);
      setDailyRows([]);

      if (mode === 'day') {
        const dateKey = formatDateKey(dayDate);
        const res = await getSalesRecord(dateKey);
        if (res && !(res as any).code) {
          const nextTotals: Totals = {
            totalSale: 0,
            deliveredQty: 0,
            emptyQty: 0,
            cash: 0,
            online: 0,
            cashBills: 0,
            onlineBills: 0,
            pendingReceived: 0,
            expense: 0,
            daysWithData: 1,
          };
          sumRecord(nextTotals, res as SalesRecord);
          setTotals(nextTotals);
        } else if (res === null) {
          setTotals({
            totalSale: 0,
            deliveredQty: 0,
            emptyQty: 0,
            cash: 0,
            online: 0,
            cashBills: 0,
            onlineBills: 0,
            pendingReceived: 0,
            expense: 0,
            daysWithData: 0,
          });
        } else {
          const err = handleServiceError(res, 'getSalesRecord');
          showError(err.message);
        }
        return;
      }

      if (mode === 'week') {
        const { start, end } = getWeekRange(weekDate);
        const startKey = formatDateKey(start);
        const endKey = formatDateKey(end);
        const res = await getSalesRecordsByDateRange(startKey, endKey);
        if ((res as any)?.code) {
          const err = handleServiceError(res, 'getSalesRecordsByDateRange');
          showError(err.message);
          return;
        }

        const entries = Object.entries(res as Record<string, SalesRecord>)
          .sort(([a], [b]) => a.localeCompare(b))
          .map(([date, record]) => ({ date, record }));

        const nextTotals: Totals = {
          totalSale: 0,
          deliveredQty: 0,
          emptyQty: 0,
          cash: 0,
          online: 0,
          cashBills: 0,
          onlineBills: 0,
          pendingReceived: 0,
          expense: 0,
          daysWithData: 0,
        };
        entries.forEach(({ record }) => {
          sumRecord(nextTotals, record);
          nextTotals.daysWithData += 1;
        });

        setDailyRows(entries);
        setTotals(nextTotals);
        return;
      }

      if (mode === 'month') {
        const y = Number(monthYear.trim());
        if (!Number.isFinite(y) || y < 2000 || y > todayKey.date.getFullYear()) {
          showError('Please enter a valid year');
          return;
        }

        const isFutureMonth = y === todayKey.date.getFullYear() && monthIndex > todayKey.date.getMonth();
        if (isFutureMonth) {
          showError('Future month cannot be selected');
          return;
        }

        const start = new Date(y, monthIndex, 1);
        start.setHours(0, 0, 0, 0);
        const end = new Date(y, monthIndex + 1, 0);
        end.setHours(0, 0, 0, 0);
        const cappedEnd = end > todayKey.date ? todayKey.date : end;

        const res = await getSalesRecordsByDateRange(formatDateKey(start), formatDateKey(cappedEnd));
        if ((res as any)?.code) {
          const err = handleServiceError(res, 'getSalesRecordsByDateRange');
          showError(err.message);
          return;
        }

        const entries = Object.entries(res as Record<string, SalesRecord>)
          .sort(([a], [b]) => a.localeCompare(b))
          .map(([date, record]) => ({ date, record }));

        const nextTotals: Totals = {
          totalSale: 0,
          deliveredQty: 0,
          emptyQty: 0,
          cash: 0,
          online: 0,
          cashBills: 0,
          onlineBills: 0,
          pendingReceived: 0,
          expense: 0,
          daysWithData: 0,
        };
        entries.forEach(({ record }) => {
          sumRecord(nextTotals, record);
          nextTotals.daysWithData += 1;
        });

        setDailyRows(entries);
        setTotals(nextTotals);
        return;
      }

      if (mode === 'range') {
        if (rangeEnd < rangeStart) {
          showError('End date must be after start date');
          return;
        }
        const startKey = formatDateKey(rangeStart);
        const endKey = formatDateKey(rangeEnd);
        const res = await getSalesRecordsByDateRange(startKey, endKey);
        if ((res as any)?.code) {
          const err = handleServiceError(res, 'getSalesRecordsByDateRange');
          showError(err.message);
          return;
        }

        const entries = Object.entries(res as Record<string, SalesRecord>)
          .sort(([a], [b]) => a.localeCompare(b))
          .map(([date, record]) => ({ date, record }));

        const nextTotals: Totals = {
          totalSale: 0,
          deliveredQty: 0,
          emptyQty: 0,
          cash: 0,
          online: 0,
          cashBills: 0,
          onlineBills: 0,
          pendingReceived: 0,
          expense: 0,
          daysWithData: 0,
        };
        entries.forEach(({ record }) => {
          sumRecord(nextTotals, record);
          nextTotals.daysWithData += 1;
        });

        setDailyRows(entries);
        setTotals(nextTotals);
        return;
      }

      // year
      const y = year.trim();
      const yearNum = Number(y);
      const maxYear = todayKey.date.getFullYear();
      if (!y || !Number.isFinite(yearNum) || yearNum < 2000 || yearNum > maxYear) {
        showError('Please enter a valid year (e.g., 2026)');
        return;
      }

      const startKey = `${y}-01-01`;
      const endKey = `${y}-12-31`;
      const res = await getSalesRecordsByDateRange(startKey, endKey);
      if ((res as any)?.code) {
        const err = handleServiceError(res, 'getSalesRecordsByDateRange');
        showError(err.message);
        return;
      }

      const entries = Object.entries(res as Record<string, SalesRecord>)
        .sort(([a], [b]) => a.localeCompare(b))
        .map(([date, record]) => ({ date, record }));

      const nextTotals: Totals = {
        totalSale: 0,
        deliveredQty: 0,
        emptyQty: 0,
        cash: 0,
        online: 0,
        cashBills: 0,
        onlineBills: 0,
        pendingReceived: 0,
        expense: 0,
        daysWithData: 0,
      };
      entries.forEach(({ record }) => {
        sumRecord(nextTotals, record);
        nextTotals.daysWithData += 1;
      });

      setDailyRows(entries);
      setTotals(nextTotals);
    } catch (e) {
      const err = handleServiceError(e, 'runReport');
      showError(err.message);
    } finally {
      setLoading(false);
    }
  }, [dayDate, getWeekRange, mode, monthIndex, monthYear, rangeEnd, rangeStart, todayKey.date, weekDate, year]);

  // Auto-generate report when selection changes (no Generate button).
  useEffect(() => {
    // For year mode, wait until 4 digits are entered.
    if (mode === 'year' && year.trim().length !== 4) return;
    if (mode === 'month' && monthYear.trim().length !== 4) return;
    const t = setTimeout(() => {
      runReport();
    }, 450);
    return () => clearTimeout(t);
  }, [mode, dayDate, rangeStart, rangeEnd, year, monthYear, monthIndex, weekDate, runReport]);

  const receivedTotal = useMemo(() => {
    // Based on existing app logic:
    // - cashPayment + onlinePayment are normal payments
    // - cashBillsPayment + onlineBillsPayment are payments received from pending balances (Payment Balances screen)
    // - pendingPaymentReceived is tracked separately in SalesRecord and should be included if present
    return (
      totals.cash +
      totals.online +
      totals.cashBills +
      totals.onlineBills +
      totals.pendingReceived
    );
  }, [totals]);

  const profitLoss = useMemo(() => receivedTotal - totals.expense, [receivedTotal, totals.expense]);
  const isProfit = profitLoss >= 0;

  const buildCsv = () => {
    const header = [
      'Period',
      'DaysWithData',
      'TotalSale',
      'Cash',
      'Online',
      'CashBills',
      'OnlineBills',
      'PendingReceived',
      'Expense',
      'ReceivedTotal',
      'ProfitLoss',
      'DeliveredQty',
      'EmptyQty',
    ].join(',');

    const summary = [
      `"${activeRangeLabel}"`,
      String(totals.daysWithData),
      String(totals.totalSale),
      String(totals.cash),
      String(totals.online),
      String(totals.cashBills),
      String(totals.onlineBills),
      String(totals.pendingReceived),
      String(totals.expense),
      String(receivedTotal),
      String(profitLoss),
      String(totals.deliveredQty),
      String(totals.emptyQty),
    ].join(',');

    const dailyHeader = ['Date', 'TotalSale', 'Cash', 'Online', 'CashBills', 'OnlineBills', 'PendingReceived', 'Expense', 'DeliveredQty', 'EmptyQty'].join(',');
    const dailyLines = dailyRows
      .slice()
      .sort((a, b) => a.date.localeCompare(b.date))
      .map(({ date, record }) => {
        const cash = Number(record.cashPayment || 0) || 0;
        const online = Number(record.onlinePayment || 0) || 0;
        const cashBills = Number((record as any).cashBillsPayment || 0) || 0;
        const onlineBills = Number((record as any).onlineBillsPayment || 0) || 0;
        const pendingReceived = Number((record as any).pendingPaymentReceived || 0) || 0;
        const expense = Number(record.expense || 0) || 0;
        const deliveredQty = Number(record.deliveredCans || 0) || 0;
        const emptyQty = Number(record.emptyCollected || 0) || 0;
        return [
          date,
          String(record.totalSale || 0),
          String(cash),
          String(online),
          String(cashBills),
          String(onlineBills),
          String(pendingReceived),
          String(expense),
          String(deliveredQty),
          String(emptyQty),
        ].join(',');
      });

    return [header, summary, '', dailyHeader, ...dailyLines].join('\n');
  };

  const exportCsv = async () => {
    try {
      const csv = buildCsv();
      const url = `data:text/csv;charset=utf-8,${encodeURIComponent(csv)}`;
      await Share.open({
        title: 'Export Report (CSV)',
        filename: `report-${Date.now()}.csv`,
        type: 'text/csv',
        url,
      } as any);
    } catch (e: any) {
      // Share throws if the user cancels.
      if (String(e?.message || '').toLowerCase().includes('cancel')) return;
      const err = handleServiceError(e, 'exportCsv');
      showError(err.message);
    }
  };

  const buildPdfHtml = () => {
    const fmt = (n: number) => currencyINR(n || 0);
    const profitLabel = isProfit ? 'Profit' : 'Loss';
    const profitValue = fmt(Math.abs(profitLoss));

    const rows = [
      ['Total Sale', fmt(totals.totalSale)],
      ['Cash', fmt(totals.cash)],
      ['Online', fmt(totals.online)],
      ['Cash Bills', fmt(totals.cashBills)],
      ['Online Bills', fmt(totals.onlineBills)],
      ['Pending Received', fmt(totals.pendingReceived)],
      ['Expense', fmt(totals.expense)],
      ['Received Total', fmt(receivedTotal)],
      [profitLabel, profitValue],
      ['Delivered Qty', String(totals.deliveredQty)],
      ['Empty Qty', String(totals.emptyQty)],
      ['Days', String(totals.daysWithData)],
    ];

    const daily = dailyRows
      .slice()
      .sort((a, b) => a.date.localeCompare(b.date))
      .map(({ date, record }) => {
        const cash = Number(record.cashPayment || 0) || 0;
        const online = Number(record.onlinePayment || 0) || 0;
        const cashBills = Number((record as any).cashBillsPayment || 0) || 0;
        const onlineBills = Number((record as any).onlineBillsPayment || 0) || 0;
        const pendingReceived = Number((record as any).pendingPaymentReceived || 0) || 0;
        const expense = Number(record.expense || 0) || 0;
        const deliveredQty = Number(record.deliveredCans || 0) || 0;
        const emptyQty = Number(record.emptyCollected || 0) || 0;
        const received = cash + online + cashBills + onlineBills + pendingReceived;
        const pl = received - expense;
        return `
          <tr>
            <td>${date}</td>
            <td style="text-align:right;">${fmt(Number(record.totalSale || 0) || 0)}</td>
            <td style="text-align:right;">${fmt(received)}</td>
            <td style="text-align:right;">${fmt(expense)}</td>
            <td style="text-align:right;">${fmt(pl)}</td>
            <td style="text-align:right;">${deliveredQty}</td>
            <td style="text-align:right;">${emptyQty}</td>
          </tr>
        `;
      })
      .join('');

    return `
      <html>
        <head>
          <meta name="viewport" content="width=device-width, initial-scale=1" />
          <style>
            body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Arial; padding: 16px; color: #0f172a; }
            .title { font-size: 18px; font-weight: 700; margin-bottom: 4px; }
            .sub { color: #475569; margin-bottom: 14px; font-size: 12px; }
            .card { border: 1px solid #e5e7eb; border-radius: 12px; padding: 12px 14px; margin-bottom: 12px; background: #fff; }
            .row { display:flex; justify-content: space-between; padding: 6px 0; border-bottom: 1px solid #f1f5f9; font-size: 12px; }
            .row:last-child { border-bottom: none; }
            table { width: 100%; border-collapse: collapse; margin-top: 10px; }
            th, td { border: 1px solid #e5e7eb; padding: 8px; font-size: 11px; }
            th { background: #f8fafc; text-align: left; }
          </style>
        </head>
        <body>
          <div class="title">Report</div>
          <div class="sub">${activeRangeLabel}</div>

          <div class="card">
            ${rows
              .map(([k, v]) => `<div class="row"><div>${k}</div><div><b>${v}</b></div></div>`)
              .join('')}
          </div>

          ${dailyRows.length ? `
            <div class="card">
              <div style="font-weight:700; margin-bottom:8px;">Daily Breakdown</div>
              <table>
                <thead>
                  <tr>
                    <th>Date</th>
                    <th>Total Sale</th>
                    <th>Received</th>
                    <th>Expense</th>
                    <th>P/L</th>
                    <th>Delivered</th>
                    <th>Empty</th>
                  </tr>
                </thead>
                <tbody>
                  ${daily}
                </tbody>
              </table>
            </div>
          ` : ''}
        </body>
      </html>
    `;
  };

  const exportPdf = async () => {
    try {
      await RNPrint.print({ html: buildPdfHtml() });
    } catch (e) {
      const err = handleServiceError(e, 'exportPdf');
      showError(err.message);
    }
  };

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={onBack} style={styles.backButton}>
          <MaterialCommunityIcons name="arrow-left" size={22} color={colors.gray[800]} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Reports</Text>
        <TouchableOpacity onPress={() => setShowExportModal(true)} style={styles.exportButton}>
          <MaterialCommunityIcons name="export-variant" size={20} color={colors.gray[700]} />
        </TouchableOpacity>
      </View>

      <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
        <View style={styles.modeRow}>
          <ModeChip label="Day" active={mode === 'day'} onPress={() => setMode('day')} />
          <ModeChip label="Week" active={mode === 'week'} onPress={() => setMode('week')} />
          <ModeChip label="Month" active={mode === 'month'} onPress={() => setMode('month')} />
          <ModeChip label="Range" active={mode === 'range'} onPress={() => setMode('range')} />
          <ModeChip label="Year" active={mode === 'year'} onPress={() => setMode('year')} />
        </View>

        <View style={styles.filterCard}>
          <Text style={styles.filterTitle}>Select Period</Text>

          {mode === 'day' ? (
            <TouchableOpacity
              style={styles.dateRow}
              onPress={() => {
                if (Platform.OS === 'android') pickDateAndroid(dayDate, setDayDate);
              }}
              activeOpacity={0.8}
            >
              <MaterialCommunityIcons name="calendar" size={18} color={colors.gray[600]} />
              <Text style={styles.dateText}>{formatDisplayDate(dayDate)}</Text>
              <MaterialCommunityIcons name="chevron-right" size={20} color={colors.gray[400]} />
            </TouchableOpacity>
          ) : null}

          {mode === 'week' ? (
            <TouchableOpacity
              style={styles.dateRow}
              onPress={() => {
                if (Platform.OS === 'android') pickDateAndroid(weekDate, setWeekDate);
              }}
              activeOpacity={0.8}
            >
              <MaterialCommunityIcons name="calendar-week" size={18} color={colors.gray[600]} />
              <Text style={styles.dateText}>Week: {activeRangeLabel}</Text>
              <MaterialCommunityIcons name="chevron-right" size={20} color={colors.gray[400]} />
            </TouchableOpacity>
          ) : null}

          {mode === 'month' ? (
            <>
              <TouchableOpacity
                style={styles.dateRow}
                onPress={() => setShowMonthPicker(true)}
                activeOpacity={0.8}
              >
                <MaterialCommunityIcons name="calendar-month" size={18} color={colors.gray[600]} />
                <Text style={styles.dateText}>
                  Month: {new Date(2000, monthIndex, 1).toLocaleString('en-IN', { month: 'long' })}
                </Text>
                <MaterialCommunityIcons name="chevron-right" size={20} color={colors.gray[400]} />
              </TouchableOpacity>

              <View style={styles.yearRow}>
                <MaterialCommunityIcons name="calendar" size={18} color={colors.gray[600]} />
                <TextInput
                  value={monthYear}
                  onChangeText={setMonthYear}
                  placeholder="2026"
                  placeholderTextColor={colors.gray[400]}
                  keyboardType="number-pad"
                  style={styles.yearInput}
                  maxLength={4}
                />
              </View>
            </>
          ) : null}

          {mode === 'range' ? (
            <>
              <TouchableOpacity
                style={styles.dateRow}
                onPress={() => {
                  if (Platform.OS === 'android') pickDateAndroid(rangeStart, setRangeStart);
                }}
                activeOpacity={0.8}
              >
                <MaterialCommunityIcons name="calendar-start" size={18} color={colors.gray[600]} />
                <Text style={styles.dateText}>Start: {formatDisplayDate(rangeStart)}</Text>
                <MaterialCommunityIcons name="chevron-right" size={20} color={colors.gray[400]} />
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.dateRow}
                onPress={() => {
                  if (Platform.OS === 'android') pickDateAndroid(rangeEnd, setRangeEnd);
                }}
                activeOpacity={0.8}
              >
                <MaterialCommunityIcons name="calendar-end" size={18} color={colors.gray[600]} />
                <Text style={styles.dateText}>End: {formatDisplayDate(rangeEnd)}</Text>
                <MaterialCommunityIcons name="chevron-right" size={20} color={colors.gray[400]} />
              </TouchableOpacity>
            </>
          ) : null}

          {mode === 'year' ? (
            <View style={styles.yearRow}>
              <MaterialCommunityIcons name="calendar" size={18} color={colors.gray[600]} />
              <TextInput
                value={year}
                onChangeText={setYear}
                placeholder="2026"
                placeholderTextColor={colors.gray[400]}
                keyboardType="number-pad"
                style={styles.yearInput}
                maxLength={4}
              />
            </View>
          ) : null}
        </View>

        <View style={styles.summaryCard}>
          <View style={styles.summaryHeaderRow}>
            <Text style={styles.summaryTitle}>Summary</Text>
            <Text style={styles.summaryPeriod}>{activeRangeLabel}</Text>
          </View>

          <View style={styles.metricsRow}>
            <MetricCard icon="cash" label="Sale" value={currencyINR(totals.totalSale)} tone="success" />
            <MetricCard icon="cash-check" label="Received" value={currencyINR(receivedTotal)} tone="info" />
          </View>
          <View style={styles.metricsRow}>
            <MetricCard icon="chart-line" label="Expense" value={currencyINR(totals.expense)} tone="warning" />
            <MetricCard
              icon={isProfit ? 'trending-up' : 'trending-down'}
              label={isProfit ? 'Profit' : 'Loss'}
              value={currencyINR(Math.abs(profitLoss))}
              tone={isProfit ? 'success' : 'danger'}
            />
          </View>
          <View style={styles.metricsRow}>
            <MetricCard icon="bottle-soda" label="Delivered" value={totals.deliveredQty} tone="neutral" />
            <MetricCard icon="bottle-wine" label="Empty" value={totals.emptyQty} tone="neutral" />
          </View>
          <View style={styles.metricsRow}>
            <MetricCard icon="cash-multiple" label="Cash" value={currencyINR(totals.cash)} tone="neutral" />
            <MetricCard icon="credit-card-outline" label="Online" value={currencyINR(totals.online)} tone="neutral" />
          </View>
          <View style={styles.metricsRow}>
            <MetricCard icon="file-document-outline" label="Cash Bills" value={currencyINR(totals.cashBills)} tone="neutral" />
            <MetricCard icon="file-document-outline" label="Online Bills" value={currencyINR(totals.onlineBills)} tone="neutral" />
          </View>
          <View style={styles.metricsRow}>
            <MetricCard icon="hand-coin" label="Pending Received" value={currencyINR(totals.pendingReceived)} tone="neutral" />
            <MetricCard icon="calendar-check" label="Days" value={totals.daysWithData} tone="neutral" />
          </View>
        </View>

        {dailyRows.length > 0 ? (
          <View style={styles.breakdownCard}>
            <Text style={styles.breakdownTitle}>Daily Breakdown</Text>
            {dailyRows.slice().reverse().slice(0, 31).map((row) => {
              const cash = Number(row.record.cashPayment || 0) || 0;
              const online = Number(row.record.onlinePayment || 0) || 0;
              const cashBills = Number((row.record as any).cashBillsPayment || 0) || 0;
              const onlineBills = Number((row.record as any).onlineBillsPayment || 0) || 0;
              const pendingReceived = Number((row.record as any).pendingPaymentReceived || 0) || 0;
              const expense = Number(row.record.expense || 0) || 0;
              const received = cash + online + cashBills + onlineBills + pendingReceived;
              const pl = received - expense;
              return (
                <View key={row.date} style={styles.breakdownRow}>
                  <View style={styles.breakdownLeft}>
                    <Text style={styles.breakdownDate}>{row.date}</Text>
                    <Text style={styles.breakdownSub}>
                      Received {currencyINR(received)} • Expense {currencyINR(expense)}
                    </Text>
                  </View>
                  <Text style={[styles.breakdownValue, { color: pl >= 0 ? colors.success[600] : colors.danger[600] }]}>
                    {currencyINR(pl)}
                  </Text>
                </View>
              );
            })}
            {dailyRows.length > 31 ? (
              <Text style={styles.breakdownHint}>Showing last 31 days only</Text>
            ) : null}
          </View>
        ) : null}

        <View style={{ height: 24 }} />
      </ScrollView>

      <Modal
        visible={showExportModal}
        transparent
        animationType="fade"
        onRequestClose={() => setShowExportModal(false)}
      >
        <Pressable style={styles.modalOverlay} onPress={() => setShowExportModal(false)}>
          <Pressable style={styles.modalCard} onPress={() => {}}>
            <Text style={styles.modalTitle}>Export</Text>
            <Text style={styles.modalSub}>Google Sheets integration is planned (coming soon).</Text>

            <TouchableOpacity
              style={styles.modalAction}
              onPress={async () => {
                setShowExportModal(false);
                await exportPdf();
              }}
            >
              <MaterialCommunityIcons name="file-pdf-box" size={20} color={colors.danger[600]} />
              <Text style={styles.modalActionText}>Export as PDF</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.modalAction}
              onPress={async () => {
                setShowExportModal(false);
                await exportCsv();
              }}
            >
              <MaterialCommunityIcons name="file-excel" size={20} color={colors.success[700]} />
              <Text style={styles.modalActionText}>Export as CSV (Excel)</Text>
            </TouchableOpacity>

            <View style={[styles.modalAction, styles.modalActionDisabled]}>
              <MaterialCommunityIcons name="google-spreadsheet" size={20} color={colors.gray[400]} />
              <Text style={[styles.modalActionText, { color: colors.gray[400] }]}>Add to Google Sheets (Coming soon)</Text>
            </View>
          </Pressable>
        </Pressable>
      </Modal>

      <Modal
        visible={showMonthPicker}
        transparent
        animationType="fade"
        onRequestClose={() => setShowMonthPicker(false)}
      >
        <Pressable style={styles.modalOverlay} onPress={() => setShowMonthPicker(false)}>
          <Pressable style={styles.modalCard} onPress={() => {}}>
            <Text style={styles.modalTitle}>Select Month</Text>
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: spacing[10] }}>
              {Array.from({ length: 12 }).map((_, idx) => {
                const label = new Date(2000, idx, 1).toLocaleString('en-IN', { month: 'short' });
                const active = idx === monthIndex;
                return (
                  <TouchableOpacity
                    key={idx}
                    onPress={() => {
                      setMonthIndex(idx);
                      setShowMonthPicker(false);
                    }}
                    style={[
                      styles.monthChip,
                      active ? styles.monthChipActive : styles.monthChipInactive,
                    ]}
                    activeOpacity={0.85}
                  >
                    <Text style={[styles.monthChipText, active ? styles.monthChipTextActive : styles.monthChipTextInactive]}>
                      {label}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </View>
          </Pressable>
        </Pressable>
      </Modal>
    </View>
  );
}

function ModeChip({
  label,
  active,
  onPress,
}: {
  label: string;
  active: boolean;
  onPress: () => void;
}) {
  return (
    <TouchableOpacity
      onPress={onPress}
      style={[styles.chip, active ? styles.chipActive : styles.chipInactive]}
      activeOpacity={0.85}
    >
      <Text style={[styles.chipText, active ? styles.chipTextActive : styles.chipTextInactive]}>
        {label}
      </Text>
    </TouchableOpacity>
  );
}

function MetricCard({
  icon,
  label,
  value,
  tone,
}: {
  icon: React.ComponentProps<typeof MaterialCommunityIcons>['name'];
  label: string;
  value: string | number;
  tone: 'neutral' | 'success' | 'info' | 'warning' | 'danger';
}) {
  const toneStyle = useMemo(() => {
    if (tone === 'success') return { bg: colors.success[50], border: colors.success[200], icon: colors.success[600] };
    if (tone === 'info') return { bg: colors.info[50], border: colors.info[200], icon: colors.info[600] };
    if (tone === 'warning') return { bg: colors.warning[50], border: colors.warning[200], icon: colors.warning[600] };
    if (tone === 'danger') return { bg: colors.danger[50], border: colors.danger[200], icon: colors.danger[600] };
    return { bg: colors.bg.white, border: colors.border, icon: colors.primary[600] };
  }, [tone]);

  return (
    <View style={[styles.metricCard, { backgroundColor: toneStyle.bg, borderColor: toneStyle.border }]}>
      <View style={styles.metricTop}>
        <MaterialCommunityIcons name={icon} size={18} color={toneStyle.icon} />
        <Text style={styles.metricLabel}>{label}</Text>
      </View>
      <Text style={styles.metricValue}>{value}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bg.light },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing[16],
    paddingVertical: spacing[12],
    backgroundColor: colors.bg.white,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  backButton: { padding: spacing[8], marginLeft: -spacing[8] },
  headerTitle: {
    fontSize: typography.fontSize.base,
    fontWeight: typography.fontWeight.bold,
    color: colors.gray[800],
  },
  exportButton: { padding: spacing[8], marginRight: -spacing[8] },
  content: { flex: 1, paddingHorizontal: spacing[16], paddingTop: spacing[12] },

  modeRow: { flexDirection: 'row', gap: spacing[8], marginBottom: spacing[12] },
  chip: {
    paddingHorizontal: spacing[12],
    paddingVertical: spacing[8],
    borderRadius: borderRadius.md,
    borderWidth: 1,
  },
  chipActive: { backgroundColor: colors.primary[50], borderColor: colors.primary[200] },
  chipInactive: { backgroundColor: colors.bg.white, borderColor: colors.border },
  chipText: { fontSize: typography.fontSize.sm, fontWeight: typography.fontWeight.semibold },
  chipTextActive: { color: colors.primary[700] },
  chipTextInactive: { color: colors.gray[700] },

  filterCard: {
    backgroundColor: colors.bg.white,
    borderRadius: borderRadius.lg,
    padding: spacing[16],
    marginBottom: spacing[12],
    ...elevation.sm,
  },
  filterTitle: {
    fontSize: typography.fontSize.sm,
    fontWeight: typography.fontWeight.bold,
    color: colors.gray[800],
    marginBottom: spacing[12],
  },

  dateRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing[10],
    paddingVertical: spacing[10],
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: borderRadius.md,
    paddingHorizontal: spacing[12],
    marginBottom: spacing[10],
  },
  dateText: { flex: 1, color: colors.gray[800], fontWeight: typography.fontWeight.semibold },

  yearRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing[10],
    paddingVertical: spacing[10],
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: borderRadius.md,
    paddingHorizontal: spacing[12],
    marginBottom: spacing[10],
  },
  yearInput: {
    flex: 1,
    paddingVertical: 0,
    color: colors.gray[800],
    fontWeight: typography.fontWeight.semibold,
  },

  summaryCard: {
    backgroundColor: colors.bg.white,
    borderRadius: borderRadius.lg,
    padding: spacing[16],
    marginBottom: spacing[12],
    ...elevation.sm,
  },
  summaryHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: spacing[12],
  },
  summaryTitle: {
    fontSize: typography.fontSize.sm,
    fontWeight: typography.fontWeight.bold,
    color: colors.gray[800],
  },
  summaryPeriod: {
    color: colors.gray[500],
    fontSize: typography.fontSize.xs,
    fontWeight: typography.fontWeight.semibold,
  },

  metricsRow: { flexDirection: 'row', columnGap: 12, marginBottom: 10 },
  metricCard: {
    flex: 1,
    borderWidth: 1,
    borderRadius: borderRadius.lg,
    paddingHorizontal: spacing[12],
    paddingVertical: spacing[12],
  },
  metricTop: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing[8],
    marginBottom: 6,
  },
  metricLabel: {
    flex: 1,
    color: colors.gray[600],
    fontSize: typography.fontSize.xs,
    fontWeight: typography.fontWeight.semibold,
  },
  metricValue: {
    color: colors.gray[900],
    fontSize: typography.fontSize.base,
    fontWeight: typography.fontWeight.bold,
  },

  breakdownCard: {
    backgroundColor: colors.bg.white,
    borderRadius: borderRadius.lg,
    padding: spacing[16],
    marginBottom: spacing[12],
    ...elevation.sm,
  },
  breakdownTitle: {
    fontSize: typography.fontSize.sm,
    fontWeight: typography.fontWeight.bold,
    color: colors.gray[800],
    marginBottom: spacing[10],
  },
  breakdownRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: spacing[8],
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  breakdownLeft: { flex: 1, paddingRight: spacing[10] },
  breakdownDate: { color: colors.gray[800], fontWeight: typography.fontWeight.semibold, fontSize: typography.fontSize.sm },
  breakdownSub: { marginTop: 2, color: colors.gray[500], fontSize: typography.fontSize.xs },
  breakdownValue: { color: colors.gray[900], fontWeight: typography.fontWeight.bold, fontSize: typography.fontSize.sm },
  breakdownHint: { marginTop: spacing[10], color: colors.gray[500], fontSize: typography.fontSize.sm },

  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.35)',
    padding: spacing[16],
    justifyContent: 'flex-end',
  },
  modalCard: {
    backgroundColor: colors.bg.white,
    borderRadius: borderRadius.lg,
    padding: spacing[16],
    borderWidth: 1,
    borderColor: colors.border,
    ...elevation.md,
  },
  modalTitle: {
    fontSize: typography.fontSize.base,
    fontWeight: typography.fontWeight.bold,
    color: colors.gray[900],
  },
  modalSub: {
    marginTop: 4,
    marginBottom: spacing[12],
    fontSize: typography.fontSize.xs,
    color: colors.gray[500],
  },
  modalAction: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing[10],
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: borderRadius.md,
    paddingVertical: spacing[12],
    paddingHorizontal: spacing[12],
    marginBottom: spacing[10],
  },
  modalActionDisabled: {
    opacity: 0.7,
  },
  modalActionText: {
    color: colors.gray[800],
    fontWeight: typography.fontWeight.semibold,
    fontSize: typography.fontSize.sm,
  },

  monthChip: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: borderRadius.md,
    paddingVertical: spacing[8],
    paddingHorizontal: spacing[10],
    minWidth: 64,
    alignItems: 'center',
  },
  monthChipActive: { backgroundColor: colors.primary[50], borderColor: colors.primary[200] },
  monthChipInactive: { backgroundColor: colors.bg.white, borderColor: colors.border },
  monthChipText: { fontSize: typography.fontSize.sm, fontWeight: typography.fontWeight.semibold },
  monthChipTextActive: { color: colors.primary[700] },
  monthChipTextInactive: { color: colors.gray[700] },
});
